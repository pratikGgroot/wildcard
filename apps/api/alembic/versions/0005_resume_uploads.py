"""resume uploads and candidates

Revision ID: 0005
Revises: 0004
Create Date: 2026-03-19
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # candidates table (minimal — full profile built in Story 02.4)
    op.create_table(
        "candidates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("full_name", sa.String(200), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("location", sa.String(200), nullable=True),
        sa.Column("linkedin_url", sa.String(500), nullable=True),
        sa.Column("raw_resume_text", sa.Text, nullable=True),
        sa.Column("resume_file_key", sa.String(500), nullable=True),
        sa.Column("parsing_confidence", sa.Numeric(4, 3), nullable=True),
        sa.Column("parsing_errors", sa.JSON, nullable=True),
        sa.Column("parsed_data", sa.JSON, nullable=True),  # full structured profile
        sa.Column("is_duplicate", sa.Boolean, server_default="false"),
        sa.Column("duplicate_of_id", UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index("idx_candidates_email", "candidates", ["email"])

    # resume_uploads table
    op.create_table(
        "resume_uploads",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("job_id", UUID(as_uuid=True), sa.ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("file_key", sa.String(500), nullable=False),
        sa.Column("file_name", sa.String(200), nullable=True),
        sa.Column("file_size_bytes", sa.Integer, nullable=True),
        sa.Column("content_type", sa.String(100), nullable=True),
        sa.Column(
            "status", sa.String(20), nullable=False, server_default="queued"
        ),  # queued | uploading | parsing | completed | failed
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("candidate_id", UUID(as_uuid=True), sa.ForeignKey("candidates.id"), nullable=True),
        sa.Column("uploaded_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("uploaded_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime, nullable=True),
    )
    op.create_index("idx_resume_uploads_job", "resume_uploads", ["job_id", "status"])
    op.create_index("idx_resume_uploads_status", "resume_uploads", ["status"])


def downgrade() -> None:
    op.drop_index("idx_resume_uploads_status", "resume_uploads")
    op.drop_index("idx_resume_uploads_job", "resume_uploads")
    op.drop_table("resume_uploads")
    op.drop_index("idx_candidates_email", "candidates")
    op.drop_table("candidates")
