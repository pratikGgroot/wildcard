import uuid
from datetime import datetime
from decimal import Decimal

import sqlalchemy as sa
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, JSON, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

try:
    from pgvector.sqlalchemy import Vector
    _VECTOR_TYPE = Vector(768)
except ImportError:
    # Fallback if pgvector not installed — won't be used for inserts
    _VECTOR_TYPE = sa.Text  # type: ignore

from app.db.base import Base


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    department: Mapped[str | None] = mapped_column(String(100))
    location: Mapped[str | None] = mapped_column(String(100))
    type: Mapped[str] = mapped_column(String(20), nullable=False)  # full-time, contract, internship
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    close_reason: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=datetime.utcnow
    )
    # AI extraction fields
    description_hash: Mapped[str | None] = mapped_column(String(64))
    criteria_extracted_at: Mapped[datetime | None] = mapped_column(DateTime)
    jd_embedding: Mapped[list | None] = mapped_column(_VECTOR_TYPE, nullable=True)

    # relationships
    creator: Mapped["User"] = relationship(  # noqa: F821
        "User", back_populates="created_jobs", foreign_keys=[created_by]
    )
    assignments: Mapped[list["JobAssignment"]] = relationship(
        "JobAssignment", back_populates="job", cascade="all, delete-orphan"
    )
    status_history: Mapped[list["JobStatusHistory"]] = relationship(
        "JobStatusHistory", back_populates="job", cascade="all, delete-orphan"
    )
    criteria: Mapped[list["JobCriteria"]] = relationship(
        "JobCriteria", back_populates="job", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("idx_jobs_status", "status"),
        Index("idx_jobs_created_at", "created_at"),
    )


class JobCriteria(Base):
    __tablename__ = "job_criteria"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False
    )
    criterion_name: Mapped[str] = mapped_column(String(200), nullable=False)
    criterion_type: Mapped[str] = mapped_column(String(50), nullable=False)  # skill|experience|education|certification
    weight: Mapped[str] = mapped_column(String(20), nullable=False, default="medium")
    required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    confidence_score: Mapped[Decimal | None] = mapped_column(Numeric(3, 2))
    ai_extracted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    extra_data: Mapped[dict | None] = mapped_column(JSON)  # years_min, field, etc.
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=datetime.utcnow)

    job: Mapped["Job"] = relationship("Job", back_populates="criteria")

    __table_args__ = (
        Index("idx_job_criteria_job_id", "job_id"),
        Index("idx_job_criteria_type", "criterion_type"),
    )


class JobAssignment(Base):
    __tablename__ = "job_assignments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # recruiter, hiring_manager
    assigned_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # relationships
    job: Mapped["Job"] = relationship("Job", back_populates="assignments")
    user: Mapped["User"] = relationship("User", back_populates="job_assignments")  # noqa: F821

    __table_args__ = (Index("idx_job_assignments_job", "job_id"),)


class JobStatusHistory(Base):
    __tablename__ = "job_status_history"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False
    )
    from_status: Mapped[str | None] = mapped_column(String(20))
    to_status: Mapped[str] = mapped_column(String(20), nullable=False)
    reason: Mapped[str | None] = mapped_column(Text)
    changed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id")
    )
    changed_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # relationships
    job: Mapped["Job"] = relationship("Job", back_populates="status_history")
