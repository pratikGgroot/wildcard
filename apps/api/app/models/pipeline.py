"""Pipeline stage models (Epic 09)."""
import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


# Default stage definitions applied to every new job
DEFAULT_STAGES = [
    {"name": "Applied",    "order": 1, "color": "#6366f1", "is_terminal": False},
    {"name": "Screening",  "order": 2, "color": "#f59e0b", "is_terminal": False},
    {"name": "Interview",  "order": 3, "color": "#3b82f6", "is_terminal": False},
    {"name": "Offer",      "order": 4, "color": "#8b5cf6", "is_terminal": False},
    {"name": "Hired",      "order": 5, "color": "#10b981", "is_terminal": True},
    {"name": "Rejected",   "order": 6, "color": "#ef4444", "is_terminal": True},
]


class PipelineStage(Base):
    __tablename__ = "pipeline_stages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    order: Mapped[int] = mapped_column(Integer, nullable=False)
    color: Mapped[str | None] = mapped_column(String(20), nullable=True)
    is_terminal: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    placements: Mapped[list["CandidatePipeline"]] = relationship(
        "CandidatePipeline", back_populates="stage", foreign_keys="CandidatePipeline.stage_id"
    )

    __table_args__ = (Index("idx_pipeline_stages_job", "job_id", "order"),)


class CandidatePipeline(Base):
    __tablename__ = "candidate_pipeline"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False
    )
    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False
    )
    stage_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pipeline_stages.id", ondelete="SET NULL"), nullable=True
    )
    moved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    moved_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    stage: Mapped["PipelineStage | None"] = relationship(
        "PipelineStage", back_populates="placements", foreign_keys=[stage_id]
    )

    __table_args__ = (
        Index("idx_candidate_pipeline_job", "job_id"),
        Index("idx_candidate_pipeline_candidate", "candidate_id"),
        UniqueConstraint("candidate_id", "job_id", name="uq_candidate_pipeline_candidate_job"),
    )


class PipelineStageAudit(Base):
    __tablename__ = "pipeline_stage_audit"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False
    )
    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False
    )
    from_stage_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pipeline_stages.id", ondelete="SET NULL"), nullable=True
    )
    to_stage_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pipeline_stages.id", ondelete="SET NULL"), nullable=True
    )
    moved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    moved_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("idx_pipeline_audit_candidate_job", "candidate_id", "job_id"),
        Index("idx_pipeline_audit_job", "job_id"),
    )
