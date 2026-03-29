"""Notification service — in-app notifications + email dispatch (Epic 10)."""
import logging
import secrets
import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.email_service import (
    queue_email,
    pipeline_move_email,
    shortlist_action_email,
    parse_complete_email,
)

logger = logging.getLogger(__name__)

BASE_URL = "http://localhost:3000"  # overridden by env in prod


# ── Preference helpers ────────────────────────────────────────────────────────

async def get_or_create_prefs(db: AsyncSession, user_id: uuid.UUID) -> dict:
    row = await db.execute(
        text("SELECT * FROM notification_preferences WHERE user_id = :uid"),
        {"uid": str(user_id)},
    )
    rec = row.mappings().fetchone()
    if rec:
        return dict(rec)
    # Create defaults
    token = secrets.token_urlsafe(32)
    await db.execute(
        text("""
            INSERT INTO notification_preferences (user_id, unsubscribe_token)
            VALUES (:uid, :token)
            ON CONFLICT (user_id) DO NOTHING
        """),
        {"uid": str(user_id), "token": token},
    )
    await db.flush()
    row2 = await db.execute(
        text("SELECT * FROM notification_preferences WHERE user_id = :uid"),
        {"uid": str(user_id)},
    )
    return dict(row2.mappings().fetchone())


async def _unsubscribe_url(db: AsyncSession, user_id: uuid.UUID) -> str | None:
    prefs = await get_or_create_prefs(db, user_id)
    token = prefs.get("unsubscribe_token")
    return f"{BASE_URL}/unsubscribe?token={token}" if token else None


# ── In-app notification creation ──────────────────────────────────────────────

async def create_notification(
    db: AsyncSession,
    user_id: uuid.UUID,
    notif_type: str,
    title: str,
    body: str | None = None,
    entity_type: str | None = None,
    entity_id: uuid.UUID | None = None,
) -> str:
    notif_id = str(uuid.uuid4())
    await db.execute(
        text("""
            INSERT INTO notifications (id, user_id, type, title, body, entity_type, entity_id)
            VALUES (:id, :uid, :type, :title, :body, :etype, :eid)
        """),
        {
            "id": notif_id,
            "uid": str(user_id),
            "type": notif_type,
            "title": title,
            "body": body,
            "etype": entity_type,
            "eid": str(entity_id) if entity_id else None,
        },
    )
    return notif_id


# ── High-level event dispatchers ──────────────────────────────────────────────

async def notify_pipeline_move(
    db: AsyncSession,
    job_id: uuid.UUID,
    candidate_id: uuid.UUID,
    candidate_name: str,
    job_title: str,
    from_stage: str | None,
    to_stage: str,
) -> None:
    """Notify all recruiters/hiring managers assigned to the job."""
    assigned = await db.execute(
        text("""
            SELECT u.id, u.email, u.full_name
            FROM job_assignments ja
            JOIN users u ON u.id = ja.user_id
            WHERE ja.job_id = :jid AND u.is_active = true
        """),
        {"jid": str(job_id)},
    )
    users = assigned.fetchall()

    for user_id, email, full_name in users:
        try:
            prefs = await get_or_create_prefs(db, user_id)
            if prefs.get("unsubscribed_all"):
                continue

            # In-app
            if prefs.get("inapp_pipeline_moves", True):
                move_text = f"{from_stage} → {to_stage}" if from_stage else f"Added to {to_stage}"
                await create_notification(
                    db, user_id, "pipeline_move",
                    title=f"{candidate_name} moved to {to_stage}",
                    body=f"{move_text} on {job_title}",
                    entity_type="job", entity_id=job_id,
                )

            # Email
            if prefs.get("email_pipeline_moves", True):
                unsub_url = await _unsubscribe_url(db, user_id)
                subject, html, text_body = pipeline_move_email(candidate_name, job_title, from_stage, to_stage, unsub_url)
                await queue_email(db, email, full_name, subject, html, text_body, metadata={"job_id": str(job_id)})

        except Exception as exc:
            logger.warning("Failed to notify user %s for pipeline move: %s", user_id, exc)

    await db.flush()


async def notify_shortlist_action(
    db: AsyncSession,
    job_id: uuid.UUID,
    candidate_id: uuid.UUID,
    candidate_name: str,
    job_title: str,
    action: str,
    performed_by: uuid.UUID | None,
) -> None:
    """Notify assigned users about a shortlist accept/reject."""
    assigned = await db.execute(
        text("""
            SELECT u.id, u.email, u.full_name
            FROM job_assignments ja
            JOIN users u ON u.id = ja.user_id
            WHERE ja.job_id = :jid AND u.is_active = true
              AND u.id != :by
        """),
        {"jid": str(job_id), "by": str(performed_by) if performed_by else str(uuid.uuid4())},
    )
    users = assigned.fetchall()

    for user_id, email, full_name in users:
        try:
            prefs = await get_or_create_prefs(db, user_id)
            if prefs.get("unsubscribed_all"):
                continue

            if prefs.get("inapp_shortlist_actions", True):
                await create_notification(
                    db, user_id, "shortlist_action",
                    title=f"Shortlist: {candidate_name} {action}",
                    body=f"On job: {job_title}",
                    entity_type="job", entity_id=job_id,
                )

            if prefs.get("email_shortlist_actions", True):
                unsub_url = await _unsubscribe_url(db, user_id)
                subject, html, text_body = shortlist_action_email(candidate_name, job_title, action, unsub_url)
                await queue_email(db, email, full_name, subject, html, text_body, metadata={"job_id": str(job_id)})

        except Exception as exc:
            logger.warning("Failed to notify user %s for shortlist action: %s", user_id, exc)

    await db.flush()


async def notify_parse_complete(
    db: AsyncSession,
    job_id: uuid.UUID,
    candidate_name: str,
    job_title: str,
    fit_score: float | None = None,
) -> None:
    """Notify assigned recruiters when a resume finishes parsing."""
    assigned = await db.execute(
        text("""
            SELECT u.id, u.email, u.full_name
            FROM job_assignments ja
            JOIN users u ON u.id = ja.user_id
            WHERE ja.job_id = :jid AND u.is_active = true
        """),
        {"jid": str(job_id)},
    )
    users = assigned.fetchall()

    for user_id, email, full_name in users:
        try:
            prefs = await get_or_create_prefs(db, user_id)
            if prefs.get("unsubscribed_all"):
                continue

            if prefs.get("inapp_parse_complete", True):
                await create_notification(
                    db, user_id, "parse_complete",
                    title=f"New applicant: {candidate_name}",
                    body=f"Resume parsed for {job_title}" + (f" — score {fit_score:.0f}" if fit_score else ""),
                    entity_type="job", entity_id=job_id,
                )

            if prefs.get("email_parse_complete", False):
                unsub_url = await _unsubscribe_url(db, user_id)
                subject, html, text_body = parse_complete_email(candidate_name, job_title, fit_score, unsub_url)
                await queue_email(db, email, full_name, subject, html, text_body, metadata={"job_id": str(job_id)})

        except Exception as exc:
            logger.warning("Failed to notify user %s for parse complete: %s", user_id, exc)

    await db.flush()
