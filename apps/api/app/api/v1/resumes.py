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


@router.delete("/{upload_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_upload(
    job_id: uuid.UUID,
    upload_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Delete a resume upload record (and its candidate if linked)."""
    from sqlalchemy import select, delete as _delete
    from app.models.candidate import ResumeUpload, Candidate

    row = await db.execute(
        select(ResumeUpload).where(ResumeUpload.id == upload_id, ResumeUpload.job_id == job_id)
    )
    upload = row.scalar_one_or_none()
    if not upload:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Upload not found")

    # Delete linked candidate if exists
    if upload.candidate_id:
        await db.execute(_delete(ResumeUpload).where(ResumeUpload.candidate_id == upload.candidate_id))
        cand = await db.execute(select(Candidate).where(Candidate.id == upload.candidate_id))
        c = cand.scalar_one_or_none()
        if c:
            await db.delete(c)
    else:
        await db.delete(upload)

    await db.commit()
