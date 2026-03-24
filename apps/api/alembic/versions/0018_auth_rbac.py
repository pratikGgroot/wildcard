"""auth and RBAC columns on users table (Epic 12)

Revision ID: 0018
Revises: 0017
Create Date: 2026-03-24
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add auth-related columns to users
    op.add_column("users", sa.Column("last_login", sa.DateTime, nullable=True))
    op.add_column("users", sa.Column("refresh_token_hash", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("password_reset_token", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("password_reset_expires", sa.DateTime, nullable=True))
    op.add_column("users", sa.Column("mfa_secret", sa.String(64), nullable=True))
    op.add_column("users", sa.Column("mfa_enabled", sa.Boolean, server_default="false", nullable=False))

    # Audit log table
    op.create_table(
        "auth_audit_log",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("event", sa.String(50), nullable=False),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.String(512), nullable=True),
        sa.Column("metadata", sa.JSON, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_auth_audit_log_user_id", "auth_audit_log", ["user_id"])
    op.create_index("ix_auth_audit_log_event", "auth_audit_log", ["event"])
    op.create_index("ix_auth_audit_log_created_at", "auth_audit_log", ["created_at"])

    # Update mock users to have proper bcrypt hashed passwords (password = "password123")
    op.execute(
        """
        UPDATE users SET hashed_password =
        '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK8i'
        WHERE hashed_password = 'placeholder'
        """
    )


def downgrade() -> None:
    op.drop_index("ix_auth_audit_log_created_at", "auth_audit_log")
    op.drop_index("ix_auth_audit_log_event", "auth_audit_log")
    op.drop_index("ix_auth_audit_log_user_id", "auth_audit_log")
    op.drop_table("auth_audit_log")
    op.drop_column("users", "mfa_enabled")
    op.drop_column("users", "mfa_secret")
    op.drop_column("users", "password_reset_expires")
    op.drop_column("users", "password_reset_token")
    op.drop_column("users", "refresh_token_hash")
    op.drop_column("users", "last_login")
