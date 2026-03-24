"""
Story 02.6: Duplicate candidate detection API.
GET  /duplicates/pending          — list pending flags (optionally scoped to job)
POST /duplicates/{id}/confirm     — confirm merge
POST /duplicates/{id}/dismiss     — dismiss flag
GET  /jobs/{job_id}/duplicates    — pending flags for a specific job
"""
import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.models.candidate import Candidate, DuplicateFlag

router = APIRouter(tags=["duplicates"])
jobs_router = APIRouter(tags=["duplicates"])  # mounted under /jobs

MOCK_REVIEWER_ID = None  # replace with real auth later


# ── Schemas ───────────────────────────────────────────────────────────────────

class CandidateSummary(BaseModel):
    id: uuid.UUID
    full_name: str | None
    email: str | None
    location: str | None

    model_config = {"from_attributes": True}


class DuplicateFlagOut(BaseModel):
    id: uuid.UUID
    candidate_id_a: uuid.UUID
    candidate_id_b: uuid.UUID
    job_id: uuid.UUID | None
    similarity_score: float | None
    detection_method: str
    status: str
    reviewed_at: datetime | None
    created_at: datetime
    candidate_a: CandidateSummary | None = None
    candidate_b: CandidateSummary | None = None

    model_config = {"from_attributes": True}


async def _enrich(flag: DuplicateFlag, db: AsyncSession) -> DuplicateFlagOut:
    ca_result = await db.execute(select(Candidate).where(Candidate.id == flag.candidate_id_a))
    cb_result = await db.execute(select(Candidate).where(Candidate.id == flag.candidate_id_b))
    ca = ca_result.scalar_one_or_none()
    cb = cb_result.scalar_one_or_none()
    out = DuplicateFlagOut.model_validate(flag)
    out.candidate_a = CandidateSummary.model_validate(ca) if ca else None
    out.candidate_b = CandidateSummary.model_validate(cb) if cb else None
    return out


async def _list_flags(db: AsyncSession, job_id: uuid.UUID | None = None) -> list[DuplicateFlag]:
    q = select(DuplicateFlag).where(DuplicateFlag.status == "pending")
    if job_id:
        q = q.where(DuplicateFlag.job_id == job_id)
    result = await db.execute(q.order_by(DuplicateFlag.created_at.desc()))
    return list(result.scalars().all())


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/duplicates/pending", response_model=list[DuplicateFlagOut])
async def list_pending(
    job_id: Annotated[uuid.UUID | None, Query()] = None,
    db: AsyncSession = Depends(get_db),
):
    flags = await _list_flags(db, job_id)
    return [await _enrich(f, db) for f in flags]


@router.post("/duplicates/{flag_id}/confirm", response_model=DuplicateFlagOut)
async def confirm_flag(flag_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DuplicateFlag).where(DuplicateFlag.id == flag_id))
    flag = result.scalar_one_or_none()
    if not flag:
        raise HTTPException(status_code=404, detail="Flag not found")
    if flag.status != "pending":
        raise HTTPException(status_code=400, detail="Flag is not pending")
    flag.status = "confirmed"
    flag.reviewed_at = __import__("datetime").datetime.utcnow()
    await db.flush()
    return await _enrich(flag, db)


@router.post("/duplicates/{flag_id}/dismiss", response_model=DuplicateFlagOut)
async def dismiss_flag(flag_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DuplicateFlag).where(DuplicateFlag.id == flag_id))
    flag = result.scalar_one_or_none()
    if not flag:
        raise HTTPException(status_code=404, detail="Flag not found")
    if flag.status != "pending":
        raise HTTPException(status_code=400, detail="Flag is not pending")
    flag.status = "dismissed"
    flag.reviewed_at = __import__("datetime").datetime.utcnow()
    await db.flush()
    return await _enrich(flag, db)


# ── Job-scoped route ──────────────────────────────────────────────────────────

@jobs_router.get("/jobs/{job_id}/duplicates", response_model=list[DuplicateFlagOut])
async def list_job_duplicates(job_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    flags = await _list_flags(db, job_id)
    return [await _enrich(f, db) for f in flags]
