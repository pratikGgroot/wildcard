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
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.models.candidate import Candidate, DuplicateFlag
from app.services.duplicate_service import DuplicateDetectionService

router = APIRouter(tags=["duplicates"])
jobs_router = APIRouter(tags=["duplicates"])  # mounted under /jobs

_svc = DuplicateDetectionService()

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


def _enrich(flag: DuplicateFlag, db: Session) -> DuplicateFlagOut:
    ca = db.get(Candidate, flag.candidate_id_a)
    cb = db.get(Candidate, flag.candidate_id_b)
    out = DuplicateFlagOut.model_validate(flag)
    out.candidate_a = CandidateSummary.model_validate(ca) if ca else None
    out.candidate_b = CandidateSummary.model_validate(cb) if cb else None
    return out


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/duplicates/pending", response_model=list[DuplicateFlagOut])
def list_pending(
    job_id: Annotated[uuid.UUID | None, Query()] = None,
    db: Session = Depends(get_db),
):
    flags = _svc.list_pending_flags(db, job_id)
    return [_enrich(f, db) for f in flags]


@router.post("/duplicates/{flag_id}/confirm", response_model=DuplicateFlagOut)
def confirm_flag(flag_id: uuid.UUID, db: Session = Depends(get_db)):
    try:
        flag = _svc.confirm_duplicate(db, flag_id, MOCK_REVIEWER_ID)
        db.commit()
        return _enrich(flag, db)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post("/duplicates/{flag_id}/dismiss", response_model=DuplicateFlagOut)
def dismiss_flag(flag_id: uuid.UUID, db: Session = Depends(get_db)):
    try:
        flag = _svc.dismiss_duplicate(db, flag_id, MOCK_REVIEWER_ID)
        db.commit()
        return _enrich(flag, db)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


# ── Job-scoped route ──────────────────────────────────────────────────────────

@jobs_router.get("/jobs/{job_id}/duplicates", response_model=list[DuplicateFlagOut])
def list_job_duplicates(job_id: uuid.UUID, db: Session = Depends(get_db)):
    flags = _svc.list_pending_flags(db, job_id)
    return [_enrich(f, db) for f in flags]
