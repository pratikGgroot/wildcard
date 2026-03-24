"""Auth endpoints — login, refresh, logout, me, password reset."""
import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from jose import JWTError
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser
from app.db.base import get_db
from app.models.user import User
from app.services import auth_service
from app.services.auth_service import REFRESH_TOKEN_TYPE

router = APIRouter(prefix="/auth", tags=["auth"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class MeResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: str
    is_active: bool
    mfa_enabled: bool
    last_login: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    user = await auth_service.authenticate_user(db, body.email, body.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    access_token = auth_service.create_access_token(str(user.id), user.role)
    refresh_token = auth_service.create_refresh_token(str(user.id))
    await auth_service.store_refresh_token(db, user, refresh_token)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    body: RefreshRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired refresh token",
    )
    try:
        payload = auth_service.decode_token(body.refresh_token)
        if payload.get("type") != REFRESH_TOKEN_TYPE:
            raise credentials_exception
        user_id: str = payload.get("sub")
        if not user_id:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = await auth_service.get_user_by_id(db, user_id)
    if not user or not user.is_active:
        raise credentials_exception

    new_refresh = auth_service.create_refresh_token(str(user.id))
    rotated = await auth_service.rotate_refresh_token(db, user, body.refresh_token, new_refresh)
    if not rotated:
        raise credentials_exception

    access_token = auth_service.create_access_token(str(user.id), user.role)
    return TokenResponse(access_token=access_token, refresh_token=new_refresh)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await auth_service.revoke_refresh_token(db, current_user)


@router.get("/me", response_model=MeResponse)
async def me(current_user: CurrentUser):
    return current_user


@router.put("/me/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    body: ChangePasswordRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if not auth_service.verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    current_user.hashed_password = auth_service.hash_password(body.new_password)
    current_user.refresh_token_hash = None  # invalidate all sessions
    await db.flush()


@router.post("/password-reset/request", status_code=status.HTTP_204_NO_CONTENT)
async def request_password_reset(
    body: PasswordResetRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Always return 204 to avoid email enumeration
    user = await auth_service.get_user_by_email(db, body.email)
    if user:
        await auth_service.create_password_reset_token(db, user)
        # TODO: send email via notification service (Epic 10)


@router.post("/password-reset/confirm", status_code=status.HTTP_204_NO_CONTENT)
async def confirm_password_reset(
    body: PasswordResetConfirm,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # We need to find the user by hashed token — scan is acceptable for reset flows
    from sqlalchemy import select
    from app.services.auth_service import hash_token
    hashed = hash_token(body.token)
    result = await db.execute(
        select(User).where(User.password_reset_token == hashed)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token")
    ok = await auth_service.reset_password(db, user, body.token, body.new_password)
    if not ok:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token")
