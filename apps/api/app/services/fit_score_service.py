"""
Fit Score Service — Stories 04.2, 04.5, 04.6
Computes cosine similarity between candidate and job embeddings.
Scores are stored in fit_scores table and returned as 0–100 float.

Multi-dimensional scoring (Story 04.6) is gated by ENABLE_MULTI_DIM_SCORING env var.
"""
import json
import logging
import math
import os
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.models.candidate import Candidate, ResumeUpload
from app.models.job import Job
from app.services.embedding_service import (
    EMBED_MODEL,
    EMBED_MODEL_VERSION,
    SyncEmbeddingService,
    build_candidate_embedding_text,
    build_job_embedding_text,
)
from app.services.skill_normalizer import SKILL_ONTOLOGY, _ALIAS_MAP, _CANONICAL_LOWER

# ── Semantic skill matching helpers ──────────────────────────────────────────

# Map: canonical_lower → set of related canonicals (itself + tools that implement it)
# e.g. "ci/cd" → {"ci/cd", "jenkins", "github actions", "gitlab ci"}
_SKILL_GROUP: dict[str, set[str]] = {}
for _canon, _aliases in SKILL_ONTOLOGY.items():
    _cl = _canon.lower()
    if _cl not in _SKILL_GROUP:
        _SKILL_GROUP[_cl] = set()
    _SKILL_GROUP[_cl].add(_canon.lower())

# Also build alias → canonical for normalizing criterion names
def _normalize_criterion_skill(name: str) -> str:
    """Normalize a criterion name to its canonical skill form if possible."""
    n = name.lower().strip()
    if n in _CANONICAL_LOWER:
        return _CANONICAL_LOWER[n].lower()
    if n in _ALIAS_MAP:
        return _ALIAS_MAP[n].lower()
    return n

# CI/CD umbrella: any of these canonicals satisfies a "CI/CD" criterion
_CICD_TOOLS = {"jenkins", "github actions", "gitlab ci", "ci/cd", "circleci", "travis ci", "bamboo", "teamcity"}
_UMBRELLA_GROUPS: dict[str, set[str]] = {
    "ci/cd": _CICD_TOOLS,
    "linux": {"linux", "ubuntu", "debian", "centos", "rhel", "unix"},
    "git": {"git", "github", "gitlab", "bitbucket"},
    "rest api": {"rest api", "graphql", "grpc"},
    "aws": {"aws", "gcp", "azure"},
}

def _skill_matches(criterion_name: str, candidate_skills: set[str]) -> str:
    """
    Semantic skill match using the ontology.
    Returns 'exact', 'semantic', or 'none'.
    - exact: criterion canonical is in candidate skills
    - semantic: criterion is an umbrella concept and candidate has a tool that implements it,
                OR candidate skill normalizes to the same canonical as the criterion
    """
    norm = _normalize_criterion_skill(criterion_name)

    # Exact canonical match
    if norm in candidate_skills:
        return "exact"

    # Check if any candidate skill normalizes to the same canonical
    for cs in candidate_skills:
        cs_norm = _normalize_criterion_skill(cs)
        if cs_norm == norm:
            return "exact"

    # Umbrella / semantic match
    umbrella = _UMBRELLA_GROUPS.get(norm)
    if umbrella:
        if any(cs in umbrella or _normalize_criterion_skill(cs) in umbrella for cs in candidate_skills):
            return "semantic"

    # Reverse: candidate skill is a specific tool, criterion is the umbrella
    for cs in candidate_skills:
        cs_norm = _normalize_criterion_skill(cs)
        for umbrella_key, umbrella_set in _UMBRELLA_GROUPS.items():
            if norm in umbrella_set and cs_norm in umbrella_set:
                return "semantic"

    # Substring fallback (kept but labeled separately)
    if any(norm in cs or cs in norm for cs in candidate_skills if len(cs) >= 4 and len(norm) >= 4):
        return "partial"

    return "none"

MULTI_DIM_ENABLED = os.getenv("ENABLE_MULTI_DIM_SCORING", "false").lower() == "true"

logger = logging.getLogger(__name__)

_sync_embedder = SyncEmbeddingService()

# ── Multi-dimensional scoring helpers ────────────────────────────────────────

# Keyword sets used to classify criteria into dimensions
_TECHNICAL_KEYWORDS = {
    "python", "java", "javascript", "typescript", "react", "node", "sql", "aws", "docker",
    "kubernetes", "git", "api", "backend", "frontend", "database", "cloud", "devops",
    "machine learning", "ml", "ai", "data", "algorithm", "architecture", "system design",
    "microservices", "ci/cd", "testing", "security", "linux", "bash", "scala", "go", "rust",
    "c++", "c#", "ruby", "php", "swift", "kotlin", "flutter", "android", "ios",
}

_CULTURE_KEYWORDS = {
    "communication", "teamwork", "collaboration", "leadership", "mentoring", "agile",
    "scrum", "cross-functional", "stakeholder", "presentation", "interpersonal",
    "problem solving", "critical thinking", "adaptability", "ownership", "initiative",
    "remote", "startup", "fast-paced", "culture", "diversity", "inclusion",
}

_GROWTH_KEYWORDS = {
    "learning", "growth", "development", "training", "certification", "degree", "education",
    "university", "bachelor", "master", "phd", "bootcamp", "course", "workshop",
    "promotion", "career", "progression", "mentorship", "coaching", "research",
    "innovation", "patent", "publication", "conference", "open source",
}


def _classify_criterion(name: str) -> str:
    """Return 'technical', 'culture', or 'growth' for a criterion name."""
    n = name.lower()
    tech = sum(1 for kw in _TECHNICAL_KEYWORDS if kw in n)
    cult = sum(1 for kw in _CULTURE_KEYWORDS if kw in n)
    grow = sum(1 for kw in _GROWTH_KEYWORDS if kw in n)
    if tech >= cult and tech >= grow:
        return "technical"
    if cult >= grow:
        return "culture"
    return "growth"


def _compute_multi_dim_scores(
    candidate_skills: set[str],
    criteria: list,
    total_years: float | None,
    highest_degree: str | None,
    experience_list: list,
    certifications: list[str],
) -> dict[str, float | None]:
    """
    Compute technical / culture / growth sub-scores (0–100) from criteria matching.
    Returns dict with keys: technical_score, culture_score, growth_score.
    Each is None if no criteria exist for that dimension.
    """
    buckets: dict[str, list[float]] = {"technical": [], "culture": [], "growth": []}

    DEGREE_RANK = {"phd": 4, "doctorate": 4, "master": 3, "mba": 3, "bachelor": 2, "associate": 1}

    def _deg_rank(s: str) -> int:
        s = s.lower()
        for k, v in DEGREE_RANK.items():
            if k in s:
                return v
        return 0

    import re

    for c in criteria:
        dim = _classify_criterion(c.criterion_name)
        name_lower = c.criterion_name.lower()
        ctype = c.criterion_type
        weight_mult = {"high": 1.5, "medium": 1.0, "low": 0.5}.get(c.weight, 1.0)
        score = 0.0

        if ctype == "skill":
            match_result = _skill_matches(c.criterion_name, candidate_skills)
            if match_result == "exact":
                score = 1.0
            elif match_result == "semantic":
                score = 0.9
            elif match_result == "partial":
                score = 0.5

        elif ctype == "experience":
            m = re.search(r"(\d+)\+?\s*year", name_lower)
            req_years = int(m.group(1)) if m else None
            if req_years and total_years is not None:
                score = min(1.0, total_years / req_years)
            else:
                keywords = [w for w in name_lower.split() if len(w) > 3 and w not in ("year", "years", "experience")]
                exp_text = " ".join(
                    f"{e.get('title','')} {e.get('company','')} {' '.join(e.get('responsibilities') or [])}"
                    for e in experience_list
                ).lower()
                score = 0.8 if any(kw in exp_text for kw in keywords) else 0.0

        elif ctype == "education":
            req_rank = _deg_rank(name_lower)
            cand_rank = _deg_rank(highest_degree or "")
            if req_rank > 0:
                score = min(1.0, cand_rank / req_rank)
            else:
                edu_text = " ".join(
                    f"{e.get('degree','')} {e.get('field','')} {e.get('institution','')}"
                    for e in experience_list
                ).lower()
                keywords = [w for w in name_lower.split() if len(w) > 3]
                score = 0.8 if any(kw in edu_text for kw in keywords) else 0.0

        elif ctype == "certification":
            score = 1.0 if any(name_lower in cert or cert in name_lower for cert in certifications) else 0.0

        buckets[dim].append(score * weight_mult)

    def _avg(vals: list[float]) -> float | None:
        if not vals:
            return None
        raw = sum(vals) / len(vals)
        # Normalize: max possible weight_mult is 1.5, so divide by 1.5 to get 0–1
        return round(min(1.0, raw / 1.5) * 100, 1)

    return {
        "technical_score": _avg(buckets["technical"]),
        "culture_score": _avg(buckets["culture"]),
        "growth_score": _avg(buckets["growth"]),
    }


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors. Returns 0.0–1.0."""
    if len(a) != len(b) or not a:
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    mag_a = math.sqrt(sum(x * x for x in a))
    mag_b = math.sqrt(sum(x * x for x in b))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return max(0.0, min(1.0, dot / (mag_a * mag_b)))


def _to_score(similarity: float) -> float:
    """Convert cosine similarity (0–1) to a 0–100 fit score, rounded to 1 decimal."""
    return round(similarity * 100, 1)


class FitScoreService:
    """Async fit score service for FastAPI endpoints."""

    async def score_candidate_for_job(
        self,
        db: AsyncSession,
        candidate_id: uuid.UUID,
        job_id: uuid.UUID,
    ) -> dict:
        """Compute and store fit score for one candidate against one job."""
        # Fetch embeddings
        cand_row = await db.execute(
            text("SELECT embedding FROM candidate_embeddings WHERE candidate_id = :cid ORDER BY created_at DESC LIMIT 1"),
            {"cid": str(candidate_id)},
        )
        cand_emb_row = cand_row.fetchone()

        job_row = await db.execute(
            text("SELECT embedding FROM job_embeddings WHERE job_id = :jid ORDER BY created_at DESC LIMIT 1"),
            {"jid": str(job_id)},
        )
        job_emb_row = job_row.fetchone()

        if not cand_emb_row:
            return {"status": "error", "detail": "Candidate has no embedding — run /candidates/{id}/embed first"}
        if not job_emb_row:
            return {"status": "error", "detail": "Job has no embedding — run /jobs/{id}/embed first"}

        cand_vec: list[float] = json.loads(cand_emb_row[0])
        job_vec: list[float] = json.loads(job_emb_row[0])

        similarity = _cosine_similarity(cand_vec, job_vec)
        fit_score = _to_score(similarity)

        breakdown = {
            "cosine_similarity": round(similarity, 6),
            "fit_score": fit_score,
            "candidate_dims": len(cand_vec),
            "job_dims": len(job_vec),
        }
        weights_used = {"method": "single_embedding_cosine", "model": EMBED_MODEL}

        # Compute multi-dimensional scores if feature flag is on
        multi_dim: dict = {"technical_score": None, "culture_score": None, "growth_score": None}
        if MULTI_DIM_ENABLED:
            from sqlalchemy.orm import selectinload
            cand_row2 = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
            candidate = cand_row2.scalar_one_or_none()
            job_row2 = await db.execute(select(Job).options(selectinload(Job.criteria)).where(Job.id == job_id))
            job = job_row2.scalar_one_or_none()
            if candidate and job and job.criteria:
                pd = candidate.parsed_data or {}
                candidate_skills = set(s.lower() for s in (
                    (pd.get("normalized_skills") or []) + (pd.get("normalized_inferred") or [])
                ))
                multi_dim = _compute_multi_dim_scores(
                    candidate_skills=candidate_skills,
                    criteria=job.criteria,
                    total_years=pd.get("total_years_experience"),
                    highest_degree=pd.get("highest_degree"),
                    experience_list=pd.get("experience") or [],
                    certifications=[c.lower() for c in (pd.get("certifications") or [])],
                )
            breakdown["multi_dim"] = multi_dim

        # Mark previous scores as not current
        await db.execute(
            text("UPDATE fit_scores SET is_current = false WHERE candidate_id = :cid AND job_id = :jid"),
            {"cid": str(candidate_id), "jid": str(job_id)},
        )

        # Insert new score
        score_id = uuid.uuid4()
        await db.execute(
            text("""
                INSERT INTO fit_scores
                    (id, candidate_id, job_id, fit_score, score_breakdown, weights_used, model_name, model_version,
                     is_current, computed_at, technical_score, culture_score, growth_score)
                VALUES
                    (:id, :cid, :jid, :score, :breakdown, :weights, :model, :ver, true, now(),
                     :tech, :cult, :grow)
            """),
            {
                "id": str(score_id),
                "cid": str(candidate_id),
                "jid": str(job_id),
                "score": fit_score,
                "breakdown": json.dumps(breakdown),
                "weights": json.dumps(weights_used),
                "model": EMBED_MODEL,
                "ver": EMBED_MODEL_VERSION,
                "tech": multi_dim["technical_score"],
                "cult": multi_dim["culture_score"],
                "grow": multi_dim["growth_score"],
            },
        )
        await db.commit()

        return {
            "status": "scored",
            "candidate_id": str(candidate_id),
            "job_id": str(job_id),
            "fit_score": fit_score,
            "breakdown": breakdown,
            **multi_dim,
        }

    async def score_all_for_job(self, db: AsyncSession, job_id: uuid.UUID) -> dict:
        """Score all candidates who applied to a job."""
        # Get all completed uploads for this job with a candidate
        rows = await db.execute(
            text("""
                SELECT DISTINCT ru.candidate_id
                FROM resume_uploads ru
                WHERE ru.job_id = :jid
                  AND ru.candidate_id IS NOT NULL
                  AND ru.status = 'completed'
            """),
            {"jid": str(job_id)},
        )
        candidate_ids = [r[0] for r in rows.fetchall()]

        if not candidate_ids:
            return {"status": "ok", "scored": 0, "skipped": 0, "errors": 0, "detail": "No completed candidates for this job"}

        scored = skipped = errors = 0
        results = []

        for cid in candidate_ids:
            result = await self.score_candidate_for_job(db, cid, job_id)
            if result["status"] == "scored":
                scored += 1
            elif result["status"] == "error":
                errors += 1
                logger.warning("Fit score error for candidate %s: %s", cid, result.get("detail"))
            else:
                skipped += 1
            results.append(result)

        return {
            "status": "ok",
            "job_id": str(job_id),
            "scored": scored,
            "skipped": skipped,
            "errors": errors,
        }

    async def get_rankings(self, db: AsyncSession, job_id: uuid.UUID, sort_by: str = "fit") -> list[dict]:
        """Return ranked candidates for a job with fit scores."""
        rows = await db.execute(
            text("""
                SELECT
                    fs.candidate_id,
                    fs.fit_score,
                    fs.score_breakdown,
                    fs.computed_at,
                    c.full_name,
                    c.email,
                    c.location,
                    c.embedding_status,
                    ru.id AS upload_id,
                    fs.is_overridden,
                    fs.override_score,
                    fs.override_justification,
                    fs.original_ai_score,
                    fs.technical_score,
                    fs.culture_score,
                    fs.growth_score
                FROM fit_scores fs
                JOIN candidates c ON c.id = fs.candidate_id
                LEFT JOIN resume_uploads ru ON ru.candidate_id = fs.candidate_id AND ru.job_id = :jid
                WHERE fs.job_id = :jid AND fs.is_current = true
                ORDER BY COALESCE(CASE WHEN fs.is_overridden THEN fs.override_score END, fs.fit_score) DESC
            """),
            {"jid": str(job_id)},
        )
        results = [
            {
                "candidate_id": str(r[0]),
                "fit_score": r[10] if r[9] else r[1],
                "score_breakdown": r[2],
                "computed_at": r[3].isoformat() if r[3] else None,
                "full_name": r[4],
                "email": r[5],
                "location": r[6],
                "embedding_status": r[7],
                "upload_id": str(r[8]) if r[8] else None,
                "is_overridden": r[9],
                "override_score": r[10],
                "override_justification": r[11],
                "original_ai_score": r[12],
                "technical_score": r[13],
                "culture_score": r[14],
                "growth_score": r[15],
            }
            for r in rows.fetchall()
        ]

        # Optional dimension-based sort
        dim_key = {"technical": "technical_score", "culture": "culture_score", "growth": "growth_score"}.get(sort_by)
        if dim_key:
            results.sort(key=lambda x: (x[dim_key] is None, -(x[dim_key] or 0)))

        return results

    async def explain_fit(self, db: AsyncSession, candidate_id: uuid.UUID, job_id: uuid.UUID) -> dict:
        """
        Produce a human-readable breakdown of why a candidate scored the way they did.
        Uses structured data (parsed_data + criteria) — no extra LLM calls.
        """
        from sqlalchemy.orm import selectinload

        # Load candidate
        cand_row = await db.execute(
            select(Candidate).where(Candidate.id == candidate_id)
        )
        candidate = cand_row.scalar_one_or_none()
        if not candidate:
            return {"error": "Candidate not found"}

        # Load job with criteria
        job_row = await db.execute(
            select(Job).options(selectinload(Job.criteria)).where(Job.id == job_id)
        )
        job = job_row.scalar_one_or_none()
        if not job:
            return {"error": "Job not found"}

        # Load current fit score
        score_row = await db.execute(
            text("SELECT fit_score FROM fit_scores WHERE candidate_id = :cid AND job_id = :jid AND is_current = true"),
            {"cid": str(candidate_id), "jid": str(job_id)},
        )
        score_rec = score_row.fetchone()
        fit_score = score_rec[0] if score_rec else None

        pd = candidate.parsed_data or {}
        candidate_skills: set[str] = set(s.lower() for s in (
            (pd.get("normalized_skills") or []) + (pd.get("normalized_inferred") or [])
        ))
        experience_list: list[dict] = pd.get("experience") or []
        education_list: list[dict] = pd.get("education") or []
        total_years: float | None = pd.get("total_years_experience")
        highest_degree: str | None = pd.get("highest_degree")
        certifications: list[str] = [c.lower() for c in (pd.get("certifications") or [])]

        # ── Criteria matching ─────────────────────────────────────────────────
        matched_criteria: list[dict] = []
        missing_criteria: list[dict] = []
        partial_criteria: list[dict] = []

        DEGREE_RANK = {"phd": 4, "doctorate": 4, "master": 3, "mba": 3, "bachelor": 2, "associate": 1, "diploma": 1}

        def _degree_rank(s: str) -> int:
            s = s.lower()
            for k, v in DEGREE_RANK.items():
                if k in s:
                    return v
            return 0

        for c in (job.criteria or []):
            name_lower = c.criterion_name.lower()
            ctype = c.criterion_type

            if ctype == "skill":
                # Semantic skill match using ontology
                match_result = _skill_matches(c.criterion_name, candidate_skills)
                if match_result == "exact":
                    matched_criteria.append({"criterion": c.criterion_name, "type": ctype, "weight": c.weight, "required": c.required, "match": "exact"})
                elif match_result == "semantic":
                    matched_criteria.append({"criterion": c.criterion_name, "type": ctype, "weight": c.weight, "required": c.required, "match": "semantic"})
                elif match_result == "partial":
                    partial_criteria.append({"criterion": c.criterion_name, "type": ctype, "weight": c.weight, "required": c.required, "match": "partial"})
                else:
                    missing_criteria.append({"criterion": c.criterion_name, "type": ctype, "weight": c.weight, "required": c.required})

            elif ctype == "experience":
                # Try to extract years from criterion name e.g. "5+ years Python"
                import re
                years_match = re.search(r"(\d+)\+?\s*year", name_lower)
                required_years = int(years_match.group(1)) if years_match else None
                if required_years is not None and total_years is not None:
                    if total_years >= required_years:
                        matched_criteria.append({"criterion": c.criterion_name, "type": ctype, "weight": c.weight, "required": c.required, "match": "met", "candidate_years": total_years, "required_years": required_years})
                    elif total_years >= required_years * 0.7:
                        partial_criteria.append({"criterion": c.criterion_name, "type": ctype, "weight": c.weight, "required": c.required, "match": "partial", "candidate_years": total_years, "required_years": required_years})
                    else:
                        missing_criteria.append({"criterion": c.criterion_name, "type": ctype, "weight": c.weight, "required": c.required, "candidate_years": total_years, "required_years": required_years})
                else:
                    # Fall back to keyword match in job titles/responsibilities
                    keywords = [w for w in name_lower.split() if len(w) > 3 and w not in ("year", "years", "experience", "with")]
                    exp_text = " ".join(
                        f"{e.get('title','')} {e.get('company','')} {' '.join(e.get('responsibilities') or [])}"
                        for e in experience_list
                    ).lower()
                    if any(kw in exp_text for kw in keywords):
                        matched_criteria.append({"criterion": c.criterion_name, "type": ctype, "weight": c.weight, "required": c.required, "match": "keyword"})
                    else:
                        missing_criteria.append({"criterion": c.criterion_name, "type": ctype, "weight": c.weight, "required": c.required})

            elif ctype == "education":
                edu_text = " ".join(
                    f"{e.get('degree','')} {e.get('field','')} {e.get('institution','')}"
                    for e in education_list
                ).lower()
                keywords = [w for w in name_lower.split() if len(w) > 3]
                req_rank = _degree_rank(name_lower)
                cand_rank = _degree_rank(highest_degree or "")
                if req_rank > 0 and cand_rank >= req_rank:
                    matched_criteria.append({"criterion": c.criterion_name, "type": ctype, "weight": c.weight, "required": c.required, "match": "degree_met", "candidate_degree": highest_degree})
                elif any(kw in edu_text for kw in keywords):
                    matched_criteria.append({"criterion": c.criterion_name, "type": ctype, "weight": c.weight, "required": c.required, "match": "keyword"})
                else:
                    missing_criteria.append({"criterion": c.criterion_name, "type": ctype, "weight": c.weight, "required": c.required, "candidate_degree": highest_degree})

            elif ctype == "certification":
                if any(name_lower in cert or cert in name_lower for cert in certifications):
                    matched_criteria.append({"criterion": c.criterion_name, "type": ctype, "weight": c.weight, "required": c.required, "match": "found"})
                else:
                    missing_criteria.append({"criterion": c.criterion_name, "type": ctype, "weight": c.weight, "required": c.required})

        # ── Skill summary ─────────────────────────────────────────────────────
        job_skill_criteria = [c.criterion_name for c in (job.criteria or []) if c.criterion_type == "skill"]
        required_skills_missing = [c["criterion"] for c in missing_criteria if c["type"] == "skill" and c["required"]]
        optional_skills_missing = [c["criterion"] for c in missing_criteria if c["type"] == "skill" and not c["required"]]

        total_criteria = len(job.criteria or [])
        matched_count = len(matched_criteria)
        partial_count = len(partial_criteria)

        return {
            "candidate_id": str(candidate_id),
            "job_id": str(job_id),
            "job_title": job.title,
            "candidate_name": candidate.full_name,
            "fit_score": fit_score,
            "summary": {
                "total_criteria": total_criteria,
                "matched": matched_count,
                "partial": partial_count,
                "missing": len(missing_criteria),
                "match_rate": round(matched_count / total_criteria * 100, 1) if total_criteria else None,
            },
            "candidate_profile": {
                "total_years_experience": total_years,
                "highest_degree": highest_degree,
                "skill_count": len(candidate_skills),
                "top_skills": list(candidate_skills)[:10],
            },
            "matched_criteria": matched_criteria,
            "partial_criteria": partial_criteria,
            "missing_criteria": missing_criteria,
            "required_skills_missing": required_skills_missing,
            "optional_skills_missing": optional_skills_missing,
        }

    async def get_candidate_scores(self, db: AsyncSession, candidate_id: uuid.UUID) -> list[dict]:
        """Return all current fit scores for a candidate across jobs."""
        rows = await db.execute(
            text("""
                SELECT
                    fs.job_id,
                    fs.fit_score,
                    fs.score_breakdown,
                    fs.computed_at,
                    j.title,
                    j.status,
                    fs.is_overridden,
                    fs.override_score,
                    fs.override_justification,
                    fs.original_ai_score,
                    fs.technical_score,
                    fs.culture_score,
                    fs.growth_score
                FROM fit_scores fs
                JOIN jobs j ON j.id = fs.job_id
                WHERE fs.candidate_id = :cid AND fs.is_current = true
                ORDER BY fs.fit_score DESC
            """),
            {"cid": str(candidate_id)},
        )
        return [
            {
                "job_id": str(r[0]),
                "fit_score": r[7] if r[6] else r[1],   # show override_score if overridden
                "score_breakdown": r[2],
                "computed_at": r[3].isoformat() if r[3] else None,
                "job_title": r[4],
                "job_status": r[5],
                "is_overridden": r[6],
                "override_score": r[7],
                "override_justification": r[8],
                "original_ai_score": r[9],
                "technical_score": r[10],
                "culture_score": r[11],
                "growth_score": r[12],
            }
            for r in rows.fetchall()
        ]


class SyncFitScoreService:
    """Synchronous fit score service for Celery tasks."""

    def score_candidate_sync(self, db: Session, candidate_id: uuid.UUID, job_id: uuid.UUID) -> dict:
        """Compute and store fit score synchronously."""
        cand_row = db.execute(
            text("SELECT embedding FROM candidate_embeddings WHERE candidate_id = :cid ORDER BY created_at DESC LIMIT 1"),
            {"cid": str(candidate_id)},
        ).fetchone()

        job_row = db.execute(
            text("SELECT embedding FROM job_embeddings WHERE job_id = :jid ORDER BY created_at DESC LIMIT 1"),
            {"jid": str(job_id)},
        ).fetchone()

        if not cand_row or not job_row:
            return {"status": "skipped", "detail": "Missing embedding(s)"}

        cand_vec: list[float] = json.loads(cand_row[0])
        job_vec: list[float] = json.loads(job_row[0])

        similarity = _cosine_similarity(cand_vec, job_vec)
        fit_score = _to_score(similarity)

        breakdown = {
            "cosine_similarity": round(similarity, 6),
            "fit_score": fit_score,
            "candidate_dims": len(cand_vec),
            "job_dims": len(job_vec),
        }

        db.execute(
            text("UPDATE fit_scores SET is_current = false WHERE candidate_id = :cid AND job_id = :jid"),
            {"cid": str(candidate_id), "jid": str(job_id)},
        )
        db.execute(
            text("""
                INSERT INTO fit_scores
                    (id, candidate_id, job_id, fit_score, score_breakdown, weights_used, model_name, model_version, is_current, computed_at)
                VALUES
                    (gen_random_uuid(), :cid, :jid, :score, :breakdown, :weights, :model, :ver, true, now())
            """),
            {
                "cid": str(candidate_id),
                "jid": str(job_id),
                "score": fit_score,
                "breakdown": json.dumps(breakdown),
                "weights": json.dumps({"method": "single_embedding_cosine", "model": EMBED_MODEL}),
                "model": EMBED_MODEL,
                "ver": EMBED_MODEL_VERSION,
            },
        )
        db.flush()

        logger.info("Fit score stored: candidate=%s job=%s score=%.1f", candidate_id, job_id, fit_score)
        return {"status": "scored", "fit_score": fit_score}
