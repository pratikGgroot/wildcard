"""
LLM Service — wraps Ollama (local, free) with OpenAI fallback.
Falls back to mock extractor if no LLM is reachable.
"""
import json
import logging
import re
from dataclasses import dataclass, field
from typing import Any

import httpx
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.core.config import settings
from app.schemas.criteria import ExtractionResult

logger = logging.getLogger(__name__)

EXTRACTION_PROMPT = """\
Analyze this job description and extract structured screening criteria.

Job Description:
{job_description}

Return ONLY valid JSON matching this exact schema (no markdown, no explanation):
{{
  "skills": [{{"name": "string", "required": true, "weight": "high|medium|low", "confidence": 0.0}}],
  "experience": [{{"description": "string", "years_min": null, "required": true, "weight": "high|medium|low", "confidence": 0.0}}],
  "education": [{{"level": "string", "field": null, "required": true, "weight": "high|medium|low", "confidence": 0.0}}],
  "certifications": [{{"name": "string", "required": true, "weight": "high|medium|low", "confidence": 0.0}}]
}}

Rules:
- confidence: 0.0-1.0 based on how explicitly stated the requirement is
- required: true only if explicitly stated as "must have", "required", or "essential"
- Normalize skill names (e.g. "React.js" -> "React", "Postgres" -> "PostgreSQL")
- Extract ALL skills: languages, frameworks, tools, methodologies
- Return empty arrays for categories with no criteria found
"""

RESUME_EXTRACTION_PROMPT = """\
You are a resume parsing assistant. Extract ALL structured information from the resume text below.

Return ONLY valid JSON with this exact schema (no markdown, no explanation):
{{
  "full_name": null,
  "email": null,
  "phone": null,
  "location": null,
  "linkedin_url": null,
  "total_years_experience": null,
  "highest_degree": null,
  "skills": [],
  "inferred_skills": [],
  "experience": [],
  "education": [],
  "certifications": [],
  "projects": [],
  "_confidence": {{"full_name": 0.0, "email": 0.0, "experience": 0.0, "skills": 0.0}}
}}

Schema details:
- full_name: person's full name as written at the top of the resume
- email: email address string or null
- phone: phone number string or null
- location: city/state/country or null
- linkedin_url: LinkedIn profile URL or null
- total_years_experience: float — sum of all work experience durations; compute from dates if available
- highest_degree: string like "Bachelor's in Computer Science" or "Master's in Business Administration" or null
- skills: list of ALL skill/technology strings found ANYWHERE in the resume — scan EVERY section including "Programming Skills", "Computer Skills", "Technical Skills", "Tools", "Languages", "Frameworks", "Coursework", and any other section. Include ALL items from ALL skill subsections.
- inferred_skills: skills strongly implied by job titles or responsibilities but not explicitly listed (e.g. "Led Kubernetes migrations" → ["Kubernetes", "DevOps"])
- experience: list of work experience entries — EVERY job must include "company" (the employer name), "title" (job title), "start_date" (YYYY-MM or null), "end_date" (YYYY-MM or null, use null for current), "responsibilities" (list of bullet point strings)
- education: list of ALL education entries — each must include "institution" (school/university name), "degree" (e.g. "B.Tech", "Class 12"), "field" (subject/major or null), "start_date" (YYYY or YYYY-MM or null), "end_date" (YYYY or YYYY-MM or null)
- certifications: list of certification name strings
- projects: list of project entries — each must include "name" (project title), "description" (brief summary), "technologies" (list of tech used)
- _confidence: confidence 0.0–1.0 per field

CRITICAL RULES:
- "company" in experience is REQUIRED — always extract the employer/organization name; never leave it null or empty
- Extract ALL jobs listed, not just the most recent one
- Extract ALL education entries (university, high school, etc.)
- Extract ALL skills from ALL sections — do not skip any skill subsection
- Use null for missing contact fields, never guess
- Return empty arrays [] when no items found
- Do not include markdown, code fences, or explanation — output raw JSON only

Resume Text:
{resume_text}
"""


# ── Skill section regex scanner ───────────────────────────────────────────────
# Only matches known technical skill section headers, not "Financial Skills" etc.
_SKILL_SECTION_RE = re.compile(
    r"(?:programming|computer|technical|software|tools?|languages?|frameworks?|platforms?)"
    r"\s*(?:skills?|proficiencies|stack)?\s*:\s*(.*?)(?=\n\s*\n|\n[A-Z][^\n]{0,50}:|\Z)",
    re.IGNORECASE | re.DOTALL,
)
_ITEM_SPLIT_RE = re.compile(r"[,\n•·|/]+")
_NOISE_RE = re.compile(r"\b(and|the|of|for|in|to|a|an|is|are|was|were|with|by|at|from)\b", re.IGNORECASE)


def _merge_skills_from_text(llm_skills: list[str], text: str) -> list[str]:
    """Scan raw resume text for skill sections and merge items the LLM missed."""
    seen = {s.lower() for s in llm_skills}
    extra: list[str] = []
    for match in _SKILL_SECTION_RE.finditer(text):
        block = match.group(1)
        for item in _ITEM_SPLIT_RE.split(block):
            item = item.strip().strip(".")
            words = item.split()
            # Skip: too short/long, sentence-like (>4 words), noise-word-heavy,
            # starts with punctuation/digit/paren, or is a single common word
            if not item or len(item) < 2 or len(item) > 40:
                continue
            if len(words) > 4:
                continue
            if item[0] in "(-0123456789":
                continue
            if _NOISE_RE.search(item) and len(words) > 2:
                continue
            if len(words) == 1 and item.lower() in {"the", "and", "or", "etc", "of", "in", "a"}:
                continue
            if item.lower() not in seen:
                seen.add(item.lower())
                extra.append(item)
    if extra:
        logger.debug("Skill scanner added %d items missed by LLM: %s", len(extra), extra[:10])
    return llm_skills + extra


@dataclass
class ResumeProfile:
    full_name: str | None = None
    email: str | None = None
    phone: str | None = None
    location: str | None = None
    linkedin_url: str | None = None
    total_years_experience: float | None = None
    highest_degree: str | None = None
    skills: list[str] = field(default_factory=list)
    inferred_skills: list[str] = field(default_factory=list)
    experience: list[dict] = field(default_factory=list)
    education: list[dict] = field(default_factory=list)
    certifications: list[str] = field(default_factory=list)
    projects: list[dict] = field(default_factory=list)
    confidence: dict[str, float] = field(default_factory=dict)
    needs_review: bool = False  # True if any key field confidence < 0.7


class LLMService:
    """Handles LLM calls with retry, provider switching, and mock fallback."""

    def __init__(self) -> None:
        self.provider = settings.LLM_PROVIDER

    # ── Public API ────────────────────────────────────────────────────────────

    async def health_check(self) -> dict[str, Any]:
        """Check LLM provider connectivity. Returns status dict."""
        if self.provider == "mock":
            return {"provider": "mock", "status": "ok", "model": "mock-extractor"}

        try:
            if self.provider == "ollama":
                async with httpx.AsyncClient(timeout=5.0) as client:
                    resp = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
                    resp.raise_for_status()
                    models = [m["name"] for m in resp.json().get("models", [])]
                    llm_ready = any(settings.OLLAMA_MODEL in m for m in models)
                    embed_ready = any(settings.OLLAMA_EMBED_MODEL in m for m in models)
                    return {
                        "provider": "ollama",
                        "status": "ok" if llm_ready else "model_missing",
                        "model": settings.OLLAMA_MODEL,
                        "embed_model": settings.OLLAMA_EMBED_MODEL,
                        "llm_model_ready": llm_ready,
                        "embed_model_ready": embed_ready,
                        "available_models": models,
                    }
            elif self.provider == "openai":
                return {
                    "provider": "openai",
                    "status": "ok" if settings.OPENAI_API_KEY else "missing_api_key",
                    "model": settings.OPENAI_MODEL,
                }
        except Exception as exc:
            return {
                "provider": self.provider,
                "status": "unreachable",
                "error": str(exc),
            }

        return {"provider": self.provider, "status": "unknown"}

    async def extract_resume_entities(self, resume_text: str) -> ResumeProfile:
        """
        Extract structured entities from raw resume text using the LLM.
        Falls back to an empty profile on failure (never raises).
        Celery tasks call this via asyncio.run() since Celery workers are sync.
        """
        # Truncate to ~12000 chars to stay within token budget (llama3.2 supports it)
        text = resume_text[:12000].strip()

        try:
            if self.provider == "ollama":
                raw = await self._ollama_resume_chat(text)
            elif self.provider == "openai":
                raw = await self._openai_resume_chat(text)
            else:
                logger.info("LLM provider is mock — skipping resume entity extraction")
                return ResumeProfile()

            profile = self._parse_resume_profile(raw)
            # Post-process: scan raw text for skill sections the LLM may have missed
            profile.skills = _merge_skills_from_text(profile.skills, text)
            return profile

        except Exception as exc:
            logger.error("Resume entity extraction failed: %s", exc)
            return ResumeProfile()

    async def extract_criteria(self, job_description: str) -> ExtractionResult:
        """Extract structured criteria from a job description."""
        clean_text = re.sub(r"<[^>]+>", " ", job_description).strip()
        # Collapse multiple spaces/newlines
        clean_text = re.sub(r"\s+", " ", clean_text).strip()

        if self.provider == "mock":
            return self._mock_extract(clean_text)

        try:
            if self.provider == "ollama":
                raw = await self._ollama_chat(clean_text)
            elif self.provider == "openai":
                raw = await self._openai_chat(clean_text)
            else:
                logger.warning("Unknown LLM provider '%s', using mock", self.provider)
                return self._mock_extract(clean_text)

            result = self._parse_extraction(raw)
            # If LLM returned empty result, fall back to mock
            if not result.skills and not result.experience and not result.education:
                logger.warning("LLM returned empty extraction, falling back to mock")
                return self._mock_extract(clean_text)
            return result

        except Exception as exc:
            logger.error("LLM extraction failed: %s — using mock fallback", exc)
            return self._mock_extract(clean_text)

    async def generate_embedding(self, text: str) -> list[float] | None:
        """Generate a text embedding vector. Returns None if unavailable."""
        clean_text = re.sub(r"<[^>]+>", " ", text).strip()[:4000]

        if self.provider == "mock":
            return None

        try:
            if self.provider == "ollama":
                return await self._ollama_embed(clean_text)
            elif self.provider == "openai":
                return await self._openai_embed(clean_text)
        except Exception as exc:
            logger.warning("Embedding generation failed: %s", exc)

        return None

    # ── Ollama ────────────────────────────────────────────────────────────────

    @retry(
        retry=retry_if_exception_type((httpx.HTTPError, httpx.TimeoutException)),
        wait=wait_exponential(multiplier=1, min=1, max=4),
        stop=stop_after_attempt(3),
        reraise=True,
    )
    async def _ollama_chat(self, text: str) -> str:
        prompt = EXTRACTION_PROMPT.format(job_description=text)
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                f"{settings.OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": settings.OLLAMA_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "format": "json",
                    "options": {
                        "temperature": 0.1,
                        "num_predict": -1,
                    },
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("response", "")

    async def _ollama_embed(self, text: str) -> list[float]:
        """Generate embedding using Ollama. Supports both old and new API formats."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Try new /api/embed endpoint first (Ollama >= 0.1.26)
            try:
                resp = await client.post(
                    f"{settings.OLLAMA_BASE_URL}/api/embed",
                    json={"model": settings.OLLAMA_EMBED_MODEL, "input": text},
                )
                resp.raise_for_status()
                data = resp.json()
                # New API returns {"embeddings": [[...]]}
                if "embeddings" in data:
                    return data["embeddings"][0]
            except httpx.HTTPStatusError:
                pass  # fall through to legacy endpoint

            # Legacy /api/embeddings endpoint
            resp = await client.post(
                f"{settings.OLLAMA_BASE_URL}/api/embeddings",
                json={"model": settings.OLLAMA_EMBED_MODEL, "prompt": text},
            )
            resp.raise_for_status()
            return resp.json()["embedding"]

    # ── OpenAI ────────────────────────────────────────────────────────────────

    @retry(
        retry=retry_if_exception_type((httpx.HTTPError, httpx.TimeoutException)),
        wait=wait_exponential(multiplier=1, min=1, max=4),
        stop=stop_after_attempt(3),
        reraise=True,
    )
    async def _ollama_resume_chat(self, text: str) -> str:
        prompt = RESUME_EXTRACTION_PROMPT.format(resume_text=text)
        async with httpx.AsyncClient(timeout=300.0) as client:
            resp = await client.post(
                f"{settings.OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": settings.OLLAMA_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "format": "json",
                    # num_ctx: expand context window to fit long resumes + prompt
                    # num_predict: -1 = unlimited output tokens (let model finish JSON)
                    "options": {"temperature": 0.1, "num_ctx": 16384, "num_predict": -1},
                },
            )
            resp.raise_for_status()
            return resp.json().get("response", "")

    async def _openai_resume_chat(self, text: str) -> str:
        prompt = RESUME_EXTRACTION_PROMPT.format(resume_text=text)
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
                json={
                    "model": settings.OPENAI_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.1,
                },
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]

    # ── OpenAI (criteria) ─────────────────────────────────────────────────────

    @retry(
        retry=retry_if_exception_type((httpx.HTTPError, httpx.TimeoutException)),
        wait=wait_exponential(multiplier=1, min=1, max=4),
        stop=stop_after_attempt(3),
        reraise=True,
    )
    async def _openai_chat(self, text: str) -> str:
        prompt = EXTRACTION_PROMPT.format(job_description=text)
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
                json={
                    "model": settings.OPENAI_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.1,
                },
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]

    async def _openai_embed(self, text: str) -> list[float]:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/embeddings",
                headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
                json={"model": "text-embedding-3-small", "input": text},
            )
            resp.raise_for_status()
            return resp.json()["data"][0]["embedding"]

    # ── Parsing ───────────────────────────────────────────────────────────────

    def _parse_resume_profile(self, raw: str) -> ResumeProfile:
        """Parse LLM JSON output into ResumeProfile, tolerating partial output."""
        try:
            match = re.search(r"\{.*\}", raw, re.DOTALL)
            if match:
                raw = match.group(0)
            data: dict[str, Any] = json.loads(raw)
        except json.JSONDecodeError as exc:
            # Attempt to repair truncated JSON by closing open structures
            logger.warning("JSON parse failed (%s) — attempting repair on %.100s…", exc, raw[:100])
            data = self._repair_truncated_json(raw)
            if not data:
                logger.warning("JSON repair failed — raw: %.300s", raw)
                return ResumeProfile()
        except Exception as exc:
            logger.warning("Failed to parse resume LLM output: %s\nRaw: %.300s", exc, raw)
            return ResumeProfile()

        confidence: dict[str, float] = data.get("_confidence") or {}
        LOW_CONF = 0.7
        needs_review = any(
            v < LOW_CONF for k, v in confidence.items() if k in ("full_name", "email", "experience")
        )

        def _str(key: str) -> str | None:
            v = data.get(key)
            return str(v).strip() if v and str(v).strip() else None

        def _float(key: str) -> float | None:
            v = data.get(key)
            try:
                return float(v) if v is not None else None
            except (TypeError, ValueError):
                return None

        def _list_str(key: str) -> list[str]:
            v = data.get(key)
            if not isinstance(v, list):
                return []
            return [str(i) for i in v if i]

        def _list_dict(key: str) -> list[dict]:
            v = data.get(key)
            if not isinstance(v, list):
                return []
            return [i for i in v if isinstance(i, dict)]

        return ResumeProfile(
            full_name=_str("full_name"),
            email=_str("email"),
            phone=_str("phone"),
            location=_str("location"),
            linkedin_url=_str("linkedin_url"),
            total_years_experience=_float("total_years_experience"),
            highest_degree=_str("highest_degree"),
            skills=_list_str("skills"),
            inferred_skills=_list_str("inferred_skills"),
            experience=_list_dict("experience"),
            education=_list_dict("education"),
            certifications=_list_str("certifications"),
            projects=_list_dict("projects"),
            confidence=confidence,
            needs_review=needs_review,
        )

    def _parse_extraction(self, raw: str) -> ExtractionResult:
        """Parse LLM JSON output into ExtractionResult, tolerating partial output."""
        try:
            match = re.search(r"\{.*\}", raw, re.DOTALL)
            if match:
                raw = match.group(0)
            data: dict[str, Any] = json.loads(raw)
            return ExtractionResult.model_validate(data)
        except Exception as exc:
            logger.warning("Failed to parse LLM output: %s\nRaw: %.300s", exc, raw)
            return ExtractionResult()

    # ── JSON repair ───────────────────────────────────────────────────────────

    @staticmethod
    def _repair_truncated_json(raw: str) -> dict[str, Any]:
        """
        Try to salvage a truncated JSON string by closing open brackets/braces.
        Returns parsed dict on success, empty dict on failure.
        """
        # Find the outermost { ... }
        start = raw.find("{")
        if start == -1:
            return {}
        s = raw[start:]

        # Count open brackets to figure out how many closers to append
        depth_curly = 0
        depth_square = 0
        in_string = False
        escape_next = False

        for ch in s:
            if escape_next:
                escape_next = False
                continue
            if ch == "\\" and in_string:
                escape_next = True
                continue
            if ch == '"':
                in_string = not in_string
                continue
            if in_string:
                continue
            if ch == "{":
                depth_curly += 1
            elif ch == "}":
                depth_curly -= 1
            elif ch == "[":
                depth_square += 1
            elif ch == "]":
                depth_square -= 1

        # Strip trailing incomplete string/value
        # Remove trailing comma or partial token before closing
        s = re.sub(r',\s*$', '', s.rstrip())
        s = re.sub(r',\s*"[^"]*$', '', s)  # remove trailing incomplete key

        # Append missing closers
        s += "]" * max(depth_square, 0)
        s += "}" * max(depth_curly, 0)

        try:
            return json.loads(s)
        except Exception:
            return {}

    # ── Mock fallback ─────────────────────────────────────────────────────────

    def _mock_extract(self, text: str) -> ExtractionResult:
        """Deterministic keyword-based mock extractor."""
        text_lower = text.lower()

        skill_keywords = [
            ("Python", 0.95), ("JavaScript", 0.92), ("TypeScript", 0.90),
            ("React", 0.88), ("Node.js", 0.85), ("PostgreSQL", 0.82),
            ("Docker", 0.80), ("Kubernetes", 0.78), ("AWS", 0.75),
            ("FastAPI", 0.85), ("SQL", 0.80), ("Git", 0.70),
            ("REST API", 0.82), ("GraphQL", 0.78), ("Redis", 0.75),
            ("Go", 0.80), ("Rust", 0.78), ("Java", 0.82),
            ("Next.js", 0.83), ("Vue", 0.80), ("Angular", 0.78),
            ("MongoDB", 0.78), ("Elasticsearch", 0.75), ("Kafka", 0.75),
            ("Terraform", 0.75), ("CI/CD", 0.78), ("Linux", 0.72),
        ]

        from app.schemas.criteria import (
            SkillCriterion, ExperienceCriterion, EducationCriterion,
        )

        skills = [
            SkillCriterion(
                name=name,
                required="required" in text_lower or "must" in text_lower,
                weight="high" if conf > 0.85 else "medium",
                confidence=conf,
            )
            for name, conf in skill_keywords
            if name.lower() in text_lower
        ]

        experience = []
        for years in [1, 2, 3, 5, 7, 10]:
            if f"{years}+" in text or f"{years} year" in text_lower:
                experience.append(ExperienceCriterion(
                    description=f"{years}+ years of relevant experience",
                    years_min=years,
                    required=True,
                    weight="high",
                    confidence=0.85,
                ))
                break

        education = []
        if any(w in text_lower for w in ["bachelor", "b.s.", "bs degree", "undergraduate"]):
            education.append(EducationCriterion(
                level="Bachelor's degree",
                field="Computer Science or related field" if "computer science" in text_lower else None,
                required="required" in text_lower,
                weight="medium",
                confidence=0.80,
            ))
        elif any(w in text_lower for w in ["master", "m.s.", "ms degree", "graduate degree"]):
            education.append(EducationCriterion(
                level="Master's degree",
                field=None,
                required=False,
                weight="low",
                confidence=0.75,
            ))

        return ExtractionResult(skills=skills, experience=experience, education=education)
