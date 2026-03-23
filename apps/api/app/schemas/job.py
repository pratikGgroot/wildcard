import re
import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


def _strip_html(value: str) -> str:
    """Strip HTML tags to get plain text for length validation."""
    return re.sub(r"<[^>]+>", "", value).replace("&nbsp;", " ").strip()



# ── Job Type & Status enums ──────────────────────────────────────────────────

JobType = Literal["full-time", "contract", "internship"]
JobStatus = Literal["draft", "active", "paused", "closed"]
AssignmentRole = Literal["recruiter", "hiring_manager"]

# Valid state machine transitions
VALID_TRANSITIONS: dict[str, list[str]] = {
    "draft": ["active"],
    "active": ["paused", "closed"],
    "paused": ["active", "closed"],
    "closed": [],  # terminal
}


# ── Assignment schemas ───────────────────────────────────────────────────────

class AssignmentCreate(BaseModel):
    user_id: uuid.UUID
    role: AssignmentRole


class AssignmentOut(BaseModel):
    id: uuid.UUID
    job_id: uuid.UUID
    user_id: uuid.UUID
    role: AssignmentRole
    assigned_at: datetime

    model_config = {"from_attributes": True}


# ── Status history ───────────────────────────────────────────────────────────

class StatusHistoryOut(BaseModel):
    id: uuid.UUID
    from_status: str | None
    to_status: str
    reason: str | None
    changed_by: uuid.UUID | None
    changed_at: datetime

    model_config = {"from_attributes": True}


# ── Job CRUD schemas ─────────────────────────────────────────────────────────

class JobCreate(BaseModel):
    title: str = Field(..., min_length=5, max_length=200)
    description: str = Field(..., max_length=50000)  # raw HTML can be longer
    department: str | None = Field(None, max_length=100)
    location: str | None = Field(None, max_length=100)
    type: JobType
    template_id: uuid.UUID | None = None  # if set, criteria are copied from template

    @field_validator("title")
    @classmethod
    def strip_title(cls, v: str) -> str:
        return v.strip()

    @field_validator("description")
    @classmethod
    def validate_description_length(cls, v: str) -> str:
        plain = _strip_html(v)
        if len(plain) < 50:
            raise ValueError("Description must be at least 50 characters")
        if len(plain) > 10000:
            raise ValueError("Description must be at most 10,000 characters")
        return v

    @field_validator("department", "location", mode="before")
    @classmethod
    def empty_str_to_none(cls, v: object) -> object:
        if isinstance(v, str) and v.strip() == "":
            return None
        return v


class JobUpdate(BaseModel):
    title: str | None = Field(None, min_length=5, max_length=200)
    description: str | None = Field(None, max_length=50000)
    department: str | None = Field(None, max_length=100)
    location: str | None = Field(None, max_length=100)
    type: JobType | None = None

    @field_validator("description")
    @classmethod
    def validate_description_length(cls, v: str | None) -> str | None:
        if v is None:
            return v
        plain = _strip_html(v)
        if len(plain) < 50:
            raise ValueError("Description must be at least 50 characters")
        if len(plain) > 10000:
            raise ValueError("Description must be at most 10,000 characters")
        return v

    @field_validator("department", "location", mode="before")
    @classmethod
    def empty_str_to_none(cls, v: object) -> object:
        if isinstance(v, str) and v.strip() == "":
            return None
        return v


class JobStatusChange(BaseModel):
    status: JobStatus
    reason: str | None = Field(None, max_length=500)

    @field_validator("status")
    @classmethod
    def not_draft(cls, v: str) -> str:
        # draft is only set on creation, not via status change endpoint
        if v == "draft":
            raise ValueError("Cannot transition back to draft")
        return v


class JobOut(BaseModel):
    id: uuid.UUID
    title: str
    department: str | None
    location: str | None
    type: str
    description: str
    status: str
    close_reason: str | None
    created_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    assignments: list[AssignmentOut] = []

    model_config = {"from_attributes": True}


class JobListOut(BaseModel):
    id: uuid.UUID
    title: str
    department: str | None
    location: str | None
    type: str
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PaginatedJobs(BaseModel):
    items: list[JobListOut]
    total: int
    page: int
    page_size: int
