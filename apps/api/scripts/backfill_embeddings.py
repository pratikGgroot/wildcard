"""
Backfill embeddings for all existing candidates that don't have one yet.
Run: PYTHONPATH=. python scripts/backfill_embeddings.py
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select, text
from app.db.base import AsyncSessionLocal
from app.models.candidate import Candidate
from app.services.embedding_service import EmbeddingService, build_candidate_embedding_text, _hash_text, EMBED_MODEL, EMBED_MODEL_VERSION
from app.services.llm_service import LLMService
import json
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

_llm = LLMService()


async def backfill():
    async with AsyncSessionLocal() as db:
        # Get all candidates without embeddings
        result = await db.execute(
            select(Candidate).where(
                Candidate.parsed_data.isnot(None)
            ).order_by(Candidate.created_at)
        )
        candidates = result.scalars().all()
        logger.info("Found %d candidates to process", len(candidates))

        ok = 0
        skipped = 0
        failed = 0

        for candidate in candidates:
            # Check if already has embedding
            existing = await db.execute(
                text("SELECT id FROM candidate_embeddings WHERE candidate_id = :cid LIMIT 1"),
                {"cid": str(candidate.id)},
            )
            if existing.fetchone():
                logger.info("SKIP %s (%s) — already embedded", candidate.id, candidate.full_name)
                skipped += 1
                continue

            embed_text = build_candidate_embedding_text(candidate)
            if not embed_text.strip():
                logger.warning("SKIP %s — no text to embed", candidate.id)
                skipped += 1
                continue

            input_hash = _hash_text(embed_text)

            try:
                embedding = await _llm.generate_embedding(embed_text)
            except Exception as exc:
                logger.error("FAIL %s: %s", candidate.id, exc)
                failed += 1
                continue

            if embedding is None:
                logger.warning("FAIL %s — embedding returned None", candidate.id)
                failed += 1
                continue

            await db.execute(
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
            await db.commit()
            logger.info("OK   %s (%s) — %d dims", candidate.id, candidate.full_name, len(embedding))
            ok += 1

        logger.info("Done. ok=%d skipped=%d failed=%d", ok, skipped, failed)


if __name__ == "__main__":
    asyncio.run(backfill())
