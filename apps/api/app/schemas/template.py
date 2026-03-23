import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


TemplateScope = Literal["personal", "organization"]


class TemplateCriterion(BaseModel):
    criterion_name: str
    criterion_type: str
    weight: str = "medium"
    required: bool = False
    extra_data: dict | None = None


class TemplateData(BaseModel):
    title: str
    description: str
    department: str | None = None
    location: str | None = None
    type: str = "full-time"
    criteria: list[TemplateCriterion] = []


class TemplateCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    department: str | None = None
    role_type: str | None = None
    scope: TemplateScope = "personal"
    template_data: TemplateData


class TemplateUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    department: str | None = None
    role_type: str | None = None
    scope: TemplateScope | None = None
    template_data: TemplateData | None = None


class TemplateOut(BaseModel):
    id: uuid.UUID
    name: str
    department: str | None
    role_type: str | None
    scope: TemplateScope
    template_data: TemplateData
    created_by: uuid.UUID | None
    usage_count: int
    last_used_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SaveAsTemplateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    scope: TemplateScope = "personal"
    role_type: str | None = None
