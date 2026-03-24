"""Auth service — password hashing, JWT generation/validation, token management."""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone, UTC

from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.user import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Token types
ACCESS_TOKEN_TYPE = "access"
REFRESH_TOKEN_TYPE = "refresh"


# ── Password helpers ──────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ── JWT helpers ───────────────────────────────────────────────────────────────

def _create_token(data: dict, token_type: str, expires_delta: timedelta) -> str:
    payload = data.copy()
    payload.update({
        "type": token_type,
        "exp": datetime.now(timezone.utc) + expires_delta,
        "iat": datetime.now(timezone.utc),
    })
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_access_token(user_id: str, role: str) -> str:
    return _create_token(
        {"sub": user_id, "role": role},
        ACCESS_TOKEN_TYPE,
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def create_refresh_token(user_id: str) -> str:
    return _create_token(
        {"sub": user_id},
        REFRESH_TOKEN_TYPE,
        timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )


def decode_token(token: str) -> dict:
    """Decode and validate a JWT. Raises JWTError on failure."""
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])


def hash_token(token: str) -> str:
    """SHA-256 hash of a token for safe DB storage."""
    return hashlib.sha256(token.encode()).hexdigest()


# ── DB operations ─────────────────────────────────────────────────────────────

async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email.lower()))
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: str) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def authenticate_user(db: AsyncSession, email: str, password: str) -> User | None:
    user = await get_user_by_email(db, email)
    if not user or not user.is_active:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


async def store_refresh_token(db: AsyncSession, user: User, refresh_token: str) -> None:
    user.refresh_token_hash = hash_token(refresh_token)
    user.last_login = datetime.utcnow()
    await db.flush()


async def rotate_refresh_token(
    db: AsyncSession, user: User, old_token: str, new_token: str
) -> bool:
    """Validate old token hash matches, then replace with new one."""
    if user.refresh_token_hash != hash_token(old_token):
        return False
    user.refresh_token_hash = hash_token(new_token)
    await db.flush()
    return True


async def revoke_refresh_token(db: AsyncSession, user: User) -> None:
    user.refresh_token_hash = None
    await db.flush()


async def create_password_reset_token(db: AsyncSession, user: User) -> str:
    token = secrets.token_urlsafe(32)
    user.password_reset_token = hash_token(token)
    user.password_reset_expires = datetime.utcnow() + timedelta(hours=1)
    await db.flush()
    return token


async def reset_password(db: AsyncSession, user: User, token: str, new_password: str) -> bool:
    if not user.password_reset_token or not user.password_reset_expires:
        return False
    if user.password_reset_expires < datetime.utcnow():
        return False
    if user.password_reset_token != hash_token(token):
        return False
    user.hashed_password = hash_password(new_password)
    user.password_reset_token = None
    user.password_reset_expires = None
    user.refresh_token_hash = None  # invalidate all sessions
    await db.flush()
    return True
