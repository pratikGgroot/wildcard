"""
Story 02.6: Duplicate Candidate Detection
- Exact email match within same job → merge (newer resume wins)
- Embedding cosine similarity ≥ 0.92 → flag for recruiter review
- Same candidate applying to different jobs → valid, not a duplicate
"""
import uuid
import logging
from dataclasses import dataclass
from typing import Literal

from sqlalchemy import select, and_, or_, text
from sqlalchemy.orm import Session

from app.models.candidate import Candidate, ResumeUpload, DuplicateFlag

logger = logging.getLogger(__name__)

DedupType = Literal["exact_duplicate", "same_candidate_new_job", "probable_duplicate", "new_candidate"]
EMBEDDING_THRESHOLD = 0.92


@dataclass
class DedupResult:
    type: DedupType
    match_id: uuid.UUID | None = None
    score: float | None = None


class DuplicateDetectionService:
    """
    Runs after LLM extraction. Checks for duplicates and either merges or flags.
    All operations are synchronous (called from Celery task).
    """

    def check_and_handle(
        self,
        db: Session,
        new_candidate: Candidate,
        upload: ResumeUpload,
        embedding: list[float] | None = None,
    ) -> DedupResult:
        """
        Main entry point. Returns the dedup result and mutates DB as needed.
        Caller must commit.
        """
        result = self._detect(db, new_candidate, upload.job_id, embedding)

        if result.type == "exact_duplicate":
            self._merge_into_existing(db, new_candidate, upload, result.match_id)
        elif result.type == "probable_duplicate":
            self._create_flag(db, new_candidate.id, result.match_id, "embedding", result.score)
        elif result.type == "same_candidate_new_job":
            # Link upload to existing candidate profile instead of the new one
            self._reuse_existing_profile(db, new_candidate, upload, result.match_id)

        return result

    # ── Detection ─────────────────────────────────────────────────────────────

    def _detect(
        self,
        db: Session,
        candidate: Candidate,
        job_id: uuid.UUID,
        embedding: list[float] | None,
    ) -> DedupResult:
        # Step 1: exact email match
        if candidate.email:
            existing = db.execute(
                select(Candidate).where(
                    and_(
                        Candidate.email == candidate.email,
                        Candidate.id != candidate.id,
                    )
                )
            ).scalars().first()

            if existing:
                # Check if they already applied to this job
                existing_upload = db.execute(
                    select(ResumeUpload).where(
                        and_(
                            ResumeUpload.candidate_id == existing.id,
                            ResumeUpload.job_id == job_id,
                        )
                    )
                ).scalars().first()

                if existing_upload:
                    return DedupResult(type="exact_duplicate", match_id=existing.id)
                else:
                    return DedupResult(type="same_candidate_new_job", match_id=existing.id)

        # Step 2: embedding similarity (only if pgvector available and embedding provided)
        if embedding:
            similar = self._find_similar_by_embedding(db, candidate.id, job_id, embedding)
            if similar:
                return DedupResult(type="probable_duplicate", match_id=similar[0], score=similar[1])

        return DedupResult(type="new_candidate")

    def _find_similar_by_embedding(
        self,
        db: Session,
        exclude_id: uuid.UUID,
        job_id: uuid.UUID,
        embedding: list[float],
    ) -> tuple[uuid.UUID, float] | None:
        """Find candidates in the same job with cosine similarity >= threshold."""
        try:
            vec_str = "[" + ",".join(str(v) for v in embedding) + "]"
            # Join through resume_uploads to scope to same job
            rows = db.execute(
                text("""
                    SELECT c.id, 1 - (c.resume_embedding <=> :vec::vector) AS score
                    FROM candidates c
                    JOIN resume_uploads ru ON ru.candidate_id = c.id
                    WHERE ru.job_id = :job_id
                      AND c.id != :exclude_id
                      AND c.resume_embedding IS NOT NULL
                      AND 1 - (c.resume_embedding <=> :vec::vector) >= :threshold
                    ORDER BY score DESC
                    LIMIT 1
                """),
                {"vec": vec_str, "job_id": str(job_id), "exclude_id": str(exclude_id), "threshold": EMBEDDING_THRESHOLD},
            ).fetchall()

            if rows:
                return uuid.UUID(str(rows[0][0])), float(rows[0][1])
        except Exception as exc:
            logger.warning("Embedding similarity check failed: %s", exc)
        return None

    # ── Merge / reuse ─────────────────────────────────────────────────────────

    def _merge_into_existing(
        self,
        db: Session,
        new_candidate: Candidate,
        upload: ResumeUpload,
        existing_id: uuid.UUID,
    ) -> None:
        """
        Exact duplicate: newer resume wins for profile data.
        Point the upload at the existing candidate and delete the new stub.
        """
        existing = db.get(Candidate, existing_id)
        if not existing:
            return

        # Newer resume wins — update profile fields
        if new_candidate.full_name:
            existing.full_name = new_candidate.full_name
        if new_candidate.phone:
            existing.phone = new_candidate.phone
        if new_candidate.location:
            existing.location = new_candidate.location
        if new_candidate.linkedin_url:
            existing.linkedin_url = new_candidate.linkedin_url
        if new_candidate.raw_resume_text:
            existing.raw_resume_text = new_candidate.raw_resume_text
        if new_candidate.parsed_data:
            existing.parsed_data = new_candidate.parsed_data
        if new_candidate.parsing_confidence is not None:
            existing.parsing_confidence = new_candidate.parsing_confidence

        # Mark new candidate as duplicate
        new_candidate.is_duplicate = True
        new_candidate.duplicate_of_id = existing_id

        # Re-point upload to existing candidate
        upload.candidate_id = existing_id

        logger.info("Merged duplicate candidate %s into %s", new_candidate.id, existing_id)

    def _reuse_existing_profile(
        self,
        db: Session,
        new_candidate: Candidate,
        upload: ResumeUpload,
        existing_id: uuid.UUID,
    ) -> None:
        """
        Same candidate, different job: reuse existing profile, discard new stub.
        """
        new_candidate.is_duplicate = True
        new_candidate.duplicate_of_id = existing_id
        upload.candidate_id = existing_id
        logger.info("Reused existing profile %s for new job application", existing_id)

    def _create_flag(
        self,
        db: Session,
        candidate_id_a: uuid.UUID,
        candidate_id_b: uuid.UUID,
        method: str,
        score: float | None,
    ) -> None:
        """Create a pending duplicate flag for recruiter review."""
        # Avoid duplicate flags
        existing_flag = db.execute(
            select(DuplicateFlag).where(
                or_(
                    and_(
                        DuplicateFlag.candidate_id_a == candidate_id_a,
                        DuplicateFlag.candidate_id_b == candidate_id_b,
                    ),
                    and_(
                        DuplicateFlag.candidate_id_a == candidate_id_b,
                        DuplicateFlag.candidate_id_b == candidate_id_a,
                    ),
                )
            )
        ).scalar_one_or_none()

        if existing_flag:
            return

        flag = DuplicateFlag(
            id=uuid.uuid4(),
            candidate_id_a=candidate_id_a,
            candidate_id_b=candidate_id_b,
            similarity_score=score,
            detection_method=method,
            status="pending",
        )
        db.add(flag)
        logger.info(
            "Created duplicate flag: %s ↔ %s (method=%s score=%s)",
            candidate_id_a, candidate_id_b, method, score,
        )

    # ── Recruiter actions ─────────────────────────────────────────────────────

    def confirm_duplicate(self, db: Session, flag_id: uuid.UUID, reviewer_id: uuid.UUID | None) -> DuplicateFlag:
        """Confirm flag → merge candidate_b into candidate_a."""
        from datetime import datetime

        flag = db.get(DuplicateFlag, flag_id)
        if not flag:
            raise ValueError(f"Flag {flag_id} not found")

        # Merge b into a (a is the older/primary)
        candidate_a = db.get(Candidate, flag.candidate_id_a)
        candidate_b = db.get(Candidate, flag.candidate_id_b)

        if candidate_a and candidate_b:
            # Re-point all uploads from b to a
            uploads_b = db.execute(
                select(ResumeUpload).where(ResumeUpload.candidate_id == candidate_b.id)
            ).scalars().all()
            for u in uploads_b:
                u.candidate_id = candidate_a.id

            # Mark b as duplicate
            candidate_b.is_duplicate = True
            candidate_b.duplicate_of_id = candidate_a.id

        flag.status = "confirmed"
        flag.reviewed_by = reviewer_id
        flag.reviewed_at = datetime.utcnow()
        return flag

    def dismiss_duplicate(self, db: Session, flag_id: uuid.UUID, reviewer_id: uuid.UUID | None) -> DuplicateFlag:
        """Dismiss flag — both profiles are retained."""
        from datetime import datetime

        flag = db.get(DuplicateFlag, flag_id)
        if not flag:
            raise ValueError(f"Flag {flag_id} not found")

        flag.status = "dismissed"
        flag.reviewed_by = reviewer_id
        flag.reviewed_at = datetime.utcnow()
        return flag

    def list_pending_flags(self, db: Session, job_id: uuid.UUID | None = None) -> list[DuplicateFlag]:
        """List pending duplicate flags, optionally scoped to a job."""
        q = select(DuplicateFlag).where(DuplicateFlag.status == "pending")
        if job_id:
            q = q.where(DuplicateFlag.job_id == job_id)
        return db.execute(q.order_by(DuplicateFlag.created_at.desc())).scalars().all()
