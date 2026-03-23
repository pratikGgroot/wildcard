import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, JSON, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class JobTemplate(Base):
    __tablename__ = "job_templates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    department: Mapped[str | None] = mapped_column(String(100))
    role_type: Mapped[str | None] = mapped_column(String(100))
    template_data: Mapped[dict] = mapped_column(JSON, nullable=False)
    scope: Mapped[str] = mapped_column(String(20), nullable=False, default="personal")
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    usage_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=datetime.utcnow)

    creator: Mapped["User"] = relationship("User", foreign_keys=[created_by])  # noqa: F821

    __table_args__ = (
        Index("idx_job_templates_scope", "scope"),
        Index("idx_job_templates_created_by", "created_by"),
    )
