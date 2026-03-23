import uuid
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job import Job, JobCriteria
from app.models.template import JobTemplate
from app.schemas.template import (
    SaveAsTemplateRequest, TemplateCreate, TemplateData,
    TemplateCriterion, TemplateOut, TemplateUpdate,
)


class TemplateService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def save_job_as_template(
        self, job_id: uuid.UUID, req: SaveAsTemplateRequest, created_by: uuid.UUID | None
    ) -> JobTemplate:
        """Snapshot a job + its criteria into a template."""
        job = await self._get_job(job_id)
        criteria = await self._get_criteria(job_id)

        data = TemplateData(
            title=job.title,
            description=job.description,
            department=job.department,
            location=job.location,
            type=job.type,
            criteria=[
                TemplateCriterion(
                    criterion_name=c.criterion_name,
                    criterion_type=c.criterion_type,
                    weight=c.weight,
                    required=c.required,
                    extra_data=c.extra_data,
                )
                for c in criteria
            ],
        )

        template = JobTemplate(
            name=req.name,
            department=job.department,
            role_type=req.role_type,
            scope=req.scope,
            template_data=data.model_dump(),
            created_by=created_by,
        )
        self.db.add(template)
        await self.db.flush()
        await self.db.refresh(template)
        return template

    async def create_template(
        self, data: TemplateCreate, created_by: uuid.UUID | None
    ) -> JobTemplate:
        template = JobTemplate(
            name=data.name,
            department=data.department,
            role_type=data.role_type,
            scope=data.scope,
            template_data=data.template_data.model_dump(),
            created_by=created_by,
        )
        self.db.add(template)
        await self.db.flush()
        await self.db.refresh(template)
        return template

    async def list_templates(
        self,
        created_by: uuid.UUID | None,
        search: str | None = None,
        department: str | None = None,
    ) -> list[JobTemplate]:
        """Return org-wide templates + personal templates for this user."""
        stmt = select(JobTemplate).where(
            or_(
                JobTemplate.scope == "organization",
                JobTemplate.created_by == created_by,
            )
        )
        if department:
            stmt = stmt.where(JobTemplate.department == department)
        if search:
            stmt = stmt.where(JobTemplate.name.ilike(f"%{search}%"))
        stmt = stmt.order_by(JobTemplate.usage_count.desc(), JobTemplate.created_at.desc())
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_template(self, template_id: uuid.UUID) -> JobTemplate:
        return await self._get_template(template_id)

    async def update_template(
        self, template_id: uuid.UUID, data: TemplateUpdate, requester_id: uuid.UUID | None
    ) -> JobTemplate:
        template = await self._get_template(template_id)
        self._check_ownership(template, requester_id)
        for field, value in data.model_dump(exclude_none=True).items():
            if field == "template_data" and value:
                setattr(template, field, TemplateData(**value).model_dump())
            else:
                setattr(template, field, value)
        template.updated_at = datetime.utcnow()
        await self.db.flush()
        await self.db.refresh(template)
        return template

    async def delete_template(
        self, template_id: uuid.UUID, requester_id: uuid.UUID | None
    ) -> None:
        template = await self._get_template(template_id)
        self._check_ownership(template, requester_id)
        await self.db.delete(template)
        await self.db.flush()

    async def apply_template(
        self, template_id: uuid.UUID
    ) -> TemplateData:
        """Return template data for pre-filling a new job form. Increments usage count."""
        template = await self._get_template(template_id)
        template.usage_count += 1
        template.last_used_at = datetime.utcnow()
        await self.db.flush()
        return TemplateData(**template.template_data)

    # ── Helpers ───────────────────────────────────────────────────────────────

    async def _get_job(self, job_id: uuid.UUID) -> Job:
        result = await self.db.execute(select(Job).where(Job.id == job_id))
        job = result.scalar_one_or_none()
        if not job:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
        return job

    async def _get_criteria(self, job_id: uuid.UUID) -> list[JobCriteria]:
        result = await self.db.execute(
            select(JobCriteria).where(JobCriteria.job_id == job_id)
        )
        return list(result.scalars().all())

    async def _get_template(self, template_id: uuid.UUID) -> JobTemplate:
        result = await self.db.execute(
            select(JobTemplate).where(JobTemplate.id == template_id)
        )
        t = result.scalar_one_or_none()
        if not t:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
        return t

    def _check_ownership(self, template: JobTemplate, requester_id: uuid.UUID | None) -> None:
        if template.created_by and template.created_by != requester_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your template")
