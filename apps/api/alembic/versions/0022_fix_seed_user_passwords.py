"""Fix seed user passwords — replace broken bcrypt hash with a verified one

The hash in 0018 was invalid and only ran against rows with hashed_password = 'placeholder'.
This migration unconditionally resets all three seed accounts to password123.

Revision ID: 0022
Revises: 0021
Create Date: 2026-03-29
"""
from alembic import op

revision = "0022"
down_revision = "0021"
branch_labels = None
depends_on = None

# bcrypt hash of "password123" — verified against bcrypt.checkpw directly
_HASH = "$2b$12$5ooEMe3TthaAgaLmga.2KeasSl6dKQiPGunU0cLGyhk9rpFNEkxm."

def upgrade() -> None:
    # Update ALL hireiq.com seed accounts — actual emails differ from project-context.md
    op.execute(
        f"UPDATE users SET hashed_password = '{_HASH}' WHERE email LIKE '%hireiq.com'"
    )


def downgrade() -> None:
    # No safe rollback — leave passwords as-is
    pass
