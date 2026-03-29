"""Interview kits and questions tables (Epic 07)

Revision ID: 0023
Revises: 0022
Create Date: 2026-03-29
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, ARRAY

revision = "0023"
down_revision = "0022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "interview_kits",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("candidate_id", UUID(as_uuid=True), sa.ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False),
        sa.Column("job_id", UUID(as_uuid=True), sa.ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="generated"),  # generated|approved|outdated
        sa.Column("gap_analysis", sa.JSON, nullable=True),
        sa.Column("generated_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("approved_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("approved_at", sa.DateTime, nullable=True),
        sa.Column("criteria_hash", sa.String(64), nullable=True),  # detect outdated kits
        sa.Column("created_at", sa.DateTime, server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("candidate_id", "job_id", name="uq_interview_kit_candidate_job"),
    )
    op.create_index("idx_interview_kits_job", "interview_kits", ["job_id"])
    op.create_index("idx_interview_kits_candidate", "interview_kits", ["candidate_id"])

    op.create_table(
        "interview_questions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("kit_id", UUID(as_uuid=True), sa.ForeignKey("interview_kits.id", ondelete="CASCADE"), nullable=False),
        sa.Column("question_text", sa.Text, nullable=False),
        sa.Column("question_type", sa.String(20), nullable=False),  # technical|behavioral|gap_probe
        sa.Column("competency_area", sa.String(100), nullable=True),
        sa.Column("difficulty", sa.String(10), nullable=True),  # Easy|Medium|Hard
        sa.Column("criterion_id", UUID(as_uuid=True), sa.ForeignKey("job_criteria.id", ondelete="SET NULL"), nullable=True),
        sa.Column("suggested_answer", sa.Text, nullable=True),
        sa.Column("green_flags", sa.JSON, nullable=True),   # list[str]
        sa.Column("red_flags", sa.JSON, nullable=True),     # list[str]
        sa.Column("gap_skill", sa.String(200), nullable=True),
        sa.Column("gap_criticality", sa.String(20), nullable=True),  # critical|important|minor
        sa.Column("display_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("is_edited", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("idx_interview_questions_kit", "interview_questions", ["kit_id", "display_order"])


def downgrade() -> None:
    op.drop_index("idx_interview_questions_kit", "interview_questions")
    op.drop_table("interview_questions")
    op.drop_index("idx_interview_kits_candidate", "interview_kits")
    op.drop_index("idx_interview_kits_job", "interview_kits")
    op.drop_table("interview_kits")
