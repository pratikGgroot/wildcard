import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

UploadStatus = Literal["queued", "uploading", "parsing", "completed", "failed"]

ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "application/zip",
    "application/x-zip-compressed",
}
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc", ".zip"}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


class UploadUrlRequest(BaseModel):
    file_name: str = Field(min_length=1, max_length=200)
    file_size_bytes: int = Field(gt=0, le=MAX_FILE_SIZE_BYTES)
    content_type: str
    applicant_name: str | None = Field(default=None, max_length=200)
    applicant_email: str | None = Field(default=None, max_length=255)


class UploadUrlResponse(BaseModel):
    upload_id: uuid.UUID
    presigned_url: str
    file_key: str
    expires_in: int = 300  # seconds


class ParseTriggerRequest(BaseModel):
    upload_id: uuid.UUID


class ResumeUploadOut(BaseModel):
    id: uuid.UUID
    job_id: uuid.UUID
    file_name: str | None
    file_size_bytes: int | None
    status: UploadStatus
    error_message: str | None
    candidate_id: uuid.UUID | None
    applicant_name: str | None
    applicant_email: str | None
    uploaded_at: datetime
    completed_at: datetime | None

    model_config = {"from_attributes": True}


class BulkStatusResponse(BaseModel):
    job_id: uuid.UUID
    total: int
    queued: int
    uploading: int
    parsing: int
    completed: int
    failed: int
    uploads: list[ResumeUploadOut]


class CandidateOut(BaseModel):
    id: uuid.UUID
    full_name: str | None
    email: str | None
    phone: str | None
    location: str | None
    linkedin_url: str | None
    raw_resume_text: str | None
    parsing_confidence: float | None
    parsing_errors: list[str] | None
    parsed_data: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Parsing error schemas (Story 02.7) ───────────────────────────────────────

ErrorType = Literal[
    "text_extraction_failed",
    "ocr_failed",
    "llm_extraction_failed",
    "schema_validation_failed",
    "unsupported_format",
    "download_failed",
]
ErrorStatus = Literal["pending", "in_review", "resolved", "discarded", "retrying"]
ResolutionMethod = Literal["manual", "retry", "discard"]


class ParsingErrorOut(BaseModel):
    id: uuid.UUID
    upload_id: uuid.UUID
    job_id: uuid.UUID | None
    error_type: str
    error_message: str | None
    stage: str | None
    status: str
    resolved_at: datetime | None
    resolution_method: str | None
    discard_reason: str | None
    created_at: datetime
    # Denormalized from upload
    file_name: str | None = None
    applicant_name: str | None = None

    model_config = {"from_attributes": True}


class ParsingErrorDetail(ParsingErrorOut):
    raw_resume_text: str | None = None
    candidate: "CandidateOut | None" = None


class ResolveRequest(BaseModel):
    full_name: str | None = None
    email: str | None = None
    phone: str | None = None
    location: str | None = None
    skills: list[str] = []
    notes: str | None = None


class DiscardRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=500)


class ParsingErrorStats(BaseModel):
    job_id: uuid.UUID | None
    total_uploads: int
    failed: int
    error_rate: float
    high_error_rate: bool
    by_type: dict[str, int]
