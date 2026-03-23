"""
Seed script: inserts 5 closed jobs with mock embeddings + criteria
so the AI Suggestions panel has enough history to show results.

Usage:
  PYTHONPATH=. python apps/api/scripts/seed_suggestions.py
"""
import asyncio
import random
import uuid
from datetime import datetime

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "postgresql+asyncpg://dev:devpassword@localhost:5434/hiring_platform"

# 768-dim mock embedding (nomic-embed-text dimension)
def mock_embedding(seed: int) -> str:
    random.seed(seed)
    vec = [round(random.uniform(-0.1, 0.1), 6) for _ in range(768)]
    return "[" + ",".join(str(v) for v in vec) + "]"


JOBS = [
    {
        "title": "Senior Backend Engineer",
        "department": "Engineering",
        "location": "Remote",
        "type": "full-time",
        "description": "We are looking for a Senior Backend Engineer with strong Python and FastAPI skills.",
        "criteria": [
            ("Python", "skill", "high", True),
            ("FastAPI", "skill", "high", True),
            ("PostgreSQL", "skill", "medium", True),
            ("5+ years backend experience", "experience", "high", True),
            ("Bachelor's in Computer Science", "education", "medium", False),
        ],
    },
    {
        "title": "Backend Engineer",
        "department": "Engineering",
        "location": "New York",
        "type": "full-time",
        "description": "Backend engineer role focused on Python microservices and REST APIs.",
        "criteria": [
            ("Python", "skill", "high", True),
            ("REST APIs", "skill", "high", True),
            ("Docker", "skill", "medium", False),
            ("3+ years experience", "experience", "medium", True),
            ("AWS", "skill", "low", False),
        ],
    },
    {
        "title": "Python Developer",
        "department": "Engineering",
        "location": "San Francisco",
        "type": "full-time",
        "description": "Python developer for data pipeline and API development.",
        "criteria": [
            ("Python", "skill", "high", True),
            ("SQLAlchemy", "skill", "medium", True),
            ("Redis", "skill", "low", False),
            ("2+ years Python experience", "experience", "medium", True),
            ("AWS Certified Developer", "certification", "low", False),
        ],
    },
    {
        "title": "Full Stack Engineer",
        "department": "Engineering",
        "location": "Remote",
        "type": "full-time",
        "description": "Full stack engineer with Python backend and React frontend experience.",
        "criteria": [
            ("Python", "skill", "high", True),
            ("React", "skill", "high", True),
            ("TypeScript", "skill", "medium", True),
            ("4+ years full stack experience", "experience", "high", True),
            ("PostgreSQL", "skill", "medium", False),
        ],
    },
    {
        "title": "API Engineer",
        "department": "Platform",
        "location": "Austin",
        "type": "full-time",
        "description": "API engineer to design and build scalable REST and GraphQL APIs.",
        "criteria": [
            ("Python", "skill", "high", True),
            ("GraphQL", "skill", "medium", False),
            ("FastAPI", "skill", "high", True),
            ("3+ years API development", "experience", "high", True),
            ("Kubernetes", "skill", "low", False),
        ],
    },
]


async def seed():
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        for i, job_data in enumerate(JOBS):
            job_id = uuid.uuid4()
            embedding = mock_embedding(seed=i + 42)

            # Insert job
            await session.execute(text("""
                INSERT INTO jobs (id, title, department, location, type, description, status,
                                  description_hash, criteria_extracted_at, jd_embedding,
                                  created_at, updated_at)
                VALUES (:id, :title, :department, :location, :type, :description, 'closed',
                        md5(:description), now(), :embedding::vector,
                        now(), now())
                ON CONFLICT DO NOTHING
            """), {
                "id": str(job_id),
                "title": job_data["title"],
                "department": job_data["department"],
                "location": job_data["location"],
                "type": job_data["type"],
                "description": job_data["description"],
                "embedding": embedding,
            })

            # Insert criteria
            for name, ctype, weight, required in job_data["criteria"]:
                await session.execute(text("""
                    INSERT INTO job_criteria (id, job_id, criterion_name, criterion_type,
                                             weight, required, ai_extracted, created_at, updated_at)
                    VALUES (:id, :job_id, :name, :type, :weight, :required, true, now(), now())
                """), {
                    "id": str(uuid.uuid4()),
                    "job_id": str(job_id),
                    "name": name,
                    "type": ctype,
                    "weight": weight,
                    "required": required,
                })

            print(f"  ✓ Inserted: {job_data['title']} ({job_id})")

        await session.commit()
        print("\nDone. 5 closed jobs seeded with embeddings + criteria.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
