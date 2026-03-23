"""fit_score override columns

Revision ID: 0014
Revises: 0013
Create Date: 2026-03-20
"""
from alembic import op
import sqlalchemy as sa

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("fit_scores", sa.Column("is_overridden", sa.Boolean, server_default="false", nullable=False))
    op.add_column("fit_scores", sa.Column("override_score", sa.Float, nullable=True))
    op.add_column("fit_scores", sa.Column("override_justification", sa.Text, nullable=True))
    op.add_column("fit_scores", sa.Column("overridden_by", sa.String(36), nullable=True))
    op.add_column("fit_scores", sa.Column("overridden_at", sa.DateTime, nullable=True))
    op.add_column("fit_scores", sa.Column("original_ai_score", sa.Float, nullable=True))


def downgrade() -> None:
    for col in ["is_overridden", "override_score", "override_justification",
                "overridden_by", "overridden_at", "original_ai_score"]:
        op.drop_column("fit_scores", col)
