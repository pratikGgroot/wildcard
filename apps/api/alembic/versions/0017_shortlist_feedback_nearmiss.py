"""shortlist feedback and learned weights tables (05.4 + 05.5)

Revision ID: 0017
Revises: 0016
Create Date: 2026-03-23
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "0017"
down_revision = "0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Feedback signals (05.4)
    op.create_table(
        "shortlist_feedback",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("job_id", UUID(as_uuid=True), sa.ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("candidate_id", UUID(as_uuid=True), sa.ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False),
        sa.Column("action", sa.String(10), nullable=False),
        sa.Column("score_breakdown", JSONB, nullable=True),
        sa.Column("recorded_at", sa.DateTime, server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("job_id", "candidate_id", name="uq_feedback_job_candidate"),
    )
    op.create_index("ix_shortlist_feedback_job_id", "shortlist_feedback", ["job_id"])

    # Learned weights (05.4)
    op.create_table(
        "shortlist_learned_weights",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("job_id", UUID(as_uuid=True), sa.ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("weights", JSONB, nullable=False),
        sa.Column("signal_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("computed_at", sa.DateTime, server_default=sa.text("now()"), nullable=False),
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("is_personalized", sa.Boolean, server_default="false", nullable=False),
    )
    op.create_index("ix_shortlist_learned_weights_job_id", "shortlist_learned_weights", ["job_id"])


def downgrade() -> None:
    op.drop_table("shortlist_learned_weights")
    op.drop_table("shortlist_feedback")
