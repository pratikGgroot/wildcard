"""job criteria and embeddings

Revision ID: 0003
Revises: 0002
Create Date: 2026-03-19
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enable pgvector extension
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # Add description_hash and embedding columns to jobs
    op.add_column("jobs", sa.Column("description_hash", sa.String(64), nullable=True))
    op.add_column("jobs", sa.Column("criteria_extracted_at", sa.DateTime, nullable=True))
    # pgvector column: 1536 dims (OpenAI/Ollama nomic-embed-text compatible)
    op.execute(
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS jd_embedding vector(768)"
    )

    # job_criteria table
    op.create_table(
        "job_criteria",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "job_id",
            UUID(as_uuid=True),
            sa.ForeignKey("jobs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("criterion_name", sa.String(200), nullable=False),
        sa.Column(
            "criterion_type",
            sa.String(50),
            nullable=False,
        ),  # skill | experience | education | certification
        sa.Column("weight", sa.String(20), nullable=False, server_default="medium"),
        sa.Column("required", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("confidence_score", sa.Numeric(3, 2), nullable=True),
        sa.Column("ai_extracted", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("extra_data", sa.JSON, nullable=True),  # years_min, field, etc.
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index("idx_job_criteria_job_id", "job_criteria", ["job_id"])
    op.create_index("idx_job_criteria_type", "job_criteria", ["criterion_type"])


def downgrade() -> None:
    op.drop_index("idx_job_criteria_type", "job_criteria")
    op.drop_index("idx_job_criteria_job_id", "job_criteria")
    op.drop_table("job_criteria")
    op.drop_column("jobs", "jd_embedding")
    op.drop_column("jobs", "criteria_extracted_at")
    op.drop_column("jobs", "description_hash")
