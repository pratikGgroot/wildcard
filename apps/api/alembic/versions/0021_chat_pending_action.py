"""Add pending_action column to conversation_sessions for chat action execution (06.6)

Revision ID: 0021
Revises: 0020
Create Date: 2026-03-29
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "0021"
down_revision = "0020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "conversation_sessions",
        sa.Column("pending_action", JSONB, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("conversation_sessions", "pending_action")
