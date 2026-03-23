"""duplicate_flags table for Story 02.6

Revision ID: 0006
Revises: 0005
Create Date: 2026-03-20
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "duplicate_flags",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("candidate_id_a", UUID(as_uuid=True), sa.ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False),
        sa.Column("candidate_id_b", UUID(as_uuid=True), sa.ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False),
        sa.Column("job_id", UUID(as_uuid=True), sa.ForeignKey("jobs.id", ondelete="CASCADE"), nullable=True),
        sa.Column("similarity_score", sa.Float, nullable=True),
        sa.Column(
            "detection_method",
            sa.String(20),
            nullable=False,
        ),  # 'email' | 'embedding'
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="pending",
        ),  # 'pending' | 'confirmed' | 'dismissed'
        sa.Column("reviewed_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("reviewed_at", sa.DateTime, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index(
        "idx_duplicate_flags_status",
        "duplicate_flags",
        ["status"],
        postgresql_where=sa.text("status = 'pending'"),
    )
    op.create_index("idx_duplicate_flags_candidate_a", "duplicate_flags", ["candidate_id_a"])
    op.create_index("idx_duplicate_flags_candidate_b", "duplicate_flags", ["candidate_id_b"])
    op.create_index("idx_duplicate_flags_job", "duplicate_flags", ["job_id"])


def downgrade() -> None:
    op.drop_index("idx_duplicate_flags_job", "duplicate_flags")
    op.drop_index("idx_duplicate_flags_candidate_b", "duplicate_flags")
    op.drop_index("idx_duplicate_flags_candidate_a", "duplicate_flags")
    op.drop_index("idx_duplicate_flags_status", "duplicate_flags")
    op.drop_table("duplicate_flags")
