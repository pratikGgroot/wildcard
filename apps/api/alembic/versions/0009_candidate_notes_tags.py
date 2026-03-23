"""candidate_notes and candidate_tags tables (Stories 03.2 & 03.4)

Revision ID: 0009
Revises: 0008
Create Date: 2026-03-20
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── candidate_notes ───────────────────────────────────────────────────────
    op.create_table(
        "candidate_notes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("candidate_id", UUID(as_uuid=True), sa.ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False),
        sa.Column("job_id", UUID(as_uuid=True), sa.ForeignKey("jobs.id", ondelete="CASCADE"), nullable=True),
        sa.Column("author_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("is_deleted", sa.Boolean, server_default="false", nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("idx_candidate_notes_candidate", "candidate_notes", ["candidate_id"])
    op.create_index("idx_candidate_notes_job", "candidate_notes", ["job_id"])

    # ── candidate_tags ────────────────────────────────────────────────────────
    # Simple free-text tags stored per candidate (no separate tags table needed for MVP)
    op.create_table(
        "candidate_tags",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("candidate_id", UUID(as_uuid=True), sa.ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tag", sa.String(50), nullable=False),
        sa.Column("added_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("added_at", sa.DateTime, server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("idx_candidate_tags_candidate", "candidate_tags", ["candidate_id"])
    op.create_index("idx_candidate_tags_tag", "candidate_tags", ["tag"])


def downgrade() -> None:
    op.drop_table("candidate_tags")
    op.drop_table("candidate_notes")
