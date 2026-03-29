"""notifications, email_queue, notification_preferences

Revision ID: 0026
Revises: 0025
Create Date: 2026-03-27
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "0026"
down_revision = "0025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Tables already created in a prior migration on Yash's branch.
    # This revision just re-anchors them into the main chain after 0025.
    # Use IF NOT EXISTS guards so it's safe to run even if tables exist.
    conn = op.get_bind()

    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS notifications (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type VARCHAR(50) NOT NULL,
            title VARCHAR(200) NOT NULL,
            body TEXT,
            entity_type VARCHAR(50),
            entity_id UUID,
            is_read BOOLEAN NOT NULL DEFAULT false,
            read_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT now()
        )
    """))
    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read)
    """))
    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at)
    """))

    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS email_queue (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            to_email VARCHAR(255) NOT NULL,
            to_name VARCHAR(200),
            subject VARCHAR(500) NOT NULL,
            html_body TEXT NOT NULL,
            text_body TEXT,
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            attempts INTEGER NOT NULL DEFAULT 0,
            last_error TEXT,
            sent_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT now(),
            metadata JSONB
        )
    """))
    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status, created_at)
    """))

    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS notification_preferences (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
            email_pipeline_moves BOOLEAN NOT NULL DEFAULT true,
            email_shortlist_actions BOOLEAN NOT NULL DEFAULT true,
            email_parse_complete BOOLEAN NOT NULL DEFAULT false,
            inapp_pipeline_moves BOOLEAN NOT NULL DEFAULT true,
            inapp_shortlist_actions BOOLEAN NOT NULL DEFAULT true,
            inapp_parse_complete BOOLEAN NOT NULL DEFAULT true,
            unsubscribed_all BOOLEAN NOT NULL DEFAULT false,
            unsubscribe_token VARCHAR(64) UNIQUE,
            updated_at TIMESTAMP DEFAULT now()
        )
    """))


def downgrade() -> None:
    op.drop_table("notification_preferences")
    op.drop_table("email_queue")
    op.drop_table("notifications")
