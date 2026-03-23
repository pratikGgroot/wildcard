import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.schemas.template import (
    SaveAsTemplateRequest, TemplateCreate, TemplateData,
    TemplateOut, TemplateUpdate,
)
from app.services.template_service import TemplateService

router = APIRouter(prefix="/templates", tags=["templates"])

MOCK_USER_ID: uuid.UUID | None = None


def get_service(db: AsyncSession = Depends(get_db)) -> TemplateService:
    return TemplateService(db)


@router.get("", response_model=list[TemplateOut])
async def list_templates(
    search: str | None = Query(None),
    department: str | None = Query(None),
    service: TemplateService = Depends(get_service),
):
    return await service.list_templates(MOCK_USER_ID, search, department)


@router.post("", response_model=TemplateOut, status_code=status.HTTP_201_CREATED)
async def create_template(
    data: TemplateCreate,
    service: TemplateService = Depends(get_service),
):
    return await service.create_template(data, MOCK_USER_ID)


@router.get("/{template_id}", response_model=TemplateOut)
async def get_template(
    template_id: uuid.UUID,
    service: TemplateService = Depends(get_service),
):
    return await service.get_template(template_id)


@router.put("/{template_id}", response_model=TemplateOut)
async def update_template(
    template_id: uuid.UUID,
    data: TemplateUpdate,
    service: TemplateService = Depends(get_service),
):
    return await service.update_template(template_id, data, MOCK_USER_ID)


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: uuid.UUID,
    service: TemplateService = Depends(get_service),
):
    await service.delete_template(template_id, MOCK_USER_ID)


@router.get("/{template_id}/apply", response_model=TemplateData)
async def apply_template(
    template_id: uuid.UUID,
    service: TemplateService = Depends(get_service),
):
    """Returns template data for pre-filling a job form. Increments usage count."""
    return await service.apply_template(template_id)


# ── Job-scoped: save existing job as template ─────────────────────────────────
jobs_router = APIRouter(prefix="/jobs", tags=["templates"])


@jobs_router.post("/{job_id}/save-as-template", response_model=TemplateOut, status_code=status.HTTP_201_CREATED)
async def save_job_as_template(
    job_id: uuid.UUID,
    req: SaveAsTemplateRequest,
    service: TemplateService = Depends(get_service),
):
    return await service.save_job_as_template(job_id, req, MOCK_USER_ID)
