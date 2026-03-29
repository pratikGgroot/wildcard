"""Admin Panel API — Epic 16 (Stories 16.1, 16.2, 16.4, 16.5, 16.6, 16.7)"""
import json
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AdminOnly, CurrentUser
from app.db.base import get_db
from app.models.user import User
from app.services.auth_service import hash_password

router = APIRouter(prefix="/admin", tags=["admin"])


# ── Audit log helper ──────────────────────────────────────────────────────────

async def _audit(
    db: AsyncSession,
    admin_id: uuid.UUID,
    action: str,
    resource_type: str,
    resource_id: Optional[uuid.UUID] = None,
    before: Optional[dict] = None,
    after: Optional[dict] = None,
    request: Optional[Request] = None,
):
    ip = request.client.host if request and request.client else None
    await db.execute(
        text("""
            INSERT INTO admin_audit_log
                (admin_user_id, action, resource_type, resource_id, before_state, after_state, ip_address)
            VALUES (:uid, :action, :rtype, :rid, :before, :after, :ip)
        """),
        {
            "uid": str(admin_id),
            "action": action,
            "rtype": resource_type,
            "rid": str(resource_id) if resource_id else None,
            "before": json.dumps(before) if before else None,
            "after": json.dumps(after) if after else None,
            "ip": ip,
        },
    )


# ── Schemas ───────────────────────────────────────────────────────────────────

class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime
    last_login: Optional[datetime] = None
    model_config = {"from_attributes": True}


class UserCreate(BaseModel):
    email: str
    full_name: str = Field(min_length=1, max_length=200)
    role: str = "recruiter"
    password: str = Field(min_length=8)


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


class AuditLogOut(BaseModel):
    id: uuid.UUID
    admin_user_id: Optional[uuid.UUID]
    action: str
    resource_type: Optional[str]
    resource_id: Optional[uuid.UUID]
    before_state: Optional[dict]
    after_state: Optional[dict]
    ip_address: Optional[str]
    performed_at: datetime
    admin_name: Optional[str] = None


# ── 16.1 User Management ──────────────────────────────────────────────────────

@router.get("/users", response_model=list[UserOut])
async def list_all_users(
    _: AdminOnly,
    role: Optional[str] = None,
    search: Optional[str] = None,
    include_inactive: bool = False,
    db: AsyncSession = Depends(get_db),
):
    q = select(User).order_by(User.full_name)
    if not include_inactive:
        q = q.where(User.is_active == True)  # noqa: E712
    if role:
        q = q.where(User.role == role)
    if search:
        q = q.where(
            (User.full_name.ilike(f"%{search}%")) | (User.email.ilike(f"%{search}%"))
        )
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: UserCreate,
    current_user: CurrentUser,
    _: AdminOnly,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    # Check email uniqueness
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    valid_roles = {"admin", "recruiter", "hiring_manager", "viewer"}
    if data.role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}")

    hashed = hash_password(data.password)
    user = User(
        email=data.email,
        full_name=data.full_name,
        role=data.role,
        hashed_password=hashed,
        is_active=True,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    await _audit(db, current_user.id, "create_user", "user", user.id,
                 after={"email": user.email, "role": user.role}, request=request)
    await db.commit()
    return user


@router.put("/users/{user_id}", response_model=UserOut)
async def update_user(
    user_id: uuid.UUID,
    data: UserUpdate,
    current_user: CurrentUser,
    _: AdminOnly,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    before = {"full_name": user.full_name, "role": user.role, "is_active": user.is_active}

    if data.full_name is not None:
        user.full_name = data.full_name
    if data.role is not None:
        valid_roles = {"admin", "recruiter", "hiring_manager", "viewer"}
        if data.role not in valid_roles:
            raise HTTPException(status_code=400, detail="Invalid role")
        user.role = data.role
    if data.is_active is not None:
        user.is_active = data.is_active

    after = {"full_name": user.full_name, "role": user.role, "is_active": user.is_active}
    await _audit(db, current_user.id, "update_user", "user", user_id, before=before, after=after, request=request)
    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_user(
    user_id: uuid.UUID,
    current_user: CurrentUser,
    _: AdminOnly,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = False
    await _audit(db, current_user.id, "deactivate_user", "user", user_id,
                 before={"is_active": True}, after={"is_active": False}, request=request)
    await db.commit()


# ── 16.4 + 16.5 + 16.6 Settings (org_settings table) ────────────────────────

@router.get("/settings/{key}")
async def get_setting(
    key: str,
    _: AdminOnly,
    db: AsyncSession = Depends(get_db),
):
    row = await db.execute(
        text("SELECT setting_value FROM organization_settings WHERE setting_key = :key"),
        {"key": key},
    )
    r = row.fetchone()
    if not r:
        raise HTTPException(status_code=404, detail=f"Setting '{key}' not found")
    return {"key": key, "value": r[0]}


@router.put("/settings/{key}")
async def update_setting(
    key: str,
    body: dict,
    current_user: CurrentUser,
    _: AdminOnly,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    # Get current value for audit
    row = await db.execute(
        text("SELECT setting_value FROM organization_settings WHERE setting_key = :key"),
        {"key": key},
    )
    r = row.fetchone()
    before = r[0] if r else None

    await db.execute(
        text("""
            INSERT INTO organization_settings (setting_key, setting_value, updated_by, updated_at)
            VALUES (:key, :val, :uid, now())
            ON CONFLICT (setting_key) DO UPDATE
              SET setting_value = :val, updated_by = :uid, updated_at = now()
        """),
        {"key": key, "val": json.dumps(body), "uid": str(current_user.id)},
    )
    await _audit(db, current_user.id, f"update_setting:{key}", "setting",
                 before=before, after=body, request=request)
    await db.commit()
    return {"key": key, "value": body}


@router.get("/settings")
async def list_settings(
    _: AdminOnly,
    db: AsyncSession = Depends(get_db),
):
    rows = await db.execute(
        text("SELECT setting_key, setting_value, updated_at FROM organization_settings ORDER BY setting_key")
    )
    return [{"key": r[0], "value": r[1], "updated_at": r[2].isoformat() if r[2] else None} for r in rows.fetchall()]


# ── 16.7 Admin Audit Log ──────────────────────────────────────────────────────

@router.get("/audit-log")
async def get_audit_log(
    _: AdminOnly,
    resource_type: Optional[str] = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    cond = "WHERE 1=1"
    params: dict = {"limit": min(limit, 200)}
    if resource_type:
        cond += " AND aal.resource_type = :rtype"
        params["rtype"] = resource_type

    rows = await db.execute(
        text(f"""
            SELECT
                aal.id, aal.admin_user_id, aal.action, aal.resource_type,
                aal.resource_id, aal.before_state, aal.after_state,
                aal.ip_address, aal.performed_at,
                u.full_name AS admin_name
            FROM admin_audit_log aal
            LEFT JOIN users u ON u.id = aal.admin_user_id
            {cond}
            ORDER BY aal.performed_at DESC
            LIMIT :limit
        """),
        params,
    )
    return [
        {
            "id": str(r[0]),
            "admin_user_id": str(r[1]) if r[1] else None,
            "action": r[2],
            "resource_type": r[3],
            "resource_id": str(r[4]) if r[4] else None,
            "before_state": r[5],
            "after_state": r[6],
            "ip_address": r[7],
            "performed_at": r[8].isoformat() if r[8] else None,
            "admin_name": r[9],
        }
        for r in rows.fetchall()
    ]


# ── API Key management ────────────────────────────────────────────────────────

class ApiKeySet(BaseModel):
    provider: str  # openai | anthropic
    api_key: str = Field(min_length=10)


@router.post("/api-keys")
async def set_api_key(
    data: ApiKeySet,
    current_user: CurrentUser,
    _: AdminOnly,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Store an encrypted API key for a provider. Key is never returned after saving."""
    from app.services.settings_service import encrypt_api_key

    valid_providers = {"openai", "anthropic"}
    if data.provider not in valid_providers:
        raise HTTPException(status_code=400, detail=f"Provider must be one of: {', '.join(valid_providers)}")

    encrypted = encrypt_api_key(data.api_key)
    setting_key = f"api_key_{data.provider}"

    await db.execute(
        text("""
            INSERT INTO organization_settings (setting_key, setting_value, updated_by, updated_at)
            VALUES (:key, :val, :uid, now())
            ON CONFLICT (setting_key) DO UPDATE
              SET setting_value = :val, updated_by = :uid, updated_at = now()
        """),
        {
            "key": setting_key,
            "val": json.dumps({"encrypted_key": encrypted, "provider": data.provider, "set_at": datetime.utcnow().isoformat()}),
            "uid": str(current_user.id),
        },
    )
    await _audit(db, current_user.id, f"set_api_key:{data.provider}", "api_key", request=request)
    await db.commit()
    return {"status": "saved", "provider": data.provider}


@router.get("/api-keys/{provider}/status")
async def get_api_key_status(
    provider: str,
    _: AdminOnly,
    db: AsyncSession = Depends(get_db),
):
    """Check if an API key is configured for a provider (never returns the key itself)."""
    from app.services.settings_service import get_setting_async
    from app.core.config import settings as env_settings

    row = await get_setting_async(db, f"api_key_{provider}")
    has_db_key = bool(row and row.get("encrypted_key"))
    has_env_key = bool(provider == "openai" and env_settings.OPENAI_API_KEY)

    return {
        "provider": provider,
        "configured": has_db_key or has_env_key,
        "source": "database" if has_db_key else ("environment" if has_env_key else "none"),
        "set_at": row.get("set_at") if row else None,
    }


@router.delete("/api-keys/{provider}", status_code=204)
async def delete_api_key(
    provider: str,
    current_user: CurrentUser,
    _: AdminOnly,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Remove a stored API key for a provider."""
    await db.execute(
        text("DELETE FROM organization_settings WHERE setting_key = :key"),
        {"key": f"api_key_{provider}"},
    )
    await _audit(db, current_user.id, f"delete_api_key:{provider}", "api_key", request=request)
    await db.commit()
