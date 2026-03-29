"""
Candidates API — Stories 03.1, 03.2, 03.4, 03.6
"""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser
from app.db.base import get_db
from app.models.candidate import Candidate, CandidateDocument, CandidateNote, CandidateTag, ResumeUpload
from app.models.job import Job
from app.schemas.resume import CandidateOut
from app.services.storage_service import delete_object, generate_download_url, generate_upload_url
from app.services.embedding_service import EmbeddingService

router = APIRouter(prefix="/candidates", tags=["candidates"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class NoteCreate(BaseModel):
    content: str = Field(min_length=1, max_length=10_000)
    job_id: uuid.UUID | None = None


class NoteUpdate(BaseModel):
    content: str = Field(min_length=1, max_length=10_000)


class NoteOut(BaseModel):
    id: uuid.UUID
    candidate_id: uuid.UUID
    job_id: uuid.UUID | None
    author_id: uuid.UUID | None
    content: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TagCreate(BaseModel):
    tag: str = Field(min_length=1, max_length=50)


class TagOut(BaseModel):
    id: uuid.UUID
    tag: str
    added_at: datetime

    model_config = {"from_attributes": True}


class ApplicationOut(BaseModel):
    upload_id: str
    job_id: str
    job_title: str
    job_status: str
    status: str
    uploaded_at: str
    completed_at: str | None


# ── Profile ───────────────────────────────────────────────────────────────────

@router.get("/{candidate_id}", response_model=CandidateOut)
async def get_candidate(
    candidate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")
    return candidate


@router.get("/{candidate_id}/resume-url")
async def get_resume_url(
    candidate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")
    if not candidate.resume_file_key:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No resume file on record")
    url = generate_download_url(candidate.resume_file_key, expires_in=3600)
    return {"url": url, "expires_in": 3600}


# ── Application history (Story 03.4) ─────────────────────────────────────────

@router.get("/{candidate_id}/applications", response_model=list[ApplicationOut])
async def get_candidate_applications(
    candidate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get all job applications for a candidate, with job title and status."""
    result = await db.execute(
        select(ResumeUpload, Job.title, Job.status)
        .join(Job, ResumeUpload.job_id == Job.id)
        .where(ResumeUpload.candidate_id == candidate_id)
        .order_by(ResumeUpload.uploaded_at.desc())
    )
    rows = result.all()
    return [
        ApplicationOut(
            upload_id=str(u.id),
            job_id=str(u.job_id),
            job_title=job_title,
            job_status=job_status,
            status=u.status,
            uploaded_at=u.uploaded_at.isoformat(),
            completed_at=u.completed_at.isoformat() if u.completed_at else None,
        )
        for u, job_title, job_status in rows
    ]


# ── Notes (Story 03.2) ────────────────────────────────────────────────────────

@router.get("/{candidate_id}/notes", response_model=list[NoteOut])
async def list_notes(
    candidate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CandidateNote)
        .where(CandidateNote.candidate_id == candidate_id, CandidateNote.is_deleted == False)  # noqa: E712
        .order_by(CandidateNote.created_at.desc())
    )
    return result.scalars().all()


@router.post("/{candidate_id}/notes", response_model=NoteOut, status_code=status.HTTP_201_CREATED)
async def add_note(
    candidate_id: uuid.UUID,
    data: NoteCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    note = CandidateNote(
        candidate_id=candidate_id,
        job_id=data.job_id,
        author_id=current_user.id,
        content=data.content,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return note


@router.put("/{candidate_id}/notes/{note_id}", response_model=NoteOut)
async def update_note(
    candidate_id: uuid.UUID,
    note_id: uuid.UUID,
    data: NoteUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CandidateNote).where(
            CandidateNote.id == note_id,
            CandidateNote.candidate_id == candidate_id,
            CandidateNote.is_deleted == False,  # noqa: E712
        )
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    note.content = data.content
    note.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(note)
    return note


@router.delete("/{candidate_id}/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(
    candidate_id: uuid.UUID,
    note_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CandidateNote).where(
            CandidateNote.id == note_id,
            CandidateNote.candidate_id == candidate_id,
            CandidateNote.is_deleted == False,  # noqa: E712
        )
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    note.is_deleted = True
    await db.commit()


# ── Tags (Story 03.2) ─────────────────────────────────────────────────────────

@router.get("/{candidate_id}/tags", response_model=list[TagOut])
async def list_tags(
    candidate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CandidateTag)
        .where(CandidateTag.candidate_id == candidate_id)
        .order_by(CandidateTag.added_at)
    )
    return result.scalars().all()


@router.post("/{candidate_id}/tags", response_model=TagOut, status_code=status.HTTP_201_CREATED)
async def add_tag(
    candidate_id: uuid.UUID,
    data: TagCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    # Prevent duplicate tags on same candidate
    existing = await db.execute(
        select(CandidateTag).where(
            CandidateTag.candidate_id == candidate_id,
            CandidateTag.tag == data.tag.strip().lower(),
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Tag already exists")
    tag = CandidateTag(
        candidate_id=candidate_id,
        tag=data.tag.strip().lower(),
        added_by=current_user.id,
    )
    db.add(tag)
    await db.commit()
    await db.refresh(tag)
    return tag


@router.delete("/{candidate_id}/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_tag(
    candidate_id: uuid.UUID,
    tag_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CandidateTag).where(
            CandidateTag.id == tag_id,
            CandidateTag.candidate_id == candidate_id,
        )
    )
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")
    await db.delete(tag)
    await db.commit()


# ── Documents (Story 03.6) ────────────────────────────────────────────────────

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "image/png",
    "image/jpeg",
}
ALLOWED_DOC_TYPES = {"cover_letter", "portfolio", "certificate", "other"}
MAX_DOC_SIZE = 10 * 1024 * 1024  # 10 MB
MAX_DOCS_PER_CANDIDATE = 20


class DocumentOut(BaseModel):
    id: uuid.UUID
    candidate_id: uuid.UUID
    file_name: str
    doc_type: str
    file_size_bytes: int | None
    mime_type: str | None
    uploaded_at: datetime

    model_config = {"from_attributes": True}


class DocumentUploadUrlRequest(BaseModel):
    file_name: str = Field(min_length=1, max_length=255)
    file_size_bytes: int = Field(gt=0, le=MAX_DOC_SIZE)
    mime_type: str
    doc_type: str = "other"


class DocumentUploadUrlResponse(BaseModel):
    document_id: uuid.UUID
    presigned_url: str
    expires_in: int = 300


@router.get("/{candidate_id}/documents", response_model=list[DocumentOut])
async def list_documents(
    candidate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CandidateDocument)
        .where(CandidateDocument.candidate_id == candidate_id, CandidateDocument.is_deleted == False)  # noqa: E712
        .order_by(CandidateDocument.uploaded_at.desc())
    )
    return result.scalars().all()


@router.post("/{candidate_id}/documents/upload-url", response_model=DocumentUploadUrlResponse, status_code=status.HTTP_201_CREATED)
async def get_document_upload_url(
    candidate_id: uuid.UUID,
    data: DocumentUploadUrlRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Get a presigned PUT URL for uploading a candidate document."""
    if data.mime_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {data.mime_type}")
    if data.doc_type not in ALLOWED_DOC_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid doc_type. Must be one of: {', '.join(ALLOWED_DOC_TYPES)}")

    # Check candidate exists
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Check document count limit
    count_result = await db.execute(
        select(CandidateDocument)
        .where(CandidateDocument.candidate_id == candidate_id, CandidateDocument.is_deleted == False)  # noqa: E712
    )
    if len(count_result.scalars().all()) >= MAX_DOCS_PER_CANDIDATE:
        raise HTTPException(status_code=400, detail="Maximum document limit (20) reached")

    doc_id = uuid.uuid4()
    file_key = f"candidate-docs/{candidate_id}/{doc_id}/{data.file_name}"

    doc = CandidateDocument(
        id=doc_id,
        candidate_id=candidate_id,
        file_name=data.file_name,
        doc_type=data.doc_type,
        file_key=file_key,
        file_size_bytes=data.file_size_bytes,
        mime_type=data.mime_type,
        uploaded_by=current_user.id,
    )
    db.add(doc)
    await db.commit()

    presigned_url = generate_upload_url(file_key, data.mime_type, expires_in=300)
    return DocumentUploadUrlResponse(document_id=doc_id, presigned_url=presigned_url)


@router.get("/{candidate_id}/documents/{document_id}/url")
async def get_document_url(
    candidate_id: uuid.UUID,
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CandidateDocument).where(
            CandidateDocument.id == document_id,
            CandidateDocument.candidate_id == candidate_id,
            CandidateDocument.is_deleted == False,  # noqa: E712
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    url = generate_download_url(doc.file_key, expires_in=3600)
    return {"url": url, "expires_in": 3600, "mime_type": doc.mime_type, "file_name": doc.file_name}


@router.delete("/{candidate_id}/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    candidate_id: uuid.UUID,
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CandidateDocument).where(
            CandidateDocument.id == document_id,
            CandidateDocument.candidate_id == candidate_id,
            CandidateDocument.is_deleted == False,  # noqa: E712
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    doc.is_deleted = True
    await db.commit()

# ── Embeddings (Story 04.1) ───────────────────────────────────────────────────

_embedding_service = EmbeddingService()


@router.post("/{candidate_id}/embed")
async def trigger_candidate_embedding(
    candidate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Trigger embedding generation for a candidate profile."""
    result = await _embedding_service.embed_candidate(db, candidate_id)
    if result.get("status") == "error":
        raise HTTPException(status_code=404, detail=result["detail"])
    return result


@router.get("/{candidate_id}/embedding-status")
async def get_embedding_status(
    candidate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Check embedding status for a candidate."""
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    embedding = await _embedding_service.get_candidate_embedding(db, candidate_id)
    return {
        "candidate_id": str(candidate_id),
        "embedding_status": candidate.embedding_status or ("completed" if embedding else "pending"),
        "has_embedding": embedding is not None,
        "dims": len(embedding) if embedding else None,
    }


# ── Fit scoring (Story 04.2) ──────────────────────────────────────────────────

from app.services.fit_score_service import FitScoreService as _FitScoreService

_fit_score_service = _FitScoreService()


@router.post("/{candidate_id}/score/{job_id}")
async def score_candidate_for_job(
    candidate_id: uuid.UUID,
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Compute fit score for one candidate against one job."""
    result = await _fit_score_service.score_candidate_for_job(db, candidate_id, job_id)
    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result["detail"])
    return result


@router.get("/{candidate_id}/scores")
async def get_candidate_scores(
    candidate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get all fit scores for a candidate across jobs."""
    return await _fit_score_service.get_candidate_scores(db, candidate_id)


@router.get("/{candidate_id}/score/{job_id}/explain")
async def explain_fit_score(
    candidate_id: uuid.UUID,
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get a detailed breakdown of why a candidate scored the way they did for a job."""
    result = await _fit_score_service.explain_fit(db, candidate_id, job_id)
    if result.get("error"):
        raise HTTPException(status_code=404, detail=result["error"])
    return result


# ── Score override (Story 04.5) ───────────────────────────────────────────────

class ScoreOverrideRequest(BaseModel):
    override_score: float = Field(ge=0, le=100)
    justification: str = Field(min_length=10, max_length=2000)


@router.post("/{candidate_id}/score/{job_id}/override")
async def override_fit_score(
    candidate_id: uuid.UUID,
    job_id: uuid.UUID,
    data: ScoreOverrideRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Manually override the AI fit score with a justification."""
    from sqlalchemy import text as _text
    from datetime import datetime

    # Fetch current score row
    row = await db.execute(
        _text("""
            SELECT id, fit_score FROM fit_scores
            WHERE candidate_id = :cid AND job_id = :jid AND is_current = true
            LIMIT 1
        """),
        {"cid": str(candidate_id), "jid": str(job_id)},
    )
    rec = row.fetchone()
    if not rec:
        raise HTTPException(status_code=404, detail="No fit score found — run scoring first")

    await db.execute(
        _text("""
            UPDATE fit_scores
            SET is_overridden = true,
                override_score = :os,
                override_justification = :just,
                overridden_by = :by,
                overridden_at = :at,
                original_ai_score = COALESCE(original_ai_score, fit_score)
            WHERE id = :id
        """),
        {
            "os": data.override_score,
            "just": data.justification,
            "by": str(current_user.id),
            "at": datetime.utcnow(),
            "id": str(rec[0]),
        },
    )
    await db.commit()

    return {
        "status": "overridden",
        "candidate_id": str(candidate_id),
        "job_id": str(job_id),
        "original_ai_score": rec[1],
        "override_score": data.override_score,
        "justification": data.justification,
    }


@router.delete("/{candidate_id}/score/{job_id}/override", status_code=status.HTTP_200_OK)
async def reset_fit_score_override(
    candidate_id: uuid.UUID,
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Reset a manual override — restores the original AI score."""
    from sqlalchemy import text as _text

    row = await db.execute(
        _text("""
            SELECT id, original_ai_score FROM fit_scores
            WHERE candidate_id = :cid AND job_id = :jid AND is_current = true AND is_overridden = true
            LIMIT 1
        """),
        {"cid": str(candidate_id), "jid": str(job_id)},
    )
    rec = row.fetchone()
    if not rec:
        raise HTTPException(status_code=404, detail="No active override found")

    await db.execute(
        _text("""
            UPDATE fit_scores
            SET is_overridden = false,
                override_score = NULL,
                override_justification = NULL,
                overridden_by = NULL,
                overridden_at = NULL
            WHERE id = :id
        """),
        {"id": str(rec[0])},
    )
    await db.commit()

    return {
        "status": "reset",
        "candidate_id": str(candidate_id),
        "job_id": str(job_id),
        "restored_ai_score": rec[1],
    }


# ── Delete candidate ──────────────────────────────────────────────────────────

@router.delete("/{candidate_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_candidate(
    candidate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Hard-delete a candidate, their resume uploads, and all related data (cascade)."""
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")
    # Delete resume uploads that reference this candidate (not cascade-deleted automatically)
    await db.execute(
        select(ResumeUpload).where(ResumeUpload.candidate_id == candidate_id)
    )
    from sqlalchemy import delete as _delete
    await db.execute(_delete(ResumeUpload).where(ResumeUpload.candidate_id == candidate_id))
    await db.delete(candidate)
    await db.commit()
