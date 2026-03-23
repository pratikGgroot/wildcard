"""job templates

Revision ID: 0004
Revises: 0003
Create Date: 2026-03-19
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "job_templates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("department", sa.String(100), nullable=True),
        sa.Column("role_type", sa.String(100), nullable=True),
        sa.Column("template_data", sa.JSON, nullable=False),  # {title, description, criteria[]}
        sa.Column("scope", sa.String(20), nullable=False, server_default="personal"),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("usage_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("last_used_at", sa.DateTime, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index("idx_job_templates_scope", "job_templates", ["scope"])
    op.create_index("idx_job_templates_created_by", "job_templates", ["created_by"])


def downgrade() -> None:
    op.drop_index("idx_job_templates_created_by", "job_templates")
    op.drop_index("idx_job_templates_scope", "job_templates")
    op.drop_table("job_templates")
