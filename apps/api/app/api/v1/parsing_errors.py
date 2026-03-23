"""
Story 02.7: Parsing error queue API.
"""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.schemas.resume import (
    ParsingErrorOut,
    ParsingErrorDetail,
    ResolveRequest,
    DiscardRequest,
    ParsingErrorStats,
)
from app.services.parsing_error_service import ParsingErrorService

router = APIRouter(prefix="/parsing-errors", tags=["parsing-errors"])


def get_service(db: AsyncSession = Depends(get_db)) -> ParsingErrorService:
    return ParsingErrorService(db)


@router.get("", response_model=list[ParsingErrorOut])
async def list_errors(
    job_id: Optional[uuid.UUID] = Query(default=None),
    status: Optional[str] = Query(default=None),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0),
    service: ParsingErrorService = Depends(get_service),
):
    return await service.list_errors(job_id=job_id, error_status=status, limit=limit, offset=offset)


@router.get("/stats", response_model=ParsingErrorStats)
async def get_stats(
    job_id: Optional[uuid.UUID] = Query(default=None),
    service: ParsingErrorService = Depends(get_service),
):
    return await service.get_stats(job_id=job_id)


@router.get("/{error_id}", response_model=ParsingErrorDetail)
async def get_error(
    error_id: uuid.UUID,
    service: ParsingErrorService = Depends(get_service),
):
    return await service.get_error(error_id)


@router.post("/{error_id}/retry", response_model=ParsingErrorOut)
async def retry_error(
    error_id: uuid.UUID,
    service: ParsingErrorService = Depends(get_service),
):
    return await service.retry(error_id)


@router.post("/{error_id}/resolve", response_model=ParsingErrorOut)
async def resolve_error(
    error_id: uuid.UUID,
    req: ResolveRequest,
    service: ParsingErrorService = Depends(get_service),
):
    return await service.resolve(error_id, req)


@router.post("/{error_id}/discard", response_model=ParsingErrorOut)
async def discard_error(
    error_id: uuid.UUID,
    req: DiscardRequest,
    service: ParsingErrorService = Depends(get_service),
):
    return await service.discard(error_id, req)
