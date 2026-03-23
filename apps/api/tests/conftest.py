import uuid
from dataclasses import dataclass
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.db.base import Base, get_db
from app.main import app

TEST_DATABASE_URL = "postgresql+asyncpg://dev:devpassword@localhost:5435/hiring_platform_test"

# NullPool: every session gets a brand-new connection — no reuse, no "another
# operation in progress" errors from asyncpg's single-operation-at-a-time rule.
engine = create_async_engine(TEST_DATABASE_URL, echo=False, poolclass=NullPool)
TestSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

TEST_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


@dataclass
class UserStub:
    id: uuid.UUID
    email: str
    full_name: str
    role: str


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_db():
    """Create schema once per session and seed the test user."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(
            text(
                "INSERT INTO users (id, email, hashed_password, full_name, role, is_active) "
                "VALUES (:id, :email, :pw, :name, :role, true) "
                "ON CONFLICT (id) DO NOTHING"
            ),
            {
                "id": str(TEST_USER_ID),
                "email": "recruiter@test.com",
                "pw": "placeholder",
                "name": "Test Recruiter",
                "role": "recruiter",
            },
        )
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db() -> AsyncGenerator[AsyncSession, None]:
    """
    Each test gets a fresh session on its own connection (NullPool ensures no
    connection reuse). Tables are truncated after each test for isolation.
    """
    async with TestSessionLocal() as session:
        yield session

    # Clean up data written by this test (users row is preserved)
    async with engine.begin() as conn:
        await conn.execute(
            text("TRUNCATE job_criteria, job_status_history, job_assignments, jobs RESTART IDENTITY CASCADE")
        )


@pytest.fixture
def test_user() -> UserStub:
    return UserStub(
        id=TEST_USER_ID,
        email="recruiter@test.com",
        full_name="Test Recruiter",
        role="recruiter",
    )


@pytest_asyncio.fixture
async def client(db: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    async def override_get_db():
        try:
            yield db
            await db.commit()
        except Exception:
            await db.rollback()
            raise

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()
