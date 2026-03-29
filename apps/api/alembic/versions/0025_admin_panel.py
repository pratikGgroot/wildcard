"""Admin panel tables — organization_settings, ai_model_versions, admin_audit_log (Epic 16)

Revision ID: 0025
Revises: 0024
Create Date: 2026-03-29
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "0025"
down_revision = "0024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "organization_settings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("setting_key", sa.String(100), nullable=False, unique=True),
        sa.Column("setting_value", JSONB, nullable=False, server_default=sa.text("'{}'")),
        sa.Column("updated_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("idx_org_settings_key", "organization_settings", ["setting_key"])

    op.create_table(
        "ai_model_versions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("model_type", sa.String(50), nullable=False),   # llm | embedding
        sa.Column("model_name", sa.String(100), nullable=False),
        sa.Column("model_version", sa.String(50), nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("activated_at", sa.DateTime, nullable=True),
        sa.Column("activated_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("change_notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("idx_ai_model_versions_type", "ai_model_versions", ["model_type", "is_active"])

    op.create_table(
        "admin_audit_log",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("admin_user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("resource_type", sa.String(50), nullable=True),
        sa.Column("resource_id", UUID(as_uuid=True), nullable=True),
        sa.Column("before_state", JSONB, nullable=True),
        sa.Column("after_state", JSONB, nullable=True),
        sa.Column("ip_address", sa.String(50), nullable=True),
        sa.Column("performed_at", sa.DateTime, server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("idx_admin_audit_log_user", "admin_audit_log", ["admin_user_id", "performed_at"])
    op.create_index("idx_admin_audit_log_resource", "admin_audit_log", ["resource_type", "resource_id"])

    # Seed default org settings
    op.execute("""
        INSERT INTO organization_settings (setting_key, setting_value) VALUES
        ('company_profile', '{"name": "Apex Hire", "website": "", "industry": "", "size": ""}'),
        ('ai_governance', '{"humanInTheLoop": {"enabled": false, "requireApprovalForStageTransition": false, "requireApprovalForRejection": false}, "blindReview": {"defaultEnabled": false, "fieldsToMask": []}, "biasAudit": {"scheduleFrequency": "monthly", "alertThreshold": 15}, "candidateDisclosure": {"disclosureEnabled": true, "disclosureText": "This platform uses AI to assist in candidate screening. AI scores are advisory only."}, "automatedRejection": {"allowed": false, "requireHumanReview": true}}'),
        ('ai_model', '{"llm_provider": "ollama", "llm_model": "llama3.1:8b", "embed_model": "nomic-embed-text", "shortlist_threshold": 60, "score_weights": {"technical": 0.4, "culture": 0.3, "growth": 0.3}}'),
        ('notifications', '{"email_enabled": false, "candidate_status_emails": false, "recruiter_digest": false}')
        ON CONFLICT (setting_key) DO NOTHING
    """)


def downgrade() -> None:
    op.drop_index("idx_admin_audit_log_resource", "admin_audit_log")
    op.drop_index("idx_admin_audit_log_user", "admin_audit_log")
    op.drop_table("admin_audit_log")
    op.drop_index("idx_ai_model_versions_type", "ai_model_versions")
    op.drop_table("ai_model_versions")
    op.drop_index("idx_org_settings_key", "organization_settings")
    op.drop_table("organization_settings")
