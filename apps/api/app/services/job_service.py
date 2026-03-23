import uuid
from typing import Sequence

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.job import Job, JobAssignment, JobCriteria, JobStatusHistory
from app.models.template import JobTemplate
from app.schemas.job import (
    AssignmentCreate,
    JobCreate,
    JobStatusChange,
    JobUpdate,
    VALID_TRANSITIONS,
)


class JobService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Create ───────────────────────────────────────────────────────────────

    async def create_job(self, data: JobCreate, created_by: uuid.UUID | None) -> Job:
        job = Job(
            title=data.title,
            description=data.description,
            department=data.department,
            location=data.location,
            type=data.type,
            status="draft",
            created_by=created_by,
        )
        self.db.add(job)
        await self.db.flush()

        # Log initial status
        self.db.add(
            JobStatusHistory(
                job_id=job.id,
                from_status=None,
                to_status="draft",
                changed_by=created_by,
            )
        )

        # Copy criteria from template if provided
        if data.template_id:
            tmpl_result = await self.db.execute(
                select(JobTemplate).where(JobTemplate.id == data.template_id)
            )
            template = tmpl_result.scalar_one_or_none()
            if template:
                for c in template.template_data.get("criteria", []):
                    self.db.add(JobCriteria(
                        job_id=job.id,
                        criterion_name=c.get("criterion_name", ""),
                        criterion_type=c.get("criterion_type", "skill"),
                        weight=c.get("weight", "medium"),
                        required=c.get("required", False),
                        confidence_score=None,
                        ai_extracted=False,
                        extra_data=c.get("extra_data"),
                    ))
                # bump usage count
                template.usage_count = (template.usage_count or 0) + 1

        await self.db.flush()
        await self.db.refresh(job, ["assignments", "status_history"])
        return job

    # ── Read ─────────────────────────────────────────────────────────────────

    async def get_job(self, job_id: uuid.UUID) -> Job:
        result = await self.db.execute(
            select(Job)
            .options(selectinload(Job.assignments), selectinload(Job.status_history))
            .where(Job.id == job_id)
        )
        job = result.scalar_one_or_none()
        if not job:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
        return job

    async def list_jobs(
        self,
        page: int = 1,
        page_size: int = 20,
        status_filter: str | None = None,
        department: str | None = None,
    ) -> tuple[Sequence[Job], int]:
        query = select(Job)
        if status_filter:
            query = query.where(Job.status == status_filter)
        if department:
            query = query.where(Job.department == department)

        count_result = await self.db.execute(
            select(func.count()).select_from(query.subquery())
        )
        total = count_result.scalar_one()

        query = query.order_by(Job.created_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await self.db.execute(query)
        return result.scalars().all(), total

    # ── Update ───────────────────────────────────────────────────────────────

    async def update_job(self, job_id: uuid.UUID, data: JobUpdate) -> Job:
        job = await self.get_job(job_id)
        if job.status == "closed":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot edit a closed job",
            )
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(job, field, value)
        await self.db.flush()
        await self.db.refresh(job, ["assignments"])
        return job

    # ── Status machine ───────────────────────────────────────────────────────

    async def change_status(
        self,
        job_id: uuid.UUID,
        data: JobStatusChange,
        changed_by: uuid.UUID | None,
    ) -> Job:
        job = await self.get_job(job_id)
        allowed = VALID_TRANSITIONS.get(job.status, [])

        if data.status not in allowed:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Cannot transition from '{job.status}' to '{data.status}'. "
                       f"Allowed: {allowed}",
            )

        # Activation guard: must have at least one recruiter assigned
        if data.status == "active":
            has_recruiter = any(a.role == "recruiter" for a in job.assignments)
            if not has_recruiter:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="At least one recruiter must be assigned before activating",
                )

        # Closed requires reason
        if data.status == "closed" and not data.reason:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="A close reason is required when closing a job",
            )

        old_status = job.status
        job.status = data.status
        if data.status == "closed":
            job.close_reason = data.reason

        self.db.add(
            JobStatusHistory(
                job_id=job.id,
                from_status=old_status,
                to_status=data.status,
                reason=data.reason,
                changed_by=changed_by,
            )
        )
        await self.db.flush()
        await self.db.refresh(job, ["assignments", "status_history"])
        return job

    # ── Assignments ──────────────────────────────────────────────────────────

    async def add_assignment(
        self, job_id: uuid.UUID, data: AssignmentCreate
    ) -> JobAssignment:
        # Check job exists
        await self.get_job(job_id)

        # Prevent duplicate assignment
        existing = await self.db.execute(
            select(JobAssignment).where(
                JobAssignment.job_id == job_id,
                JobAssignment.user_id == data.user_id,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User is already assigned to this job",
            )

        assignment = JobAssignment(
            job_id=job_id,
            user_id=data.user_id,
            role=data.role,
        )
        self.db.add(assignment)
        await self.db.flush()
        await self.db.refresh(assignment)
        return assignment

    async def remove_assignment(self, job_id: uuid.UUID, user_id: uuid.UUID) -> None:
        result = await self.db.execute(
            select(JobAssignment).where(
                JobAssignment.job_id == job_id,
                JobAssignment.user_id == user_id,
            )
        )
        assignment = result.scalar_one_or_none()
        if not assignment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found"
            )
        await self.db.delete(assignment)
        await self.db.flush()

    # ── Status history ───────────────────────────────────────────────────────

    async def get_status_history(self, job_id: uuid.UUID) -> list[JobStatusHistory]:
        await self.get_job(job_id)  # 404 guard
        result = await self.db.execute(
            select(JobStatusHistory)
            .where(JobStatusHistory.job_id == job_id)
            .order_by(JobStatusHistory.changed_at.asc())
        )
        return list(result.scalars().all())
