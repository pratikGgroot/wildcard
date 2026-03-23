import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.schemas.criteria import CriteriaCreate, CriteriaOut, CriteriaUpdate, ExtractionResponse, SuggestionsResponse
from app.schemas.job import (
    AssignmentCreate,
    AssignmentOut,
    JobCreate,
    JobOut,
    JobStatusChange,
    JobUpdate,
    PaginatedJobs,
    StatusHistoryOut,
)
from app.services.criteria_service import CriteriaService
from app.services.job_service import JobService

router = APIRouter(prefix="/jobs", tags=["jobs"])


def get_job_service(db: AsyncSession = Depends(get_db)) -> JobService:
    return JobService(db)


def get_criteria_service(db: AsyncSession = Depends(get_db)) -> CriteriaService:
    return CriteriaService(db)


# Temporary: no auth until Epic 12 — created_by will be None
MOCK_USER_ID: uuid.UUID | None = None


@router.post("", response_model=JobOut, status_code=status.HTTP_201_CREATED)
async def create_job(
    data: JobCreate,
    service: JobService = Depends(get_job_service),
    db: AsyncSession = Depends(get_db),
):
    """Create a new job posting (saved as draft). Auto-extracts criteria in background."""
    import asyncio
    job = await service.create_job(data, created_by=MOCK_USER_ID)
    # Fire-and-forget criteria extraction (only if no template criteria already copied)
    if not data.template_id:
        criteria_svc = CriteriaService(db)
        asyncio.create_task(criteria_svc.extract_criteria(job.id))
    return job


@router.get("", response_model=PaginatedJobs)
async def list_jobs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = Query(None),
    department: str | None = Query(None),
    service: JobService = Depends(get_job_service),
):
    """List all jobs with optional filters."""
    items, total = await service.list_jobs(page, page_size, status, department)
    return PaginatedJobs(items=items, total=total, page=page, page_size=page_size)


@router.get("/{job_id}", response_model=JobOut)
async def get_job(
    job_id: uuid.UUID,
    service: JobService = Depends(get_job_service),
):
    """Get a single job by ID."""
    return await service.get_job(job_id)


@router.put("/{job_id}", response_model=JobOut)
async def update_job(
    job_id: uuid.UUID,
    data: JobUpdate,
    service: JobService = Depends(get_job_service),
    db: AsyncSession = Depends(get_db),
):
    """Update job fields. Auto-re-extracts criteria in background if description changed."""
    import asyncio
    job = await service.update_job(job_id, data)
    if data.description is not None:
        criteria_svc = CriteriaService(db)
        asyncio.create_task(criteria_svc.extract_criteria(job_id))
    return job


@router.patch("/{job_id}/status", response_model=JobOut)
async def change_job_status(
    job_id: uuid.UUID,
    data: JobStatusChange,
    service: JobService = Depends(get_job_service),
):
    """Change job status following the state machine rules."""
    return await service.change_status(job_id, data, changed_by=MOCK_USER_ID)


@router.post(
    "/{job_id}/assignments",
    response_model=AssignmentOut,
    status_code=status.HTTP_201_CREATED,
)
async def add_assignment(
    job_id: uuid.UUID,
    data: AssignmentCreate,
    service: JobService = Depends(get_job_service),
):
    """Assign a recruiter or hiring manager to a job."""
    return await service.add_assignment(job_id, data)


@router.delete("/{job_id}/assignments/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_assignment(
    job_id: uuid.UUID,
    user_id: uuid.UUID,
    service: JobService = Depends(get_job_service),
):
    """Remove a user assignment from a job."""
    await service.remove_assignment(job_id, user_id)


@router.get("/{job_id}/status-history", response_model=list[StatusHistoryOut])
async def get_status_history(
    job_id: uuid.UUID,
    service: JobService = Depends(get_job_service),
):
    """Get the full status change history for a job."""
    return await service.get_status_history(job_id)


# ── Criteria extraction ───────────────────────────────────────────────────────

@router.post("/{job_id}/extract-criteria", response_model=ExtractionResponse)
async def extract_criteria(
    job_id: uuid.UUID,
    service: CriteriaService = Depends(get_criteria_service),
):
    """
    Trigger AI extraction of screening criteria from the job description.
    Uses hash-based caching — skips LLM call if description unchanged.
    """
    return await service.extract_criteria(job_id)


@router.get("/{job_id}/criteria", response_model=list[CriteriaOut])
async def get_criteria(
    job_id: uuid.UUID,
    service: CriteriaService = Depends(get_criteria_service),
):
    """Get all extracted criteria for a job."""
    return await service.get_criteria(job_id)


@router.get("/{job_id}/criteria/needs-reextraction")
async def needs_reextraction(
    job_id: uuid.UUID,
    service: CriteriaService = Depends(get_criteria_service),
):
    """Check if the description has changed since last extraction."""
    needs = await service.needs_reextraction(job_id)
    return {"needs_reextraction": needs}


@router.post(
    "/{job_id}/criteria",
    response_model=CriteriaOut,
    status_code=status.HTTP_201_CREATED,
)
async def add_criterion(
    job_id: uuid.UUID,
    data: CriteriaCreate,
    service: CriteriaService = Depends(get_criteria_service),
):
    """Manually add a new criterion to a job."""
    return await service.add_criterion(job_id, data)


@router.put("/{job_id}/criteria/{criterion_id}", response_model=CriteriaOut)
async def update_criterion(
    job_id: uuid.UUID,
    criterion_id: uuid.UUID,
    data: CriteriaUpdate,
    service: CriteriaService = Depends(get_criteria_service),
):
    """Update an existing criterion."""
    return await service.update_criterion(job_id, criterion_id, data)


@router.delete("/{job_id}/criteria/{criterion_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_criterion(
    job_id: uuid.UUID,
    criterion_id: uuid.UUID,
    service: CriteriaService = Depends(get_criteria_service),
):
    """Delete a criterion."""
    await service.delete_criterion(job_id, criterion_id)


@router.get("/{job_id}/criteria-suggestions", response_model=SuggestionsResponse)
async def get_criteria_suggestions(
    job_id: uuid.UUID,
    service: CriteriaService = Depends(get_criteria_service),
):
    """
    Suggest criteria from similar historical closed jobs using pgvector similarity.
    Returns has_enough_history=False when < 5 closed jobs exist.
    """
    return await service.get_suggestions(job_id)

# ── Job embeddings (Story 04.1) ───────────────────────────────────────────────

from app.services.embedding_service import EmbeddingService as _EmbeddingService

_job_embedder = _EmbeddingService()


@router.post("/{job_id}/embed")
async def trigger_job_embedding(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Trigger embedding generation for a job (title + description + criteria)."""
    result = await _job_embedder.embed_job(db, job_id)
    if result.get("status") == "error":
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=result["detail"])
    return result


# ── Fit scoring (Story 04.2) ──────────────────────────────────────────────────

from fastapi import HTTPException
from app.services.fit_score_service import FitScoreService as _FitScoreService

_fit_scorer = _FitScoreService()


@router.post("/{job_id}/score-all")
async def score_all_candidates(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Compute fit scores for all candidates who applied to this job."""
    return await _fit_scorer.score_all_for_job(db, job_id)


@router.get("/{job_id}/rankings")
async def get_candidate_rankings(
    job_id: uuid.UUID,
    sort_by: str = "fit",
    db: AsyncSession = Depends(get_db),
):
    """Return candidates ranked by fit score for this job.
    sort_by: 'fit' (default), 'technical', 'culture', 'growth'
    """
    return await _fit_scorer.get_rankings(db, job_id, sort_by=sort_by)


# ── Score recalculation (Story 04.4) ─────────────────────────────────────────

from sqlalchemy import text as _text


@router.post("/{job_id}/recalculate-scores")
async def trigger_recalculation(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Manually trigger score recalculation for all candidates on this job."""
    from app.tasks.score_tasks import recalculate_scores_for_job

    # Upsert a pending record so the UI can show the banner immediately
    await db.execute(
        _text("""
            INSERT INTO score_recalculation_jobs (job_id, status, started_at, triggered_by)
            VALUES (:jid, 'pending', now(), 'manual')
            ON CONFLICT (job_id) DO UPDATE
              SET status = 'pending', started_at = now(), completed_at = NULL,
                  total = 0, scored = 0, errors = 0, triggered_by = 'manual'
        """),
        {"jid": str(job_id)},
    )
    await db.commit()

    recalculate_scores_for_job.delay(str(job_id))
    return {"status": "queued", "job_id": str(job_id)}


@router.get("/{job_id}/recalculation-status")
async def get_recalculation_status(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get the current recalculation status for a job."""
    row = await db.execute(
        _text("""
            SELECT status, total, scored, errors, started_at, completed_at, triggered_by
            FROM score_recalculation_jobs
            WHERE job_id = :jid
        """),
        {"jid": str(job_id)},
    )
    rec = row.fetchone()
    if not rec:
        return {"status": "idle", "job_id": str(job_id)}

    return {
        "job_id": str(job_id),
        "status": rec[0],
        "total": rec[1],
        "scored": rec[2],
        "errors": rec[3],
        "started_at": rec[4].isoformat() if rec[4] else None,
        "completed_at": rec[5].isoformat() if rec[5] else None,
        "triggered_by": rec[6],
        "progress_pct": round(rec[2] / rec[1] * 100) if rec[1] else 0,
    }
