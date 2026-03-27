"""Pipeline API — stage config, candidate movement, bulk actions, audit (Epic 09)."""
import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, RecruiterOrAbove, get_current_user
from app.db.base import get_db
from app.models.user import User
from app.services.pipeline_service import PipelineService

router = APIRouter(tags=["pipeline"])


def get_svc(db: AsyncSession = Depends(get_db)) -> PipelineService:
    return PipelineService(db)


# ── Schemas ───────────────────────────────────────────────────────────────────

class StageOut(BaseModel):
    id: uuid.UUID
    job_id: uuid.UUID
    name: str
    order: int
    color: str | None
    is_terminal: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class StageCreate(BaseModel):
    name: str
    order: int
    color: str | None = None
    is_terminal: bool = False


class StageUpdate(BaseModel):
    name: str | None = None
    order: int | None = None
    color: str | None = None
    is_terminal: bool | None = None


class ReorderRequest(BaseModel):
    stage_ids: list[uuid.UUID]


class MoveCandidateRequest(BaseModel):
    candidate_id: uuid.UUID
    stage_id: uuid.UUID
    note: str | None = None


class BulkMoveRequest(BaseModel):
    candidate_ids: list[uuid.UUID]
    stage_id: uuid.UUID
    note: str | None = None


class PlacementOut(BaseModel):
    id: uuid.UUID
    candidate_id: uuid.UUID
    job_id: uuid.UUID
    stage_id: uuid.UUID | None
    moved_by: uuid.UUID | None
    moved_at: datetime
    model_config = {"from_attributes": True}


class AuditEntryOut(BaseModel):
    id: uuid.UUID
    candidate_id: uuid.UUID
    job_id: uuid.UUID
    from_stage_id: uuid.UUID | None
    to_stage_id: uuid.UUID | None
    moved_by: uuid.UUID | None
    note: str | None
    moved_at: datetime
    model_config = {"from_attributes": True}


# ── Stage config (09.1) ───────────────────────────────────────────────────────

@router.get("/jobs/{job_id}/pipeline/stages", response_model=list[StageOut])
async def list_stages(
    job_id: uuid.UUID,
    _: RecruiterOrAbove,
    svc: PipelineService = Depends(get_svc),
):
    stages = await svc.get_stages(job_id)
    if not stages:
        stages = await svc.init_default_stages(job_id)
    return stages


@router.post("/jobs/{job_id}/pipeline/stages", response_model=StageOut, status_code=status.HTTP_201_CREATED)
async def create_stage(
    job_id: uuid.UUID,
    body: StageCreate,
    _: RecruiterOrAbove,
    svc: PipelineService = Depends(get_svc),
):
    return await svc.create_stage(job_id, body.name, body.order, body.color, body.is_terminal)


@router.put("/jobs/{job_id}/pipeline/stages/{stage_id}", response_model=StageOut)
async def update_stage(
    job_id: uuid.UUID,
    stage_id: uuid.UUID,
    body: StageUpdate,
    _: RecruiterOrAbove,
    svc: PipelineService = Depends(get_svc),
):
    return await svc.update_stage(job_id, stage_id, body.name, body.order, body.color, body.is_terminal)


@router.delete("/jobs/{job_id}/pipeline/stages/{stage_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_stage(
    job_id: uuid.UUID,
    stage_id: uuid.UUID,
    _: RecruiterOrAbove,
    svc: PipelineService = Depends(get_svc),
):
    await svc.delete_stage(job_id, stage_id)


@router.post("/jobs/{job_id}/pipeline/stages/reorder", response_model=list[StageOut])
async def reorder_stages(
    job_id: uuid.UUID,
    body: ReorderRequest,
    _: RecruiterOrAbove,
    svc: PipelineService = Depends(get_svc),
):
    return await svc.reorder_stages(job_id, body.stage_ids)


# ── Pipeline board (09.1) ─────────────────────────────────────────────────────

@router.get("/jobs/{job_id}/pipeline")
async def get_pipeline(
    job_id: uuid.UUID,
    _: RecruiterOrAbove,
    svc: PipelineService = Depends(get_svc),
):
    """Return all stages with their candidates — the Kanban board data."""
    return await svc.get_pipeline(job_id)


# ── Move candidate (09.1) ─────────────────────────────────────────────────────

@router.post("/jobs/{job_id}/pipeline/move", response_model=PlacementOut)
async def move_candidate(
    job_id: uuid.UUID,
    body: MoveCandidateRequest,
    current_user: CurrentUser,
    svc: PipelineService = Depends(get_svc),
):
    return await svc.move_candidate(job_id, body.candidate_id, body.stage_id, current_user.id, body.note)


# ── Bulk move (09.4) ──────────────────────────────────────────────────────────

@router.post("/jobs/{job_id}/pipeline/bulk-move")
async def bulk_move(
    job_id: uuid.UUID,
    body: BulkMoveRequest,
    current_user: CurrentUser,
    svc: PipelineService = Depends(get_svc),
):
    return await svc.bulk_move(job_id, body.candidate_ids, body.stage_id, current_user.id, body.note)


# ── Audit log (09.7) ──────────────────────────────────────────────────────────

@router.get("/jobs/{job_id}/pipeline/audit", response_model=list[AuditEntryOut])
async def get_audit_log(
    job_id: uuid.UUID,
    _: RecruiterOrAbove,
    candidate_id: uuid.UUID | None = None,
    svc: PipelineService = Depends(get_svc),
):
    return await svc.get_audit_log(job_id, candidate_id)
