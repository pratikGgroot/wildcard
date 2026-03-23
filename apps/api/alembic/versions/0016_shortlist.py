"""shortlist tables

Revision ID: 0016
Revises: 0015
Create Date: 2026-03-23
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0016"
down_revision = "0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # shortlists — one per job, tracks generation metadata
    op.create_table(
        "shortlists",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("job_id", UUID(as_uuid=True), sa.ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("status", sa.String(20), nullable=False, default="active"),  # active | outdated | complete
        sa.Column("threshold_n", sa.Integer, nullable=True),  # configured N, null = auto
        sa.Column("threshold_score", sa.Float, nullable=True),
        sa.Column("total_candidates", sa.Integer, nullable=False, default=0),
        sa.Column("generated_at", sa.DateTime, server_default=sa.text("now()")),
        sa.Column("generated_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
    )
    op.create_index("idx_shortlists_job_id", "shortlists", ["job_id"])

    # shortlist_candidates — individual entries per candidate on a shortlist
    op.create_table(
        "shortlist_candidates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("shortlist_id", UUID(as_uuid=True), sa.ForeignKey("shortlists.id", ondelete="CASCADE"), nullable=False),
        sa.Column("candidate_id", UUID(as_uuid=True), sa.ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False),
        sa.Column("job_id", UUID(as_uuid=True), sa.ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("rank", sa.Integer, nullable=False),
        sa.Column("fit_score", sa.Float, nullable=False),
        sa.Column("confidence_level", sa.String(10), nullable=False),  # High | Medium | Low
        sa.Column("reasoning", sa.Text, nullable=True),
        sa.Column("reasoning_generated_at", sa.DateTime, nullable=True),
        sa.Column("action", sa.String(20), nullable=True),  # accepted | rejected | deferred | null
        sa.Column("action_taken_at", sa.DateTime, nullable=True),
        sa.Column("action_taken_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("defer_until", sa.DateTime, nullable=True),
        sa.Column("rejection_reason", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("now()")),
    )
    op.create_index("idx_shortlist_candidates_shortlist", "shortlist_candidates", ["shortlist_id"])
    op.create_index("idx_shortlist_candidates_candidate", "shortlist_candidates", ["candidate_id"])
    op.create_index("idx_shortlist_candidates_job", "shortlist_candidates", ["job_id"])

    # shortlist_audit_log — every accept/reject/defer action
    op.create_table(
        "shortlist_audit_log",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("shortlist_candidate_id", UUID(as_uuid=True), sa.ForeignKey("shortlist_candidates.id", ondelete="CASCADE"), nullable=False),
        sa.Column("candidate_id", UUID(as_uuid=True), nullable=False),
        sa.Column("job_id", UUID(as_uuid=True), nullable=False),
        sa.Column("action", sa.String(20), nullable=False),
        sa.Column("performed_by", UUID(as_uuid=True), nullable=True),
        sa.Column("reason", sa.Text, nullable=True),
        sa.Column("performed_at", sa.DateTime, server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("shortlist_audit_log")
    op.drop_table("shortlist_candidates")
    op.drop_table("shortlists")
