"""Interview kit rubrics (07.5) and share links (07.7)

Revision ID: 0024
Revises: 0023
Create Date: 2026-03-29
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0024"
down_revision = "0023"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 07.5 — Add rubric column to interview_questions
    op.add_column("interview_questions", sa.Column("rubric", sa.JSON, nullable=True))

    # 07.7 — Share links table
    op.create_table(
        "kit_share_links",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("kit_id", UUID(as_uuid=True), sa.ForeignKey("interview_kits.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token", sa.String(64), unique=True, nullable=False),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("expires_at", sa.DateTime, nullable=False),
        sa.Column("is_revoked", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("accessed_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("idx_kit_share_links_token", "kit_share_links", ["token"])
    op.create_index("idx_kit_share_links_kit", "kit_share_links", ["kit_id"])


def downgrade() -> None:
    op.drop_index("idx_kit_share_links_kit", "kit_share_links")
    op.drop_index("idx_kit_share_links_token", "kit_share_links")
    op.drop_table("kit_share_links")
    op.drop_column("interview_questions", "rubric")
