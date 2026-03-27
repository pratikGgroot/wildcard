"""Pipeline stages and candidate pipeline tracking (Epic 09)

Revision ID: 0019
Revises: 0018
Create Date: 2026-03-24
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0019"
down_revision = "0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── pipeline_stages ───────────────────────────────────────────────────────
    # Default stages per job; can be customised per job posting
    op.create_table(
        "pipeline_stages",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("job_id", UUID(as_uuid=True), sa.ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("order", sa.Integer, nullable=False),
        sa.Column("color", sa.String(20), nullable=True),          # hex colour for UI
        sa.Column("is_terminal", sa.Boolean, nullable=False, server_default="false"),  # Hired / Rejected
        sa.Column("created_at", sa.DateTime, server_default=sa.text("now()")),
    )
    op.create_index("idx_pipeline_stages_job", "pipeline_stages", ["job_id", "order"])

    # ── candidate_pipeline ────────────────────────────────────────────────────
    # One row per candidate+job — tracks current stage
    op.create_table(
        "candidate_pipeline",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("candidate_id", UUID(as_uuid=True), sa.ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False),
        sa.Column("job_id", UUID(as_uuid=True), sa.ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("stage_id", UUID(as_uuid=True), sa.ForeignKey("pipeline_stages.id", ondelete="SET NULL"), nullable=True),
        sa.Column("moved_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("moved_at", sa.DateTime, server_default=sa.text("now()")),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("now()")),
    )
    op.create_index("idx_candidate_pipeline_job", "candidate_pipeline", ["job_id"])
    op.create_index("idx_candidate_pipeline_candidate", "candidate_pipeline", ["candidate_id"])
    op.create_unique_constraint("uq_candidate_pipeline_candidate_job", "candidate_pipeline", ["candidate_id", "job_id"])

    # ── pipeline_stage_audit ──────────────────────────────────────────────────
    # Immutable audit log of every stage transition
    op.create_table(
        "pipeline_stage_audit",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("candidate_id", UUID(as_uuid=True), sa.ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False),
        sa.Column("job_id", UUID(as_uuid=True), sa.ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("from_stage_id", UUID(as_uuid=True), sa.ForeignKey("pipeline_stages.id", ondelete="SET NULL"), nullable=True),
        sa.Column("to_stage_id", UUID(as_uuid=True), sa.ForeignKey("pipeline_stages.id", ondelete="SET NULL"), nullable=True),
        sa.Column("moved_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("note", sa.Text, nullable=True),
        sa.Column("moved_at", sa.DateTime, server_default=sa.text("now()")),
    )
    op.create_index("idx_pipeline_audit_candidate_job", "pipeline_stage_audit", ["candidate_id", "job_id"])
    op.create_index("idx_pipeline_audit_job", "pipeline_stage_audit", ["job_id"])


def downgrade() -> None:
    op.drop_table("pipeline_stage_audit")
    op.drop_table("candidate_pipeline")
    op.drop_table("pipeline_stages")
