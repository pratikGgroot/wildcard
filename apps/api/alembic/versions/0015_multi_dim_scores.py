"""add multi-dimensional score columns to fit_scores

Revision ID: 0015
Revises: 0014
Create Date: 2025-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("fit_scores", sa.Column("technical_score", sa.Float(), nullable=True))
    op.add_column("fit_scores", sa.Column("culture_score", sa.Float(), nullable=True))
    op.add_column("fit_scores", sa.Column("growth_score", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("fit_scores", "growth_score")
    op.drop_column("fit_scores", "culture_score")
    op.drop_column("fit_scores", "technical_score")
