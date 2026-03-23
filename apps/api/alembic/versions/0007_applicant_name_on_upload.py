"""add applicant_name and applicant_email to resume_uploads

Revision ID: 0007
Revises: 0006
Create Date: 2026-03-20
"""
from alembic import op
import sqlalchemy as sa

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("resume_uploads", sa.Column("applicant_name", sa.String(200), nullable=True))
    op.add_column("resume_uploads", sa.Column("applicant_email", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("resume_uploads", "applicant_email")
    op.drop_column("resume_uploads", "applicant_name")
