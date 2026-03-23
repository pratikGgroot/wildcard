"""candidate and job embeddings tables (Story 04.1)

Revision ID: 0011
Revises: 0010
Create Date: 2026-03-20
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Ensure pgvector extension exists (already enabled from migration 0003)
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "candidate_embeddings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("candidate_id", UUID(as_uuid=True), sa.ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False),
        sa.Column("embedding", sa.Text, nullable=False),  # stored as JSON array string; cast to vector in queries
        sa.Column("model_name", sa.String(100), nullable=False),
        sa.Column("model_version", sa.String(20), nullable=False, server_default="1"),
        sa.Column("input_hash", sa.String(64), nullable=True),
        sa.Column("embedding_status", sa.String(20), nullable=False, server_default="completed"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("idx_candidate_embeddings_candidate", "candidate_embeddings", ["candidate_id"])
    op.create_index("idx_candidate_embeddings_hash", "candidate_embeddings", ["input_hash"])

    op.create_table(
        "job_embeddings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("job_id", UUID(as_uuid=True), sa.ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("embedding", sa.Text, nullable=False),
        sa.Column("model_name", sa.String(100), nullable=False),
        sa.Column("model_version", sa.String(20), nullable=False, server_default="1"),
        sa.Column("input_hash", sa.String(64), nullable=True),
        sa.Column("embedding_status", sa.String(20), nullable=False, server_default="completed"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("idx_job_embeddings_job", "job_embeddings", ["job_id"])
    op.create_index("idx_job_embeddings_hash", "job_embeddings", ["input_hash"])

    # Add embedding_status column to candidates table for quick status checks
    op.add_column(
        "candidates",
        sa.Column("embedding_status", sa.String(20), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("candidates", "embedding_status")
    op.drop_table("job_embeddings")
    op.drop_table("candidate_embeddings")
