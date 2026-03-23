from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


def _get_sync_session():
    """Lazy sync session factory for Celery workers (requires psycopg2-binary)."""
    _sync_url = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql+psycopg2://")
    _sync_engine = create_engine(_sync_url, pool_pre_ping=True)
    return sessionmaker(_sync_engine, expire_on_commit=False)


# Alias used by Celery tasks — only instantiated when first called
class _LazySyncSession:
    _factory = None

    def __call__(self):
        if self._factory is None:
            self._factory = _get_sync_session()
        return self._factory()

    def __enter__(self):
        self._session = self()
        return self._session

    def __exit__(self, *args):
        self._session.close()


SyncSessionLocal = _LazySyncSession()


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
