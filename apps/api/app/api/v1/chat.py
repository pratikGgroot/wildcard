"""
Chat API — Epic 06
SSE streaming endpoint + session CRUD.
"""
import uuid
import logging
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.services.chat_service import (
    agent_stream,
    get_or_create_session,
    get_context_messages,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chat", tags=["chat"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class SendMessageRequest(BaseModel):
    message: str
    session_id: str | None = None


class SessionResponse(BaseModel):
    id: str
    title: str | None
    session_start: str
    last_active: str
    is_expired: bool


class MessageResponse(BaseModel):
    id: str
    role: str
    content: str
    tool_name: str | None
    created_at: str


# ── Session endpoints ─────────────────────────────────────────────────────────

@router.get("/sessions", response_model=list[SessionResponse])
async def list_sessions(db: AsyncSession = Depends(get_db)):
    """List all non-expired sessions, most recent first."""
    rows = await db.execute(
        text("""
            SELECT id, title, session_start, last_active, is_expired
            FROM conversation_sessions
            WHERE is_expired = false
            ORDER BY last_active DESC
            LIMIT 50
        """)
    )
    return [
        SessionResponse(
            id=str(r.id),
            title=r.title,
            session_start=r.session_start.isoformat(),
            last_active=r.last_active.isoformat(),
            is_expired=r.is_expired,
        )
        for r in rows.fetchall()
    ]


@router.get("/sessions/{session_id}", response_model=dict)
async def get_session(session_id: str, db: AsyncSession = Depends(get_db)):
    """Get session metadata + messages."""
    row = await db.execute(
        text("SELECT id, title, session_start, last_active, is_expired FROM conversation_sessions WHERE id = :sid"),
        {"sid": session_id},
    )
    session = row.fetchone()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    messages = await get_context_messages(db, session_id)
    return {
        "id": str(session.id),
        "title": session.title,
        "session_start": session.session_start.isoformat(),
        "last_active": session.last_active.isoformat(),
        "is_expired": session.is_expired,
        "messages": messages,
    }


@router.delete("/sessions/{session_id}", status_code=204)
async def delete_session(session_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(
        text("UPDATE conversation_sessions SET is_expired = true WHERE id = :sid"),
        {"sid": session_id},
    )
    await db.commit()


# ── Message / streaming endpoint ──────────────────────────────────────────────

@router.post("/message")
async def send_message(
    body: SendMessageRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Send a message and receive an SSE stream of the assistant response.
    Creates a new session if session_id is not provided or has expired.
    """
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    # Resolve session
    session_info = await get_or_create_session(
        db,
        uuid.UUID(body.session_id) if body.session_id else None,
    )
    session_id = session_info["id"]

    async def event_generator() -> AsyncGenerator[str, None]:
        # If session was expired/new, notify client
        if session_info.get("expired"):
            import json
            yield f"data: {json.dumps({'type': 'notice', 'content': 'Starting a new conversation (previous session expired)'})}\n\n"

        # Yield session_id so client can store it
        import json
        yield f"data: {json.dumps({'type': 'session', 'session_id': session_id})}\n\n"

        async for chunk in agent_stream(db, session_id, body.message):
            yield chunk

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
