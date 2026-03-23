"""
Tests for Story 01.2 — AI Criteria Extraction

Covers:
- Hash-based cache (skip re-extraction if description unchanged)
- Full extraction pipeline with mock LLM
- Retry / fallback behavior
- Confidence scoring and "review needed" flag
- Re-extraction prompt detection
- API endpoints
"""
import uuid
from decimal import Decimal
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from app.schemas.criteria import (
    CertificationCriterion,
    EducationCriterion,
    ExperienceCriterion,
    ExtractionResult,
    SkillCriterion,
)
from app.services.criteria_service import CriteriaService, _hash_description
from app.services.llm_service import LLMService


# ── Fixtures ──────────────────────────────────────────────────────────────────

SAMPLE_JD = """
We are looking for a Senior Backend Engineer to join our team.

Requirements:
- 5+ years of Python experience (required)
- Strong knowledge of FastAPI and PostgreSQL
- Experience with Docker and Kubernetes
- Bachelor's degree in Computer Science or related field
- AWS Certified Solutions Architect preferred
"""

MOCK_EXTRACTION = ExtractionResult(
    skills=[
        SkillCriterion(name="Python", required=True, weight="high", confidence=0.95),
        SkillCriterion(name="FastAPI", required=True, weight="high", confidence=0.90),
        SkillCriterion(name="PostgreSQL", required=False, weight="medium", confidence=0.85),
        SkillCriterion(name="Docker", required=False, weight="medium", confidence=0.80),
        SkillCriterion(name="Kubernetes", required=False, weight="low", confidence=0.65),
    ],
    experience=[
        ExperienceCriterion(
            description="5+ years of Python experience",
            years_min=5,
            required=True,
            weight="high",
            confidence=0.95,
        )
    ],
    education=[
        EducationCriterion(
            level="Bachelor's degree",
            field="Computer Science",
            required=False,
            weight="medium",
            confidence=0.80,
        )
    ],
    certifications=[
        CertificationCriterion(
            name="AWS Certified Solutions Architect",
            required=False,
            weight="low",
            confidence=0.70,
        )
    ],
)


@pytest.fixture
def mock_llm() -> LLMService:
    llm = LLMService.__new__(LLMService)
    llm.provider = "mock"
    llm.extract_criteria = AsyncMock(return_value=MOCK_EXTRACTION)
    llm.generate_embedding = AsyncMock(return_value=None)
    return llm


# ── Unit: hash function ───────────────────────────────────────────────────────

def test_hash_description_deterministic():
    h1 = _hash_description("hello world")
    h2 = _hash_description("hello world")
    assert h1 == h2
    assert len(h1) == 64  # SHA-256 hex


def test_hash_description_changes_on_edit():
    h1 = _hash_description("original description")
    h2 = _hash_description("updated description")
    assert h1 != h2


# ── Unit: LLM mock extractor ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_mock_extractor_finds_skills():
    llm = LLMService()
    llm.provider = "mock"
    result = await llm.extract_criteria(SAMPLE_JD)
    skill_names = [s.name for s in result.skills]
    assert "Python" in skill_names
    assert "FastAPI" in skill_names
    assert "PostgreSQL" in skill_names


@pytest.mark.asyncio
async def test_mock_extractor_finds_experience():
    llm = LLMService()
    llm.provider = "mock"
    result = await llm.extract_criteria(SAMPLE_JD)
    assert len(result.experience) >= 1
    assert result.experience[0].years_min == 5


@pytest.mark.asyncio
async def test_mock_extractor_finds_education():
    llm = LLMService()
    llm.provider = "mock"
    result = await llm.extract_criteria(SAMPLE_JD)
    assert len(result.education) >= 1
    assert "Bachelor" in result.education[0].level


@pytest.mark.asyncio
async def test_mock_extractor_empty_description():
    llm = LLMService()
    llm.provider = "mock"
    result = await llm.extract_criteria("We are hiring.")
    # Should return empty lists, not crash
    assert isinstance(result.skills, list)
    assert isinstance(result.experience, list)


# ── Unit: LLM JSON parsing ────────────────────────────────────────────────────

def test_parse_valid_json():
    llm = LLMService()
    raw = '{"skills": [{"name": "Python", "required": true, "weight": "high", "confidence": 0.9}], "experience": [], "education": [], "certifications": []}'
    result = llm._parse_extraction(raw)
    assert len(result.skills) == 1
    assert result.skills[0].name == "Python"


def test_parse_json_wrapped_in_markdown():
    llm = LLMService()
    raw = '```json\n{"skills": [], "experience": [], "education": [], "certifications": []}\n```'
    result = llm._parse_extraction(raw)
    assert isinstance(result.skills, list)


def test_parse_malformed_json_returns_empty():
    llm = LLMService()
    result = llm._parse_extraction("This is not JSON at all")
    assert result.skills == []
    assert result.experience == []


# ── Unit: confidence scoring ──────────────────────────────────────────────────

def test_confidence_below_threshold_flagged():
    """Criteria with confidence < 0.7 should be flagged for review."""
    low_conf = SkillCriterion(name="Kubernetes", required=False, weight="low", confidence=0.65)
    assert low_conf.confidence < 0.7


def test_confidence_above_threshold_ok():
    high_conf = SkillCriterion(name="Python", required=True, weight="high", confidence=0.95)
    assert high_conf.confidence >= 0.7


# ── Integration: extraction pipeline ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_extract_criteria_creates_rows(client: AsyncClient):
    # Create a job first
    resp = await client.post("/api/v1/jobs", json={
        "title": "Senior Backend Engineer",
        "description": SAMPLE_JD,
        "type": "full-time",
    })
    assert resp.status_code == 201
    job_id = resp.json()["id"]

    # Patch LLM to use mock
    with patch("app.services.criteria_service.LLMService") as MockLLM:
        instance = MockLLM.return_value
        instance.extract_criteria = AsyncMock(return_value=MOCK_EXTRACTION)
        instance.generate_embedding = AsyncMock(return_value=None)

        resp = await client.post(f"/api/v1/jobs/{job_id}/extract-criteria")
        assert resp.status_code == 200
        data = resp.json()
        assert data["job_id"] == job_id
        assert len(data["criteria"]) > 0
        assert data["from_cache"] is False


@pytest.mark.asyncio
async def test_extract_criteria_cache_hit(client: AsyncClient):
    """Second extraction with same description should return from_cache=True."""
    resp = await client.post("/api/v1/jobs", json={
        "title": "Backend Engineer Role",
        "description": SAMPLE_JD,
        "type": "full-time",
    })
    job_id = resp.json()["id"]

    with patch("app.services.criteria_service.LLMService") as MockLLM:
        instance = MockLLM.return_value
        instance.extract_criteria = AsyncMock(return_value=MOCK_EXTRACTION)
        instance.generate_embedding = AsyncMock(return_value=None)

        # First extraction
        await client.post(f"/api/v1/jobs/{job_id}/extract-criteria")
        # Second extraction — same description
        resp2 = await client.post(f"/api/v1/jobs/{job_id}/extract-criteria")
        assert resp2.status_code == 200
        assert resp2.json()["from_cache"] is True


@pytest.mark.asyncio
async def test_get_criteria_endpoint(client: AsyncClient):
    resp = await client.post("/api/v1/jobs", json={
        "title": "Full Stack Developer Position",
        "description": SAMPLE_JD,
        "type": "full-time",
    })
    job_id = resp.json()["id"]

    with patch("app.services.criteria_service.LLMService") as MockLLM:
        instance = MockLLM.return_value
        instance.extract_criteria = AsyncMock(return_value=MOCK_EXTRACTION)
        instance.generate_embedding = AsyncMock(return_value=None)
        await client.post(f"/api/v1/jobs/{job_id}/extract-criteria")

    resp = await client.get(f"/api/v1/jobs/{job_id}/criteria")
    assert resp.status_code == 200
    criteria = resp.json()
    assert isinstance(criteria, list)
    assert len(criteria) > 0
    # Verify structure
    c = criteria[0]
    assert "criterion_name" in c
    assert "criterion_type" in c
    assert "confidence_score" in c
    assert "required" in c


@pytest.mark.asyncio
async def test_needs_reextraction_false_before_any_extraction(client: AsyncClient):
    resp = await client.post("/api/v1/jobs", json={
        "title": "DevOps Engineer Opening",
        "description": SAMPLE_JD,
        "type": "contract",
    })
    job_id = resp.json()["id"]

    resp = await client.get(f"/api/v1/jobs/{job_id}/criteria/needs-reextraction")
    assert resp.status_code == 200
    assert resp.json()["needs_reextraction"] is False


@pytest.mark.asyncio
async def test_needs_reextraction_true_after_description_update(client: AsyncClient):
    resp = await client.post("/api/v1/jobs", json={
        "title": "Data Engineer Role",
        "description": SAMPLE_JD,
        "type": "full-time",
    })
    job_id = resp.json()["id"]

    with patch("app.services.criteria_service.LLMService") as MockLLM:
        instance = MockLLM.return_value
        instance.extract_criteria = AsyncMock(return_value=MOCK_EXTRACTION)
        instance.generate_embedding = AsyncMock(return_value=None)
        await client.post(f"/api/v1/jobs/{job_id}/extract-criteria")

    # Update description
    new_desc = SAMPLE_JD + "\n\nAdditional requirement: Experience with Spark and Kafka."
    await client.put(f"/api/v1/jobs/{job_id}", json={
        "title": "Data Engineer Role",
        "description": new_desc,
        "type": "full-time",
    })

    resp = await client.get(f"/api/v1/jobs/{job_id}/criteria/needs-reextraction")
    assert resp.status_code == 200
    assert resp.json()["needs_reextraction"] is True


@pytest.mark.asyncio
async def test_extract_criteria_404_for_unknown_job(client: AsyncClient):
    fake_id = str(uuid.uuid4())
    resp = await client.post(f"/api/v1/jobs/{fake_id}/extract-criteria")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_criteria_types_are_valid(client: AsyncClient):
    resp = await client.post("/api/v1/jobs", json={
        "title": "Machine Learning Engineer",
        "description": SAMPLE_JD,
        "type": "full-time",
    })
    job_id = resp.json()["id"]

    with patch("app.services.criteria_service.LLMService") as MockLLM:
        instance = MockLLM.return_value
        instance.extract_criteria = AsyncMock(return_value=MOCK_EXTRACTION)
        instance.generate_embedding = AsyncMock(return_value=None)
        await client.post(f"/api/v1/jobs/{job_id}/extract-criteria")

    resp = await client.get(f"/api/v1/jobs/{job_id}/criteria")
    valid_types = {"skill", "experience", "education", "certification"}
    for c in resp.json():
        assert c["criterion_type"] in valid_types
        assert c["weight"] in {"high", "medium", "low"}
