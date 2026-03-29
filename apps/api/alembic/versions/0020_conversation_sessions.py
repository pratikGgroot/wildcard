"""conversation sessions and messages for chat assistant

Revision ID: 0020
Revises: 0019
Create Date: 2026-03-23
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0020"
down_revision = "0019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "conversation_sessions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("session_start", sa.DateTime, server_default=sa.text("now()"), nullable=False),
        sa.Column("last_active", sa.DateTime, server_default=sa.text("now()"), nullable=False),
        sa.Column("is_expired", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("title", sa.String(200), nullable=True),
    )
    op.create_index("idx_sessions_last_active", "conversation_sessions", ["last_active"])

    op.create_table(
        "conversation_messages",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "session_id",
            UUID(as_uuid=True),
            sa.ForeignKey("conversation_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.String(20), nullable=False),  # user | assistant | tool
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("tool_name", sa.String(50), nullable=True),
        sa.Column("tool_args", sa.JSON, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("idx_messages_session", "conversation_messages", ["session_id", "created_at"])


def downgrade() -> None:
    op.drop_index("idx_messages_session", table_name="conversation_messages")
    op.drop_table("conversation_messages")
    op.drop_index("idx_sessions_last_active", table_name="conversation_sessions")
    op.drop_table("conversation_sessions")
