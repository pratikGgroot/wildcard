"""
Story 02.7: Parsing error handling service.
Manages the error queue, manual corrections, retries, and discard.
"""
import uuid
import logging
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.candidate import ParsingError, ParsingCorrection, ResumeUpload, Candidate
from app.schemas.resume import (
    ParsingErrorOut,
    ParsingErrorDetail,
    ResolveRequest,
    DiscardRequest,
    ParsingErrorStats,
)
from app.services import celery_app

logger = logging.getLogger(__name__)

MOCK_RESOLVER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
ERROR_RATE_THRESHOLD = 0.10


class ParsingErrorService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_errors(
        self,
        job_id: uuid.UUID | None = None,
        error_status: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[ParsingErrorOut]:
        q = select(ParsingError)
        if job_id:
            q = q.where(ParsingError.job_id == job_id)
        if error_status:
            q = q.where(ParsingError.status == error_status)
        q = q.order_by(ParsingError.created_at.desc()).limit(limit).offset(offset)

        result = await self.db.execute(q)
        errors = result.scalars().all()

        # Enrich with upload info
        out = []
        for e in errors:
            upload_res = await self.db.execute(
                select(ResumeUpload).where(ResumeUpload.id == e.upload_id)
            )
            upload = upload_res.scalar_one_or_none()
            item = ParsingErrorOut.model_validate(e)
            if upload:
                item.file_name = upload.file_name
                item.applicant_name = upload.applicant_name
            out.append(item)
        return out

    async def get_error(self, error_id: uuid.UUID) -> ParsingErrorDetail:
        result = await self.db.execute(
            select(ParsingError).where(ParsingError.id == error_id)
        )
        error = result.scalar_one_or_none()
        if not error:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parsing error not found")

        upload_res = await self.db.execute(
            select(ResumeUpload).where(ResumeUpload.id == error.upload_id)
        )
        upload = upload_res.scalar_one_or_none()

        detail = ParsingErrorDetail.model_validate(error)
        if upload:
            detail.file_name = upload.file_name
            detail.applicant_name = upload.applicant_name
            # Attach candidate if exists
            if upload.candidate_id:
                from app.schemas.resume import CandidateOut
                cand_res = await self.db.execute(
                    select(Candidate).where(Candidate.id == upload.candidate_id)
                )
                cand = cand_res.scalar_one_or_none()
                if cand:
                    detail.raw_resume_text = cand.raw_resume_text
                    detail.candidate = CandidateOut.model_validate(cand)
        return detail

    async def retry(self, error_id: uuid.UUID) -> ParsingErrorOut:
        error = await self._get_error(error_id)
        if error.status not in ("pending", "in_review"):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot retry error in status '{error.status}'",
            )

        # Reset upload status
        upload_res = await self.db.execute(
            select(ResumeUpload).where(ResumeUpload.id == error.upload_id)
        )
        upload = upload_res.scalar_one_or_none()
        if upload:
            upload.status = "parsing"
            upload.error_message = None

        error.status = "retrying"
        await self.db.flush()

        celery_app.send_task(
            "app.tasks.resume_tasks.parse_resume",
            args=[str(error.upload_id)],
        )

        return ParsingErrorOut.model_validate(error)

    async def resolve(self, error_id: uuid.UUID, req: ResolveRequest) -> ParsingErrorOut:
        """Manually correct candidate fields and mark error resolved."""
        error = await self._get_error(error_id)

        upload_res = await self.db.execute(
            select(ResumeUpload).where(ResumeUpload.id == error.upload_id)
        )
        upload = upload_res.scalar_one_or_none()

        # Get or create candidate
        candidate = None
        if upload and upload.candidate_id:
            cand_res = await self.db.execute(
                select(Candidate).where(Candidate.id == upload.candidate_id)
            )
            candidate = cand_res.scalar_one_or_none()

        if not candidate and upload:
            candidate = Candidate(
                id=uuid.uuid4(),
                resume_file_key=upload.file_key if upload else None,
                full_name=upload.applicant_name,
                email=upload.applicant_email,
            )
            self.db.add(candidate)
            await self.db.flush()
            if upload:
                upload.candidate_id = candidate.id
                upload.status = "completed"
                upload.completed_at = datetime.utcnow()

        # Apply corrections and log diffs
        corrections_to_log: list[tuple[str, str | None, str | None]] = []
        if candidate:
            field_map = {
                "full_name": req.full_name,
                "email": req.email,
                "phone": req.phone,
                "location": req.location,
            }
            for field, new_val in field_map.items():
                if new_val is not None:
                    old_val = getattr(candidate, field, None)
                    if old_val != new_val:
                        corrections_to_log.append((field, str(old_val) if old_val else None, new_val))
                        setattr(candidate, field, new_val)

            if req.skills:
                old_skills = (candidate.parsed_data or {}).get("skills", [])
                corrections_to_log.append(("skills", str(old_skills), str(req.skills)))
                candidate.parsed_data = {**(candidate.parsed_data or {}), "skills": req.skills, "manually_corrected": True}

        # Write correction audit log
        for field, old_val, new_val in corrections_to_log:
            correction = ParsingCorrection(
                parsing_error_id=error.id,
                corrected_by=MOCK_RESOLVER_ID,
                field_name=field,
                old_value=old_val,
                new_value=new_val,
            )
            self.db.add(correction)

        error.status = "resolved"
        error.resolved_by = MOCK_RESOLVER_ID
        error.resolved_at = datetime.utcnow()
        error.resolution_method = "manual"
        await self.db.flush()

        return ParsingErrorOut.model_validate(error)

    async def discard(self, error_id: uuid.UUID, req: DiscardRequest) -> ParsingErrorOut:
        error = await self._get_error(error_id)

        upload_res = await self.db.execute(
            select(ResumeUpload).where(ResumeUpload.id == error.upload_id)
        )
        upload = upload_res.scalar_one_or_none()
        if upload:
            upload.status = "failed"
            upload.error_message = f"Discarded: {req.reason}"

        error.status = "discarded"
        error.resolved_by = MOCK_RESOLVER_ID
        error.resolved_at = datetime.utcnow()
        error.resolution_method = "discard"
        error.discard_reason = req.reason
        await self.db.flush()

        return ParsingErrorOut.model_validate(error)

    async def get_stats(self, job_id: uuid.UUID | None = None) -> ParsingErrorStats:
        # Total uploads
        upload_q = select(func.count(ResumeUpload.id))
        if job_id:
            upload_q = upload_q.where(ResumeUpload.job_id == job_id)
        total = (await self.db.execute(upload_q)).scalar_one()

        # Failed uploads
        failed_q = select(func.count(ResumeUpload.id)).where(ResumeUpload.status == "failed")
        if job_id:
            failed_q = failed_q.where(ResumeUpload.job_id == job_id)
        failed = (await self.db.execute(failed_q)).scalar_one()

        # Error type breakdown
        error_q = select(ParsingError.error_type, func.count(ParsingError.id)).group_by(ParsingError.error_type)
        if job_id:
            error_q = error_q.where(ParsingError.job_id == job_id)
        type_rows = (await self.db.execute(error_q)).all()
        by_type = {row[0]: row[1] for row in type_rows}

        error_rate = (failed / total) if total > 0 else 0.0
        high_error_rate = error_rate > ERROR_RATE_THRESHOLD

        if high_error_rate:
            logger.warning(
                "HIGH PARSING ERROR RATE: %.0f%% (%d/%d) for job=%s",
                error_rate * 100, failed, total, job_id,
            )

        return ParsingErrorStats(
            job_id=job_id,
            total_uploads=total,
            failed=failed,
            error_rate=round(error_rate, 4),
            high_error_rate=high_error_rate,
            by_type=by_type,
        )

    async def _get_error(self, error_id: uuid.UUID) -> ParsingError:
        result = await self.db.execute(
            select(ParsingError).where(ParsingError.id == error_id)
        )
        error = result.scalar_one_or_none()
        if not error:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parsing error not found")
        return error
