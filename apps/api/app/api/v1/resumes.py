import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.schemas.resume import (
    UploadUrlRequest,
    UploadUrlResponse,
    ParseTriggerRequest,
    ResumeUploadOut,
    BulkStatusResponse,
    CandidateOut,
)
from app.services.resume_service import ResumeService

router = APIRouter(prefix="/jobs/{job_id}/resumes", tags=["resumes"])


def get_resume_service(db: AsyncSession = Depends(get_db)) -> ResumeService:
    return ResumeService(db)


@router.post(
    "/upload-url",
    response_model=UploadUrlResponse,
    status_code=status.HTTP_201_CREATED,
)
async def get_upload_url(
    job_id: uuid.UUID,
    req: UploadUrlRequest,
    service: ResumeService = Depends(get_resume_service),
):
    """
    Request a presigned S3/MinIO PUT URL for direct browser upload.
    Creates a resume_upload record in 'queued' status.
    """
    return await service.create_upload_url(job_id, req)


@router.post("/{upload_id}/parse", response_model=ResumeUploadOut)
async def trigger_parse(
    job_id: uuid.UUID,
    upload_id: uuid.UUID,
    service: ResumeService = Depends(get_resume_service),
):
    """
    Trigger async parsing of an uploaded resume.
    Enqueues a Celery task; returns immediately with status='parsing'.
    """
    return await service.trigger_parse(job_id, upload_id)


@router.get("/status", response_model=BulkStatusResponse)
async def get_bulk_status(
    job_id: uuid.UUID,
    service: ResumeService = Depends(get_resume_service),
):
    """Get upload/parsing status for all resumes on a job."""
    return await service.get_bulk_status(job_id)


@router.get("/{upload_id}", response_model=ResumeUploadOut)
async def get_upload(
    job_id: uuid.UUID,
    upload_id: uuid.UUID,
    service: ResumeService = Depends(get_resume_service),
):
    """Get status of a single upload."""
    return await service.get_upload(job_id, upload_id)


@router.get("/{upload_id}/candidate", response_model=CandidateOut)
async def get_candidate(
    job_id: uuid.UUID,
    upload_id: uuid.UUID,
    service: ResumeService = Depends(get_resume_service),
):
    """Get the parsed candidate record for an upload (includes raw_resume_text)."""
    return await service.get_candidate(job_id, upload_id)


@router.post("/{upload_id}/reparse", response_model=ResumeUploadOut)
async def reparse_upload(
    job_id: uuid.UUID,
    upload_id: uuid.UUID,
    service: ResumeService = Depends(get_resume_service),
):
    """Re-trigger parsing for a completed or failed upload (e.g. if LLM was unavailable)."""
    return await service.reparse(job_id, upload_id)
