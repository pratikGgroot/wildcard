"""score_recalculation_jobs table

Revision ID: 0013
Revises: 0012
Create Date: 2026-03-20
"""
from alembic import op
import sqlalchemy as sa

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "score_recalculation_jobs",
        sa.Column("job_id", sa.String(36), primary_key=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("total", sa.Integer, nullable=False, server_default="0"),
        sa.Column("scored", sa.Integer, nullable=False, server_default="0"),
        sa.Column("errors", sa.Integer, nullable=False, server_default="0"),
        sa.Column("started_at", sa.DateTime, nullable=True),
        sa.Column("completed_at", sa.DateTime, nullable=True),
        sa.Column("triggered_by", sa.String(50), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("score_recalculation_jobs")
