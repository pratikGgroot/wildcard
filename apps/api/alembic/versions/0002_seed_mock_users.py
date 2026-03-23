"""seed mock users for development

Revision ID: 0002
Revises: 0001
Create Date: 2026-03-19
"""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

MOCK_USERS = [
    ("00000000-0000-0000-0000-000000000001", "sarah.chen@hireiq.com",      "Sarah Chen",       "recruiter"),
    ("00000000-0000-0000-0000-000000000002", "james.wilson@hireiq.com",    "James Wilson",     "recruiter"),
    ("00000000-0000-0000-0000-000000000003", "priya.sharma@hireiq.com",    "Priya Sharma",     "recruiter"),
    ("00000000-0000-0000-0000-000000000004", "michael.torres@hireiq.com",  "Michael Torres",   "hiring_manager"),
    ("00000000-0000-0000-0000-000000000005", "emily.johnson@hireiq.com",   "Emily Johnson",    "hiring_manager"),
    ("00000000-0000-0000-0000-000000000006", "david.kim@hireiq.com",       "David Kim",        "hiring_manager"),
    ("00000000-0000-0000-0000-000000000007", "admin@hireiq.com",           "Admin User",       "admin"),
]


def upgrade() -> None:
    conn = op.get_bind()
    for uid, email, name, role in MOCK_USERS:
        conn.execute(
            sa.text(
                "INSERT INTO users (id, email, hashed_password, full_name, role, is_active) "
                "VALUES (:id, :email, :pw, :name, :role, true) "
                "ON CONFLICT (id) DO NOTHING"
            ),
            {"id": uid, "email": email, "pw": "placeholder", "name": name, "role": role},
        )


def downgrade() -> None:
    conn = op.get_bind()
    for uid, _, _, _ in MOCK_USERS:
        conn.execute(sa.text("DELETE FROM users WHERE id = :id"), {"id": uid})
