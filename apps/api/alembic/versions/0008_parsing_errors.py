"""parsing_errors and parsing_corrections tables (Story 02.7)

Revision ID: 0008
Revises: 0007
Create Date: 2026-03-20
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "parsing_errors",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("upload_id", UUID(as_uuid=True), sa.ForeignKey("resume_uploads.id", ondelete="CASCADE"), nullable=False),
        sa.Column("job_id", UUID(as_uuid=True), sa.ForeignKey("jobs.id", ondelete="CASCADE"), nullable=True),
        sa.Column("error_type", sa.String(50), nullable=False),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("stage", sa.String(30), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("resolved_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("resolved_at", sa.DateTime, nullable=True),
        sa.Column("resolution_method", sa.String(20), nullable=True),
        sa.Column("discard_reason", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index("idx_parsing_errors_status", "parsing_errors", ["status"])
    op.create_index("idx_parsing_errors_upload", "parsing_errors", ["upload_id"])
    op.create_index("idx_parsing_errors_job", "parsing_errors", ["job_id"])

    op.create_table(
        "parsing_corrections",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("parsing_error_id", UUID(as_uuid=True), sa.ForeignKey("parsing_errors.id", ondelete="CASCADE"), nullable=False),
        sa.Column("corrected_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("field_name", sa.String(100), nullable=True),
        sa.Column("old_value", sa.Text, nullable=True),
        sa.Column("new_value", sa.Text, nullable=True),
        sa.Column("corrected_at", sa.DateTime, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("parsing_corrections")
    op.drop_index("idx_parsing_errors_job", "parsing_errors")
    op.drop_index("idx_parsing_errors_upload", "parsing_errors")
    op.drop_index("idx_parsing_errors_status", "parsing_errors")
    op.drop_table("parsing_errors")
