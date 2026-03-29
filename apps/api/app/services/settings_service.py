"""
Settings Service — reads admin-configured settings from organization_settings table.
Used to override env-based defaults at runtime.
"""
import json
import logging
from typing import Any, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# In-memory cache (refreshed per request via get_ai_settings)
_cache: dict[str, Any] = {}


async def get_setting_async(db: AsyncSession, key: str) -> Optional[dict]:
    """Fetch a setting value from the DB asynchronously."""
    try:
        row = await db.execute(
            text("SELECT setting_value FROM organization_settings WHERE setting_key = :key"),
            {"key": key},
        )
        r = row.fetchone()
        return r[0] if r else None
    except Exception as e:
        logger.warning("Failed to fetch setting '%s': %s", key, e)
        return None


def get_setting_sync(db: Session, key: str) -> Optional[dict]:
    """Fetch a setting value from the DB synchronously (for Celery tasks)."""
    try:
        row = db.execute(
            text("SELECT setting_value FROM organization_settings WHERE setting_key = :key"),
            {"key": key},
        ).fetchone()
        return row[0] if row else None
    except Exception as e:
        logger.warning("Failed to fetch setting '%s': %s", key, e)
        return None


async def get_ai_settings(db: AsyncSession) -> dict:
    """Return the current AI model settings, falling back to env defaults."""
    from app.core.config import settings as env_settings
    val = await get_setting_async(db, "ai_model")
    if not val:
        return {
            "llm_provider": env_settings.LLM_PROVIDER,
            "llm_model": env_settings.OLLAMA_MODEL,
            "embed_model": env_settings.OLLAMA_EMBED_MODEL,
            "shortlist_threshold": 60,
            "score_weights": {"technical": 0.4, "culture": 0.3, "growth": 0.3},
        }
    return {
        "llm_provider": val.get("llm_provider", env_settings.LLM_PROVIDER),
        "llm_model": val.get("llm_model", env_settings.OLLAMA_MODEL),
        "embed_model": val.get("embed_model", env_settings.OLLAMA_EMBED_MODEL),
        "shortlist_threshold": val.get("shortlist_threshold", 60),
        "score_weights": val.get("score_weights", {"technical": 0.4, "culture": 0.3, "growth": 0.3}),
    }


def get_ai_settings_sync(db: Session) -> dict:
    """Sync version for Celery tasks."""
    from app.core.config import settings as env_settings
    val = get_setting_sync(db, "ai_model")
    if not val:
        return {
            "llm_provider": env_settings.LLM_PROVIDER,
            "llm_model": env_settings.OLLAMA_MODEL,
            "embed_model": env_settings.OLLAMA_EMBED_MODEL,
            "shortlist_threshold": 60,
            "score_weights": {"technical": 0.4, "culture": 0.3, "growth": 0.3},
        }
    return {
        "llm_provider": val.get("llm_provider", env_settings.LLM_PROVIDER),
        "llm_model": val.get("llm_model", env_settings.OLLAMA_MODEL),
        "embed_model": val.get("embed_model", env_settings.OLLAMA_EMBED_MODEL),
        "shortlist_threshold": val.get("shortlist_threshold", 60),
        "score_weights": val.get("score_weights", {"technical": 0.4, "culture": 0.3, "growth": 0.3}),
    }


# ── API Key encryption ────────────────────────────────────────────────────────

def _get_fernet():
    """Get a Fernet cipher using the app's ENCRYPTION_KEY."""
    import base64
    from cryptography.fernet import Fernet
    from app.core.config import settings
    # Fernet requires a 32-byte URL-safe base64 key
    key_bytes = settings.ENCRYPTION_KEY.encode()[:32].ljust(32, b"0")
    b64_key = base64.urlsafe_b64encode(key_bytes)
    return Fernet(b64_key)


def encrypt_api_key(plain_key: str) -> str:
    """Encrypt an API key for storage in the DB."""
    f = _get_fernet()
    return f.encrypt(plain_key.encode()).decode()


def decrypt_api_key(encrypted_key: str) -> str:
    """Decrypt a stored API key."""
    f = _get_fernet()
    return f.decrypt(encrypted_key.encode()).decode()


async def get_api_key(db: AsyncSession, provider: str) -> Optional[str]:
    """
    Get the decrypted API key for a provider.
    Falls back to env var if not set in DB.
    """
    from app.core.config import settings as env_settings
    row = await get_setting_async(db, f"api_key_{provider}")
    if row and row.get("encrypted_key"):
        try:
            return decrypt_api_key(row["encrypted_key"])
        except Exception:
            pass
    # Fallback to env
    if provider == "openai":
        return env_settings.OPENAI_API_KEY or None
    return None


def get_api_key_sync(db: Session, provider: str) -> Optional[str]:
    """Sync version for Celery tasks."""
    from app.core.config import settings as env_settings
    row = get_setting_sync(db, f"api_key_{provider}")
    if row and row.get("encrypted_key"):
        try:
            return decrypt_api_key(row["encrypted_key"])
        except Exception:
            pass
    if provider == "openai":
        return env_settings.OPENAI_API_KEY or None
    return None
