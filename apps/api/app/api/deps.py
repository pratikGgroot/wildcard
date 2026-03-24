"""Reusable FastAPI dependencies for auth and RBAC."""
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.models.user import User
from app.services.auth_service import ACCESS_TOKEN_TYPE, decode_token, get_user_by_id

bearer_scheme = HTTPBearer(auto_error=False)

# Role hierarchy — higher index = more permissions
ROLE_HIERARCHY = ["viewer", "recruiter", "hiring_manager", "admin"]


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not credentials:
        raise credentials_exception
    try:
        payload = decode_token(credentials.credentials)
        if payload.get("type") != ACCESS_TOKEN_TYPE:
            raise credentials_exception
        user_id: str = payload.get("sub")
        if not user_id:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = await get_user_by_id(db, user_id)
    if not user or not user.is_active:
        raise credentials_exception
    return user


def require_role(*roles: str):
    """Dependency factory — raises 403 if user's role is not in the allowed list."""
    async def _check(current_user: Annotated[User, Depends(get_current_user)]) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{current_user.role}' is not permitted for this action",
            )
        return current_user
    return _check


def require_min_role(min_role: str):
    """Dependency factory — requires at least `min_role` in the hierarchy."""
    async def _check(current_user: Annotated[User, Depends(get_current_user)]) -> User:
        user_level = ROLE_HIERARCHY.index(current_user.role) if current_user.role in ROLE_HIERARCHY else -1
        min_level = ROLE_HIERARCHY.index(min_role) if min_role in ROLE_HIERARCHY else 0
        if user_level < min_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Minimum role required: {min_role}",
            )
        return current_user
    return _check


# Convenience aliases
CurrentUser = Annotated[User, Depends(get_current_user)]
AdminOnly = Annotated[User, Depends(require_role("admin"))]
RecruiterOrAbove = Annotated[User, Depends(require_min_role("recruiter"))]
