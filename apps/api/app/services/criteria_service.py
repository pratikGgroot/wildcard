"""
Criteria Extraction Service
- Hash-based cache: skips re-extraction if description unchanged
- Stores criteria in job_criteria table
- Generates JD embedding and stores in pgvector
"""
import hashlib
import uuid
from datetime import datetime
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job import Job, JobCriteria
from app.schemas.criteria import CriteriaCreate, CriteriaOut, CriteriaUpdate, ExtractionResponse, ExtractionResult, CriteriaSuggestion, SuggestionsResponse
from app.services.llm_service import LLMService


def _hash_description(description: str) -> str:
    return hashlib.sha256(description.encode()).hexdigest()


class CriteriaService:
    def __init__(self, db: AsyncSession, llm: LLMService | None = None) -> None:
        self.db = db
        self.llm = llm or LLMService()

    # ── Extract ───────────────────────────────────────────────────────────────

    async def extract_criteria(self, job_id: uuid.UUID) -> ExtractionResponse:
        job = await self._get_job(job_id)
        new_hash = _hash_description(job.description)

        # Run LLM extraction
        result: ExtractionResult = await self.llm.extract_criteria(job.description)

        # Persist criteria (replace existing)
        await self.db.execute(delete(JobCriteria).where(JobCriteria.job_id == job_id))
        criteria_rows = self._result_to_rows(job_id, result)
        for row in criteria_rows:
            self.db.add(row)

        # Generate and store embedding
        embedding_stored = False
        embedding = await self.llm.generate_embedding(job.description)
        if embedding:
            await self._store_embedding(job_id, embedding)
            embedding_stored = True

        # Update job hash + timestamp
        job.description_hash = new_hash
        job.criteria_extracted_at = datetime.utcnow()
        await self.db.flush()

        criteria = await self._get_criteria(job_id)

        # Trigger score recalculation for all candidates on this job
        self._queue_recalculation(job_id, triggered_by="extract")

        return ExtractionResponse(
            job_id=job_id,
            criteria=[CriteriaOut.model_validate(c) for c in criteria],
            extracted_at=job.criteria_extracted_at,
            from_cache=False,
            embedding_stored=embedding_stored,
        )

    # ── Get criteria ──────────────────────────────────────────────────────────

    async def get_criteria(self, job_id: uuid.UUID) -> list[CriteriaOut]:
        await self._get_job(job_id)  # 404 guard
        rows = await self._get_criteria(job_id)
        return [CriteriaOut.model_validate(r) for r in rows]

    # ── CRUD ──────────────────────────────────────────────────────────────────

    async def add_criterion(self, job_id: uuid.UUID, data: "CriteriaCreate") -> JobCriteria:
        await self._get_job(job_id)  # 404 guard
        row = JobCriteria(
            job_id=job_id,
            criterion_name=data.criterion_name,
            criterion_type=data.criterion_type,
            weight=data.weight,
            required=data.required,
            ai_extracted=False,
            extra_data=data.extra_data,
        )
        self.db.add(row)
        await self.db.flush()
        await self.db.refresh(row)
        self._queue_recalculation(job_id, triggered_by="add_criterion")
        return row

    async def update_criterion(
        self, job_id: uuid.UUID, criterion_id: uuid.UUID, data: "CriteriaUpdate"
    ) -> JobCriteria:
        row = await self._get_criterion(job_id, criterion_id)
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(row, field, value)
        row.updated_at = datetime.utcnow()
        await self.db.flush()
        await self.db.refresh(row)
        self._queue_recalculation(job_id, triggered_by="update_criterion")
        return row

    async def delete_criterion(self, job_id: uuid.UUID, criterion_id: uuid.UUID) -> None:
        row = await self._get_criterion(job_id, criterion_id)
        await self.db.delete(row)
        await self.db.flush()
        self._queue_recalculation(job_id, triggered_by="delete_criterion")

    async def _get_criterion(self, job_id: uuid.UUID, criterion_id: uuid.UUID) -> JobCriteria:
        result = await self.db.execute(
            select(JobCriteria).where(
                JobCriteria.id == criterion_id,
                JobCriteria.job_id == job_id,
            )
        )
        row = result.scalar_one_or_none()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Criterion not found")
        return row

    # ── Suggestions from similar historical jobs ──────────────────────────────

    async def get_suggestions(self, job_id: uuid.UUID) -> SuggestionsResponse:
        """
        Find similar closed jobs via pgvector cosine similarity,
        then surface criteria from those jobs not already on this job.
        Returns empty suggestions (has_enough_history=False) if < 5 closed jobs exist.
        """
        job = await self._get_job(job_id)

        # Check minimum history requirement
        closed_count_result = await self.db.execute(
            text("SELECT COUNT(*) FROM jobs WHERE status = 'closed'")
        )
        closed_count = closed_count_result.scalar_one()
        if closed_count < 5:
            return SuggestionsResponse(
                job_id=job_id,
                suggestions=[],
                similar_jobs_found=0,
                has_enough_history=False,
            )

        # Need an embedding to do similarity search
        if job.jd_embedding is None:
            return SuggestionsResponse(
                job_id=job_id,
                suggestions=[],
                similar_jobs_found=0,
                has_enough_history=True,
            )

        # Find similar closed jobs (cosine similarity >= 0.7)
        similar_result = await self.db.execute(
            text("""
                SELECT id, title,
                       1 - (jd_embedding <=> :vec::vector) AS similarity
                FROM jobs
                WHERE status = 'closed'
                  AND id != :job_id
                  AND jd_embedding IS NOT NULL
                  AND 1 - (jd_embedding <=> :vec::vector) >= 0.7
                ORDER BY similarity DESC
                LIMIT 10
            """),
            {"vec": str(job.jd_embedding), "job_id": str(job_id)},
        )
        similar_jobs = similar_result.fetchall()

        if not similar_jobs:
            return SuggestionsResponse(
                job_id=job_id,
                suggestions=[],
                similar_jobs_found=0,
                has_enough_history=True,
            )

        # Get existing criteria names for this job (to avoid duplicates)
        existing = await self._get_criteria(job_id)
        existing_names = {c.criterion_name.lower() for c in existing}

        # Aggregate criteria from similar jobs
        similar_job_ids = [str(row.id) for row in similar_jobs]
        similarity_map = {str(row.id): float(row.similarity) for row in similar_jobs}
        title_map = {str(row.id): row.title for row in similar_jobs}

        criteria_result = await self.db.execute(
            text("""
                SELECT jc.criterion_name, jc.criterion_type, jc.weight,
                       jc.required, jc.extra_data, jc.job_id,
                       COUNT(*) OVER (PARTITION BY jc.criterion_name) AS usage_count
                FROM job_criteria jc
                WHERE jc.job_id = ANY(:ids::uuid[])
                ORDER BY usage_count DESC, jc.criterion_name
            """),
            {"ids": similar_job_ids},
        )
        all_criteria = criteria_result.fetchall()

        # Deduplicate and filter out already-existing criteria
        seen: set[str] = set()
        suggestions: list[CriteriaSuggestion] = []
        for row in all_criteria:
            name_lower = row.criterion_name.lower()
            if name_lower in existing_names or name_lower in seen:
                continue
            seen.add(name_lower)
            job_id_str = str(row.job_id)
            suggestions.append(CriteriaSuggestion(
                criterion_name=row.criterion_name,
                criterion_type=row.criterion_type,
                weight=row.weight,
                required=row.required,
                extra_data=row.extra_data,
                similarity_score=round(similarity_map.get(job_id_str, 0.0), 3),
                source_job_id=row.job_id,
                source_job_title=title_map.get(job_id_str, "Similar role"),
                usage_count=int(row.usage_count),
            ))
            if len(suggestions) >= 5:
                break

        return SuggestionsResponse(
            job_id=job_id,
            suggestions=suggestions,
            similar_jobs_found=len(similar_jobs),
            has_enough_history=True,
        )

    # ── Check if re-extraction needed ─────────────────────────────────────────

    async def needs_reextraction(self, job_id: uuid.UUID) -> bool:
        job = await self._get_job(job_id)
        if not job.criteria_extracted_at:
            return False  # never extracted — not a "re-extract" scenario
        new_hash = _hash_description(job.description)
        return job.description_hash != new_hash

    # ── Helpers ───────────────────────────────────────────────────────────────

    async def _get_job(self, job_id: uuid.UUID) -> Job:
        result = await self.db.execute(select(Job).where(Job.id == job_id))
        job = result.scalar_one_or_none()
        if not job:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
        return job

    async def _get_criteria(self, job_id: uuid.UUID) -> list[JobCriteria]:
        result = await self.db.execute(
            select(JobCriteria)
            .where(JobCriteria.job_id == job_id)
            .order_by(JobCriteria.criterion_type, JobCriteria.confidence_score.desc())
        )
        return list(result.scalars().all())

    def _result_to_rows(self, job_id: uuid.UUID, result: ExtractionResult) -> list[JobCriteria]:
        rows: list[JobCriteria] = []

        for s in result.skills:
            rows.append(JobCriteria(
                job_id=job_id,
                criterion_name=s.name,
                criterion_type="skill",
                weight=s.weight,
                required=s.required,
                confidence_score=Decimal(str(round(s.confidence, 2))),
                ai_extracted=True,
            ))

        for e in result.experience:
            rows.append(JobCriteria(
                job_id=job_id,
                criterion_name=e.description,
                criterion_type="experience",
                weight=e.weight,
                required=e.required,
                confidence_score=Decimal(str(round(e.confidence, 2))),
                ai_extracted=True,
                extra_data={"years_min": e.years_min} if e.years_min else None,
            ))

        for ed in result.education:
            rows.append(JobCriteria(
                job_id=job_id,
                criterion_name=ed.level,
                criterion_type="education",
                weight=ed.weight,
                required=ed.required,
                confidence_score=Decimal(str(round(ed.confidence, 2))),
                ai_extracted=True,
                extra_data={"field": ed.field} if ed.field else None,
            ))

        for c in result.certifications:
            rows.append(JobCriteria(
                job_id=job_id,
                criterion_name=c.name,
                criterion_type="certification",
                weight=c.weight,
                required=c.required,
                confidence_score=Decimal(str(round(c.confidence, 2))),
                ai_extracted=True,
            ))

        return rows

    async def _store_embedding(self, job_id: uuid.UUID, embedding: list[float]) -> None:
        """Store embedding vector in pgvector column."""
        vector_str = "[" + ",".join(str(v) for v in embedding) + "]"
        await self.db.execute(
            text("UPDATE jobs SET jd_embedding = :vec WHERE id = :id"),
            {"vec": vector_str, "id": str(job_id)},
        )

    def _queue_recalculation(self, job_id: uuid.UUID, triggered_by: str = "manual") -> None:
        """Dispatch a Celery task to re-embed the job and recompute all fit scores."""
        try:
            from app.tasks.score_tasks import recalculate_scores_for_job
            recalculate_scores_for_job.delay(str(job_id))
        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning(
                "Could not queue score recalculation for job %s: %s", job_id, exc
            )
