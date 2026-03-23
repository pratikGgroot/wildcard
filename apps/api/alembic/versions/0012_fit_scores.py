"""fit_scores table

Revision ID: 0012
Revises: 0011
Create Date: 2024-01-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "fit_scores",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("candidate_id", UUID(as_uuid=True), sa.ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False),
        sa.Column("job_id", UUID(as_uuid=True), sa.ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("fit_score", sa.Float, nullable=False),
        sa.Column("score_breakdown", JSONB, nullable=True),
        sa.Column("weights_used", JSONB, nullable=True),
        sa.Column("model_name", sa.String(100), nullable=True),
        sa.Column("model_version", sa.String(50), nullable=True),
        sa.Column("is_current", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("computed_at", sa.DateTime, nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_fit_scores_candidate_job", "fit_scores", ["candidate_id", "job_id"])
    op.create_index("ix_fit_scores_job_score", "fit_scores", ["job_id", "fit_score"])


def downgrade() -> None:
    op.drop_table("fit_scores")
