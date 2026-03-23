import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

CriterionType = Literal["skill", "experience", "education", "certification"]
CriterionWeight = Literal["high", "medium", "low"]


# ── LLM extraction output schema ─────────────────────────────────────────────

class SkillCriterion(BaseModel):
    name: str
    required: bool = False
    weight: CriterionWeight = "medium"
    confidence: float = Field(ge=0.0, le=1.0)


class ExperienceCriterion(BaseModel):
    description: str
    years_min: int | None = None
    required: bool = False
    weight: CriterionWeight = "medium"
    confidence: float = Field(ge=0.0, le=1.0)


class EducationCriterion(BaseModel):
    level: str
    field: str | None = None
    required: bool = False
    weight: CriterionWeight = "medium"
    confidence: float = Field(ge=0.0, le=1.0)


class CertificationCriterion(BaseModel):
    name: str
    required: bool = False
    weight: CriterionWeight = "medium"
    confidence: float = Field(ge=0.0, le=1.0)


class ExtractionResult(BaseModel):
    """Structured output from LLM extraction."""
    skills: list[SkillCriterion] = []
    experience: list[ExperienceCriterion] = []
    education: list[EducationCriterion] = []
    certifications: list[CertificationCriterion] = []


# ── API response schemas ──────────────────────────────────────────────────────

class CriteriaOut(BaseModel):
    id: uuid.UUID
    job_id: uuid.UUID
    criterion_name: str
    criterion_type: CriterionType
    weight: CriterionWeight
    required: bool
    confidence_score: Decimal | None
    ai_extracted: bool
    extra_data: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ExtractionResponse(BaseModel):
    job_id: uuid.UUID
    criteria: list[CriteriaOut]
    extracted_at: datetime
    from_cache: bool = False
    embedding_stored: bool = False


# ── CRUD schemas ──────────────────────────────────────────────────────────────

class CriteriaCreate(BaseModel):
    criterion_name: str = Field(min_length=2, max_length=200)
    criterion_type: CriterionType
    weight: CriterionWeight = "medium"
    required: bool = False
    extra_data: dict | None = None


class CriteriaUpdate(BaseModel):
    criterion_name: str | None = Field(default=None, min_length=2, max_length=200)
    criterion_type: CriterionType | None = None
    weight: CriterionWeight | None = None
    required: bool | None = None
    extra_data: dict | None = None


class BulkCriteriaUpdate(BaseModel):
    """Bulk upsert — replaces all criteria for a job."""
    criteria: list[CriteriaCreate]


# ── Suggestion schemas ────────────────────────────────────────────────────────

class CriteriaSuggestion(BaseModel):
    criterion_name: str
    criterion_type: CriterionType
    weight: CriterionWeight
    required: bool
    extra_data: dict | None
    similarity_score: float
    source_job_id: uuid.UUID
    source_job_title: str
    usage_count: int  # how many similar jobs had this criterion


class SuggestionsResponse(BaseModel):
    job_id: uuid.UUID
    suggestions: list[CriteriaSuggestion]
    similar_jobs_found: int
    has_enough_history: bool  # False when < 5 closed jobs exist
