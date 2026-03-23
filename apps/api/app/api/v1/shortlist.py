"""
Shortlist API — Epic 05 (Stories 05.1, 05.2, 05.3)
"""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.services.shortlist_service import ShortlistService

router = APIRouter(prefix="/jobs", tags=["shortlist"])

_svc = ShortlistService()


# ── Schemas ───────────────────────────────────────────────────────────────────

class ShortlistConfigUpdate(BaseModel):
    n: int


class ShortlistAction(BaseModel):
    action: str  # accepted | rejected | deferred
    reason: Optional[str] = None


class BulkAction(BaseModel):
    shortlist_candidate_ids: list[uuid.UUID]
    action: str
    reason: Optional[str] = None


# ── Story 05.1: Generate & get shortlist ──────────────────────────────────────

@router.post("/{job_id}/shortlist/generate")
async def generate_shortlist(
    job_id: uuid.UUID,
    n: Optional[int] = Query(None, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """Generate or refresh the AI shortlist for a job."""
    result = await _svc.generate_shortlist(db, job_id, n=n)
    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result["detail"])
    return result


@router.get("/{job_id}/shortlist")
async def get_shortlist(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get the current shortlist for a job."""
    return await _svc.get_shortlist(db, job_id)


@router.patch("/{job_id}/shortlist/config")
async def update_shortlist_config(
    job_id: uuid.UUID,
    data: ShortlistConfigUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update the N threshold and regenerate the shortlist."""
    result = await _svc.update_config(db, job_id, n=data.n)
    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result["detail"])
    return result


# ── Story 05.2: Reasoning generation ─────────────────────────────────────────

@router.post("/{job_id}/shortlist/generate-all-reasoning")
async def generate_all_reasoning(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Batch generate LLM reasoning for all shortlisted candidates."""
    result = await _svc.generate_all_reasoning(db, job_id)
    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result["detail"])
    return result


@router.post("/{job_id}/shortlist/candidates/{sc_id}/reasoning")
async def generate_candidate_reasoning(
    job_id: uuid.UUID,
    sc_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Generate LLM reasoning for a single shortlist candidate."""
    result = await _svc.generate_reasoning_for_candidate(db, sc_id, job_id)
    if result.get("status") == "error":
        raise HTTPException(status_code=404, detail=result["detail"])
    return result


# ── Story 05.3: Accept / Reject / Defer ──────────────────────────────────────

@router.post("/{job_id}/shortlist/candidates/{sc_id}/action")
async def take_action(
    job_id: uuid.UUID,
    sc_id: uuid.UUID,
    data: ShortlistAction,
    db: AsyncSession = Depends(get_db),
):
    """Accept, reject, or defer a shortlist candidate."""
    result = await _svc.take_action(
        db, sc_id, job_id,
        action=data.action,
        reason=data.reason,
    )
    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result["detail"])
    return result


@router.post("/{job_id}/shortlist/bulk-action")
async def bulk_action(
    job_id: uuid.UUID,
    data: BulkAction,
    db: AsyncSession = Depends(get_db),
):
    """Bulk accept/reject/defer multiple shortlist candidates."""
    return await _svc.bulk_action(
        db, job_id,
        shortlist_candidate_ids=data.shortlist_candidate_ids,
        action=data.action,
        reason=data.reason,
    )


# ── Story 05.5: Near-miss candidates ─────────────────────────────────────────

@router.get("/{job_id}/shortlist/near-misses")
async def get_near_misses(
    job_id: uuid.UUID,
    window: float = Query(10.0, ge=1.0, le=50.0),
    db: AsyncSession = Depends(get_db),
):
    """Get candidates just below the shortlist threshold."""
    return await _svc.get_near_misses(db, job_id, window=window)


class PromoteNearMiss(BaseModel):
    candidate_id: uuid.UUID


@router.post("/{job_id}/shortlist/near-misses/promote")
async def promote_near_miss(
    job_id: uuid.UUID,
    data: PromoteNearMiss,
    db: AsyncSession = Depends(get_db),
):
    """Promote a near-miss candidate onto the shortlist."""
    result = await _svc.promote_near_miss(db, job_id, data.candidate_id)
    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result["detail"])
    return result


# ── Story 05.4: Feedback loop ─────────────────────────────────────────────────

@router.get("/{job_id}/shortlist/feedback/stats")
async def get_feedback_stats(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get feedback signal counts and current learned weights for a job."""
    return await _svc.get_feedback_stats(db, job_id)


@router.post("/{job_id}/shortlist/feedback/optimize")
async def optimize_weights(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Run weight optimization from collected feedback signals."""
    return await _svc.optimize_weights(db, job_id)


@router.post("/{job_id}/shortlist/feedback/reset")
async def reset_weights(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Reset learned weights and clear feedback signals."""
    return await _svc.reset_weights(db, job_id)
