"""
Resume upload service.
Handles presigned URL generation, upload record management, and status tracking.
Parsing is delegated to Celery tasks (Story 02.2+).
"""
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.candidate import ResumeUpload
from app.schemas.resume import (
    UploadUrlRequest,
    UploadUrlResponse,
    BulkStatusResponse,
    ResumeUploadOut,
    ALLOWED_EXTENSIONS,
    ALLOWED_CONTENT_TYPES,
    MAX_FILE_SIZE_BYTES,
)
from app.services.storage_service import generate_upload_url, build_file_key
from app.services import celery_app


class ResumeService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create_upload_url(
        self, job_id: uuid.UUID, req: UploadUrlRequest
    ) -> UploadUrlResponse:
        """Validate file, create upload record, return presigned PUT URL."""
        self._validate_file(req.file_name, req.file_size_bytes, req.content_type)

        upload_id = uuid.uuid4()
        file_key = build_file_key(str(job_id), str(upload_id), req.file_name)

        presigned_url = generate_upload_url(file_key, req.content_type, expires_in=300)

        row = ResumeUpload(
            id=upload_id,
            job_id=job_id,
            file_key=file_key,
            file_name=req.file_name,
            file_size_bytes=req.file_size_bytes,
            content_type=req.content_type,
            status="queued",
            applicant_name=req.applicant_name,
            applicant_email=req.applicant_email,
        )
        self.db.add(row)
        await self.db.flush()

        return UploadUrlResponse(
            upload_id=upload_id,
            presigned_url=presigned_url,
            file_key=file_key,
            expires_in=300,
        )

    async def trigger_parse(self, job_id: uuid.UUID, upload_id: uuid.UUID) -> ResumeUploadOut:
        """Mark upload as 'parsing' and enqueue Celery task."""
        row = await self._get_upload(job_id, upload_id)

        if row.status not in ("queued", "failed"):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Upload is already in status '{row.status}'",
            )

        row.status = "parsing"
        await self.db.flush()

        # Enqueue async parse task (implemented in Story 02.2)
        celery_app.send_task(
            "app.tasks.resume_tasks.parse_resume",
            args=[str(upload_id)],
        )

        return ResumeUploadOut.model_validate(row)

    async def get_bulk_status(self, job_id: uuid.UUID) -> BulkStatusResponse:
        result = await self.db.execute(
            select(ResumeUpload).where(ResumeUpload.job_id == job_id)
            .order_by(ResumeUpload.uploaded_at.desc())
        )
        uploads = list(result.scalars().all())

        counts = {"queued": 0, "uploading": 0, "parsing": 0, "completed": 0, "failed": 0}
        for u in uploads:
            counts[u.status] = counts.get(u.status, 0) + 1

        return BulkStatusResponse(
            job_id=job_id,
            total=len(uploads),
            **counts,
            uploads=[ResumeUploadOut.model_validate(u) for u in uploads],
        )

    async def get_upload(self, job_id: uuid.UUID, upload_id: uuid.UUID) -> ResumeUploadOut:
        row = await self._get_upload(job_id, upload_id)
        return ResumeUploadOut.model_validate(row)

    # ── helpers ───────────────────────────────────────────────────────────────

    async def _get_upload(self, job_id: uuid.UUID, upload_id: uuid.UUID) -> ResumeUpload:
        result = await self.db.execute(
            select(ResumeUpload).where(
                ResumeUpload.id == upload_id,
                ResumeUpload.job_id == job_id,
            )
        )
        row = result.scalar_one_or_none()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload not found")
        return row

    @staticmethod
    def _validate_file(file_name: str, file_size_bytes: int, content_type: str) -> None:
        ext = Path(file_name).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"File type '{ext}' not supported. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
            )
        if content_type not in ALLOWED_CONTENT_TYPES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Content type '{content_type}' not allowed.",
            )
        if file_size_bytes > MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"File exceeds 10MB limit ({file_size_bytes} bytes).",
            )

    async def get_candidate(self, job_id: uuid.UUID, upload_id: uuid.UUID):
        """Get the candidate record linked to an upload."""
        from app.models.candidate import Candidate
        row = await self._get_upload(job_id, upload_id)
        if not row.candidate_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No candidate record yet — resume may still be parsing",
            )
        result = await self.db.execute(
            select(Candidate).where(Candidate.id == row.candidate_id)
        )
        candidate = result.scalar_one_or_none()
        if not candidate:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")
        return candidate

    async def reparse(self, job_id: uuid.UUID, upload_id: uuid.UUID) -> ResumeUploadOut:
        """Reset a completed/failed upload and re-enqueue the parse task."""
        row = await self._get_upload(job_id, upload_id)

        if row.status == "parsing":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Upload is already being parsed",
            )

        row.status = "parsing"
        row.error_message = None
        await self.db.flush()

        celery_app.send_task(
            "app.tasks.resume_tasks.parse_resume",
            args=[str(upload_id)],
        )

        return ResumeUploadOut.model_validate(row)
