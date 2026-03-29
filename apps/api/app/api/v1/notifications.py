"""Notifications API — in-app notifications, preferences, unsubscribe (Epic 10)."""
import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_db as _get_db
from app.db.base import get_db
from app.services.notification_service import get_or_create_prefs

router = APIRouter(prefix="/notifications", tags=["notifications"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class NotificationOut(BaseModel):
    id: uuid.UUID
    type: str
    title: str
    body: str | None
    entity_type: str | None
    entity_id: uuid.UUID | None
    is_read: bool
    read_at: datetime | None
    created_at: datetime


class PrefsUpdate(BaseModel):
    email_pipeline_moves: bool | None = None
    email_shortlist_actions: bool | None = None
    email_parse_complete: bool | None = None
    inapp_pipeline_moves: bool | None = None
    inapp_shortlist_actions: bool | None = None
    inapp_parse_complete: bool | None = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=list[NotificationOut])
async def list_notifications(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    unread_only: bool = False,
    limit: int = 50,
):
    q = "SELECT id, type, title, body, entity_type, entity_id, is_read, read_at, created_at FROM notifications WHERE user_id = :uid"
    params: dict = {"uid": str(current_user.id)}
    if unread_only:
        q += " AND is_read = false"
    q += " ORDER BY created_at DESC LIMIT :lim"
    params["lim"] = limit
    rows = await db.execute(text(q), params)
    return [
        NotificationOut(
            id=r[0], type=r[1], title=r[2], body=r[3],
            entity_type=r[4], entity_id=r[5],
            is_read=r[6], read_at=r[7], created_at=r[8],
        )
        for r in rows.fetchall()
    ]


@router.get("/unread-count")
async def unread_count(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    row = await db.execute(
        text("SELECT COUNT(*) FROM notifications WHERE user_id = :uid AND is_read = false"),
        {"uid": str(current_user.id)},
    )
    return {"count": row.scalar() or 0}


@router.post("/{notification_id}/read")
async def mark_read(
    notification_id: uuid.UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await db.execute(
        text("UPDATE notifications SET is_read = true, read_at = now() WHERE id = :id AND user_id = :uid"),
        {"id": str(notification_id), "uid": str(current_user.id)},
    )
    return {"status": "ok"}


@router.post("/read-all")
async def mark_all_read(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        text("UPDATE notifications SET is_read = true, read_at = now() WHERE user_id = :uid AND is_read = false"),
        {"uid": str(current_user.id)},
    )
    return {"status": "ok", "marked": result.rowcount}


@router.get("/preferences")
async def get_preferences(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await get_or_create_prefs(db, current_user.id)


@router.put("/preferences")
async def update_preferences(
    body: PrefsUpdate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    prefs = await get_or_create_prefs(db, current_user.id)
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        return prefs
    set_clause = ", ".join(f"{k} = :{k}" for k in updates)
    updates["uid"] = str(current_user.id)
    await db.execute(
        text(f"UPDATE notification_preferences SET {set_clause}, updated_at = now() WHERE user_id = :uid"),
        updates,
    )
    return await get_or_create_prefs(db, current_user.id)


@router.post("/unsubscribe")
async def unsubscribe(
    token: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Unsubscribe from all emails via token (no auth required — link in email)."""
    row = await db.execute(
        text("SELECT user_id FROM notification_preferences WHERE unsubscribe_token = :token"),
        {"token": token},
    )
    rec = row.fetchone()
    if not rec:
        raise HTTPException(status_code=404, detail="Invalid unsubscribe token")
    await db.execute(
        text("UPDATE notification_preferences SET unsubscribed_all = true WHERE unsubscribe_token = :token"),
        {"token": token},
    )
    return {"status": "ok", "message": "You have been unsubscribed from all emails"}
