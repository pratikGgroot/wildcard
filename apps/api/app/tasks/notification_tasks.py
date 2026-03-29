"""Celery tasks for email queue processing (Epic 10)."""
import logging
from datetime import datetime

from celery import shared_task
from sqlalchemy import select, text

from app.services import celery_app
from app.db.base import SyncSessionLocal
from app.services.email_service import send_email_sync

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.notification_tasks.flush_email_queue")
def flush_email_queue() -> dict:
    """Process pending emails from the queue. Run periodically via Celery beat."""
    sent = 0
    failed = 0

    with SyncSessionLocal() as db:
        rows = db.execute(
            text("""
                SELECT id, to_email, to_name, subject, html_body, text_body
                FROM email_queue
                WHERE status = 'pending' AND attempts < 3
                ORDER BY created_at ASC
                LIMIT 50
            """)
        ).fetchall()

        for row in rows:
            email_id, to_email, to_name, subject, html_body, text_body = row
            ok = send_email_sync(to_email, to_name, subject, html_body, text_body)
            if ok:
                db.execute(
                    text("UPDATE email_queue SET status = 'sent', sent_at = :now WHERE id = :id"),
                    {"now": datetime.utcnow(), "id": str(email_id)},
                )
                sent += 1
            else:
                db.execute(
                    text("""
                        UPDATE email_queue
                        SET attempts = attempts + 1,
                            status = CASE WHEN attempts + 1 >= 3 THEN 'failed' ELSE 'pending' END
                        WHERE id = :id
                    """),
                    {"id": str(email_id)},
                )
                failed += 1

        db.commit()

    logger.info("Email queue flush: sent=%d failed=%d", sent, failed)
    return {"sent": sent, "failed": failed}
