"""
Score recalculation tasks — Story 04.4
Triggered when job criteria are added, updated, deleted, or re-extracted.
"""
import logging
import uuid

from celery import shared_task
from sqlalchemy import select, text

from app.services import celery_app
from app.db.base import SyncSessionLocal
from app.services.embedding_service import SyncEmbeddingService
from app.services.fit_score_service import SyncFitScoreService

logger = logging.getLogger(__name__)

_embedder = SyncEmbeddingService()
_fit_scorer = SyncFitScoreService()


@celery_app.task(
    name="app.tasks.score_tasks.recalculate_scores_for_job",
    bind=True,
    max_retries=2,
    default_retry_delay=30,
)
def recalculate_scores_for_job(self, job_id: str) -> dict:
    """
    Re-embed the job then recompute fit scores for all candidates who applied.
    Called automatically after any criteria change.
    """
    try:
        with SyncSessionLocal() as db:
            job_uuid = uuid.UUID(job_id)

            # Mark recalculation as in-progress
            db.execute(
                text("""
                    INSERT INTO score_recalculation_jobs (job_id, status, started_at)
                    VALUES (:jid, 'running', now())
                    ON CONFLICT (job_id) DO UPDATE
                      SET status = 'running', started_at = now(), completed_at = NULL,
                          total = 0, scored = 0, errors = 0
                """),
                {"jid": job_id},
            )
            db.commit()

            # Step 1: Re-embed the job with updated criteria
            try:
                embed_result = _embedder.embed_job_sync(db, job_uuid)
                db.commit()
                logger.info("Job re-embedded for recalculation: job=%s status=%s", job_id, embed_result.get("status"))
            except Exception as exc:
                logger.error("Job re-embedding failed for %s: %s", job_id, exc)

            # Step 2: Get all candidates who applied to this job
            rows = db.execute(
                text("""
                    SELECT DISTINCT ru.candidate_id
                    FROM resume_uploads ru
                    WHERE ru.job_id = :jid
                      AND ru.candidate_id IS NOT NULL
                      AND ru.status = 'completed'
                """),
                {"jid": job_id},
            ).fetchall()
            candidate_ids = [r[0] for r in rows]

            total = len(candidate_ids)
            scored = 0
            errors = 0

            # Update total count
            db.execute(
                text("UPDATE score_recalculation_jobs SET total = :t WHERE job_id = :jid"),
                {"t": total, "jid": job_id},
            )
            db.commit()

            # Step 3: Recompute fit score for each candidate
            for cid in candidate_ids:
                try:
                    result = _fit_scorer.score_candidate_sync(db, cid, job_uuid)
                    db.commit()
                    if result.get("status") == "scored":
                        scored += 1
                    else:
                        errors += 1
                except Exception as exc:
                    logger.error("Score recalc failed for candidate=%s job=%s: %s", cid, job_id, exc)
                    errors += 1

                # Update progress incrementally
                db.execute(
                    text("UPDATE score_recalculation_jobs SET scored = :s, errors = :e WHERE job_id = :jid"),
                    {"s": scored, "e": errors, "jid": job_id},
                )
                db.commit()

            # Mark complete
            db.execute(
                text("""
                    UPDATE score_recalculation_jobs
                    SET status = 'completed', completed_at = now(),
                        total = :t, scored = :s, errors = :e
                    WHERE job_id = :jid
                """),
                {"t": total, "s": scored, "e": errors, "jid": job_id},
            )
            db.commit()

            logger.info(
                "Score recalculation complete: job=%s total=%d scored=%d errors=%d",
                job_id, total, scored, errors,
            )
            return {"status": "completed", "job_id": job_id, "total": total, "scored": scored, "errors": errors}

    except Exception as exc:
        logger.exception("Unexpected error in recalculate_scores_for_job for %s", job_id)
        with SyncSessionLocal() as db:
            db.execute(
                text("UPDATE score_recalculation_jobs SET status = 'failed', completed_at = now() WHERE job_id = :jid"),
                {"jid": job_id},
            )
            db.commit()
        raise self.retry(exc=exc)
