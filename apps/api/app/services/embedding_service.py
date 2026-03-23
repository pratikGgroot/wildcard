"""
Embedding Service — Story 04.1
Generates and stores vector embeddings for candidates and jobs using Ollama nomic-embed-text.
Uses SHA256 input hash to avoid re-embedding unchanged content.
"""
import hashlib
import json
import logging
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.candidate import Candidate
from app.models.job import Job
from app.services.llm_service import LLMService

logger = logging.getLogger(__name__)

_llm = LLMService()

EMBED_MODEL = "nomic-embed-text"
EMBED_MODEL_VERSION = "1"


# ── Text construction ─────────────────────────────────────────────────────────

def build_candidate_embedding_text(candidate: Candidate) -> str:
    """Build a rich text representation of a candidate profile for embedding."""
    pd = candidate.parsed_data or {}
    parts: list[str] = []

    # Name and contact context
    if candidate.full_name:
        parts.append(f"Candidate: {candidate.full_name}")
    if candidate.location:
        parts.append(f"Location: {candidate.location}")

    # Skills
    skills: list[str] = pd.get("normalized_skills") or pd.get("skills") or []
    inferred: list[str] = pd.get("normalized_inferred") or pd.get("inferred_skills") or []
    all_skills = skills + inferred
    if all_skills:
        parts.append(f"Skills: {', '.join(all_skills)}")

    # Experience
    for exp in (pd.get("experience") or [])[:6]:
        title = exp.get("title", "")
        company = exp.get("company", "")
        responsibilities = exp.get("responsibilities") or []
        resp_text = " ".join(responsibilities[:3])
        if title or company:
            parts.append(f"{title} at {company}: {resp_text}".strip(": "))

    # Education
    for edu in (pd.get("education") or [])[:3]:
        degree = edu.get("degree", "")
        field = edu.get("field", "")
        institution = edu.get("institution", "")
        if degree:
            parts.append(f"{degree}{' in ' + field if field else ''} from {institution}".strip())

    # Certifications
    certs: list[str] = pd.get("certifications") or []
    if certs:
        parts.append(f"Certifications: {', '.join(certs[:5])}")

    # Projects
    for proj in (pd.get("projects") or [])[:3]:
        name = proj.get("name", "")
        desc = proj.get("description", "")
        techs = proj.get("technologies") or []
        if name:
            tech_str = f" [{', '.join(techs[:5])}]" if techs else ""
            parts.append(f"Project: {name}{tech_str} — {desc}"[:200])

    return "\n".join(parts)


def build_job_embedding_text(job: Job) -> str:
    """Build a rich text representation of a job for embedding."""
    parts: list[str] = [f"Job Title: {job.title}"]

    if job.department:
        parts.append(f"Department: {job.department}")
    if job.location:
        parts.append(f"Location: {job.location}")
    if job.type:
        parts.append(f"Type: {job.type}")

    # Strip HTML from description
    import re
    clean_desc = re.sub(r"<[^>]+>", " ", job.description or "")
    clean_desc = re.sub(r"\s+", " ", clean_desc).strip()
    if clean_desc:
        parts.append(f"Description: {clean_desc[:1000]}")

    # Criteria
    for c in (job.criteria or []):
        weight_label = f"({c.weight}, {'required' if c.required else 'preferred'})"
        parts.append(f"Requirement: {c.criterion_name} {weight_label}")

    return "\n".join(parts)


def _hash_text(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


# ── Async embedding service ───────────────────────────────────────────────────

class EmbeddingService:
    """Async embedding service for use in FastAPI endpoints."""

    async def embed_candidate(self, db: AsyncSession, candidate_id: uuid.UUID) -> dict:
        """Generate and store embedding for a candidate. Returns status dict."""
        result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
        candidate = result.scalar_one_or_none()
        if not candidate:
            return {"status": "error", "detail": "Candidate not found"}

        if not candidate.parsed_data:
            return {"status": "skipped", "detail": "No parsed data available"}

        text = build_candidate_embedding_text(candidate)
        input_hash = _hash_text(text)

        # Check if already embedded with same content
        existing = await db.execute(
            text("SELECT id FROM candidate_embeddings WHERE candidate_id = :cid AND input_hash = :h"),
            {"cid": str(candidate_id), "h": input_hash},
        )
        if existing.fetchone():
            return {"status": "cached", "candidate_id": str(candidate_id)}

        embedding = await _llm.generate_embedding(text)
        if embedding is None:
            # Mark as pending if LLM unavailable
            candidate.embedding_status = "pending"
            await db.commit()
            return {"status": "pending", "detail": "Embedding model unavailable"}

        await self._upsert_candidate_embedding(db, candidate_id, embedding, input_hash)
        candidate.embedding_status = "completed"
        await db.commit()

        return {
            "status": "completed",
            "candidate_id": str(candidate_id),
            "dims": len(embedding),
            "model": EMBED_MODEL,
        }

    async def embed_job(self, db: AsyncSession, job_id: uuid.UUID) -> dict:
        """Generate and store embedding for a job. Returns status dict."""
        from sqlalchemy.orm import selectinload
        result = await db.execute(
            select(Job).options(selectinload(Job.criteria)).where(Job.id == job_id)
        )
        job = result.scalar_one_or_none()
        if not job:
            return {"status": "error", "detail": "Job not found"}

        embed_text = build_job_embedding_text(job)
        input_hash = _hash_text(embed_text)

        existing = await db.execute(
            text("SELECT id FROM job_embeddings WHERE job_id = :jid AND input_hash = :h"),
            {"jid": str(job_id), "h": input_hash},
        )
        if existing.fetchone():
            return {"status": "cached", "job_id": str(job_id)}

        embedding = await _llm.generate_embedding(embed_text)
        if embedding is None:
            return {"status": "pending", "detail": "Embedding model unavailable"}

        await self._upsert_job_embedding(db, job_id, embedding, input_hash)
        await db.commit()

        return {
            "status": "completed",
            "job_id": str(job_id),
            "dims": len(embedding),
            "model": EMBED_MODEL,
        }

    async def get_candidate_embedding(self, db: AsyncSession, candidate_id: uuid.UUID) -> list[float] | None:
        """Retrieve stored embedding vector for a candidate."""
        row = await db.execute(
            text("SELECT embedding FROM candidate_embeddings WHERE candidate_id = :cid ORDER BY created_at DESC LIMIT 1"),
            {"cid": str(candidate_id)},
        )
        r = row.fetchone()
        if r:
            return json.loads(r[0])
        return None

    async def get_job_embedding(self, db: AsyncSession, job_id: uuid.UUID) -> list[float] | None:
        """Retrieve stored embedding vector for a job."""
        row = await db.execute(
            text("SELECT embedding FROM job_embeddings WHERE job_id = :jid ORDER BY created_at DESC LIMIT 1"),
            {"jid": str(job_id)},
        )
        r = row.fetchone()
        if r:
            return json.loads(r[0])
        return None

    async def _upsert_candidate_embedding(
        self, db: AsyncSession, candidate_id: uuid.UUID, embedding: list[float], input_hash: str
    ) -> None:
        # Delete old embedding for this candidate first
        await db.execute(
            text("DELETE FROM candidate_embeddings WHERE candidate_id = :cid"),
            {"cid": str(candidate_id)},
        )
        await db.execute(
            text("""
                INSERT INTO candidate_embeddings
                    (id, candidate_id, embedding, model_name, model_version, input_hash, embedding_status, created_at, updated_at)
                VALUES
                    (gen_random_uuid(), :cid, :emb, :model, :ver, :hash, 'completed', now(), now())
            """),
            {
                "cid": str(candidate_id),
                "emb": json.dumps(embedding),
                "model": EMBED_MODEL,
                "ver": EMBED_MODEL_VERSION,
                "hash": input_hash,
            },
        )

    async def _upsert_job_embedding(
        self, db: AsyncSession, job_id: uuid.UUID, embedding: list[float], input_hash: str
    ) -> None:
        await db.execute(
            text("DELETE FROM job_embeddings WHERE job_id = :jid"),
            {"jid": str(job_id)},
        )
        await db.execute(
            text("""
                INSERT INTO job_embeddings
                    (id, job_id, embedding, model_name, model_version, input_hash, embedding_status, created_at, updated_at)
                VALUES
                    (gen_random_uuid(), :jid, :emb, :model, :ver, :hash, 'completed', now(), now())
            """),
            {
                "jid": str(job_id),
                "emb": json.dumps(embedding),
                "model": EMBED_MODEL,
                "ver": EMBED_MODEL_VERSION,
                "hash": input_hash,
            },
        )


# ── Sync embedding service (for Celery tasks) ─────────────────────────────────

class SyncEmbeddingService:
    """Synchronous embedding service for use inside Celery tasks."""

    def embed_candidate_sync(self, db: Session, candidate: Candidate) -> dict:
        """Generate and store embedding for a candidate synchronously."""
        import asyncio

        if not candidate.parsed_data:
            return {"status": "skipped", "detail": "No parsed data"}

        embed_text = build_candidate_embedding_text(candidate)
        input_hash = _hash_text(embed_text)

        # Check cache
        existing = db.execute(
            text("SELECT id FROM candidate_embeddings WHERE candidate_id = :cid AND input_hash = :h"),
            {"cid": str(candidate.id), "h": input_hash},
        ).fetchone()
        if existing:
            return {"status": "cached"}

        try:
            embedding = asyncio.run(_llm.generate_embedding(embed_text))
        except Exception as exc:
            logger.error("Embedding generation failed for candidate %s: %s", candidate.id, exc)
            embedding = None

        if embedding is None:
            candidate.embedding_status = "pending"
            db.flush()
            return {"status": "pending"}

        # Delete old, insert new
        db.execute(
            text("DELETE FROM candidate_embeddings WHERE candidate_id = :cid"),
            {"cid": str(candidate.id)},
        )
        db.execute(
            text("""
                INSERT INTO candidate_embeddings
                    (id, candidate_id, embedding, model_name, model_version, input_hash, embedding_status, created_at, updated_at)
                VALUES
                    (gen_random_uuid(), :cid, :emb, :model, :ver, :hash, 'completed', now(), now())
            """),
            {
                "cid": str(candidate.id),
                "emb": json.dumps(embedding),
                "model": EMBED_MODEL,
                "ver": EMBED_MODEL_VERSION,
                "hash": input_hash,
            },
        )
        candidate.embedding_status = "completed"
        db.flush()

        logger.info("Embedding stored for candidate %s (%d dims)", candidate.id, len(embedding))
        return {"status": "completed", "dims": len(embedding)}

    def embed_job_sync(self, db: Session, job_id: uuid.UUID) -> dict:
        """Generate and store embedding for a job synchronously (for Celery tasks)."""
        import asyncio
        from sqlalchemy.orm import selectinload

        job = db.execute(
            select(Job).options(selectinload(Job.criteria)).where(Job.id == job_id)
        ).scalar_one_or_none()
        if not job:
            return {"status": "error", "detail": "Job not found"}

        embed_text = build_job_embedding_text(job)
        input_hash = _hash_text(embed_text)

        existing = db.execute(
            text("SELECT id FROM job_embeddings WHERE job_id = :jid AND input_hash = :h"),
            {"jid": str(job_id), "h": input_hash},
        ).fetchone()
        if existing:
            return {"status": "cached"}

        try:
            embedding = asyncio.run(_llm.generate_embedding(embed_text))
        except Exception as exc:
            logger.error("Job embedding generation failed for %s: %s", job_id, exc)
            embedding = None

        if embedding is None:
            return {"status": "pending", "detail": "Embedding model unavailable"}

        db.execute(
            text("DELETE FROM job_embeddings WHERE job_id = :jid"),
            {"jid": str(job_id)},
        )
        db.execute(
            text("""
                INSERT INTO job_embeddings
                    (id, job_id, embedding, model_name, model_version, input_hash, embedding_status, created_at, updated_at)
                VALUES
                    (gen_random_uuid(), :jid, :emb, :model, :ver, :hash, 'completed', now(), now())
            """),
            {
                "jid": str(job_id),
                "emb": json.dumps(embedding),
                "model": EMBED_MODEL,
                "ver": EMBED_MODEL_VERSION,
                "hash": input_hash,
            },
        )
        db.flush()

        logger.info("Job embedding stored for %s (%d dims)", job_id, len(embedding))
        return {"status": "completed", "dims": len(embedding)}
