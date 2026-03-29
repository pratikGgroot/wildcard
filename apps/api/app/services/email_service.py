"""Email service — sends via SMTP (Mailpit in dev, real SMTP in prod)."""
import logging
import smtplib
import uuid
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.core.config import settings

logger = logging.getLogger(__name__)


# ── HTML email templates ──────────────────────────────────────────────────────

def _base_template(title: str, body_html: str, unsubscribe_url: str | None = None) -> str:
    unsub = f'<p style="font-size:11px;color:#9ca3af;margin-top:32px">Don\'t want these emails? <a href="{unsubscribe_url}" style="color:#6366f1">Unsubscribe</a></p>' if unsubscribe_url else ""
    return f"""
<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f9fafb;padding:32px">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:32px">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px">
    <div style="width:32px;height:32px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px">H</div>
    <span style="font-size:16px;font-weight:700;color:#111827">HireIQ</span>
  </div>
  <h2 style="font-size:18px;font-weight:700;color:#111827;margin:0 0 16px">{title}</h2>
  {body_html}
  {unsub}
</div>
</body></html>
"""


def pipeline_move_email(candidate_name: str, job_title: str, from_stage: str | None, to_stage: str, unsubscribe_url: str | None = None) -> tuple[str, str, str]:
    """Returns (subject, html, text)."""
    subject = f"Candidate {candidate_name} moved to {to_stage} — {job_title}"
    move_text = f"{from_stage} → {to_stage}" if from_stage else f"Added to {to_stage}"
    body = f"""
<p style="color:#374151;font-size:14px">A candidate's pipeline stage has been updated.</p>
<div style="background:#f3f4f6;border-radius:8px;padding:16px;margin:16px 0">
  <p style="margin:0 0 6px;font-size:13px;color:#6b7280">Candidate</p>
  <p style="margin:0;font-size:15px;font-weight:600;color:#111827">{candidate_name}</p>
</div>
<div style="background:#eef2ff;border-radius:8px;padding:16px;margin:16px 0">
  <p style="margin:0 0 6px;font-size:13px;color:#6b7280">Stage change</p>
  <p style="margin:0;font-size:15px;font-weight:600;color:#4f46e5">{move_text}</p>
  <p style="margin:4px 0 0;font-size:13px;color:#6b7280">Job: {job_title}</p>
</div>
"""
    return subject, _base_template(subject, body, unsubscribe_url), f"{subject}\n\nCandidate: {candidate_name}\nStage: {move_text}\nJob: {job_title}"


def shortlist_action_email(candidate_name: str, job_title: str, action: str, unsubscribe_url: str | None = None) -> tuple[str, str, str]:
    action_label = {"accepted": "✅ Accepted", "rejected": "❌ Rejected", "deferred": "⏸ Deferred"}.get(action, action)
    subject = f"Shortlist action: {candidate_name} {action} — {job_title}"
    body = f"""
<p style="color:#374151;font-size:14px">A shortlist decision has been made.</p>
<div style="background:#f3f4f6;border-radius:8px;padding:16px;margin:16px 0">
  <p style="margin:0 0 4px;font-size:13px;color:#6b7280">Candidate</p>
  <p style="margin:0;font-size:15px;font-weight:600;color:#111827">{candidate_name}</p>
  <p style="margin:6px 0 0;font-size:14px;font-weight:600">{action_label}</p>
  <p style="margin:4px 0 0;font-size:13px;color:#6b7280">Job: {job_title}</p>
</div>
"""
    return subject, _base_template(subject, body, unsubscribe_url), f"{subject}\n\nCandidate: {candidate_name}\nAction: {action}\nJob: {job_title}"


def parse_complete_email(candidate_name: str, job_title: str, fit_score: float | None = None, unsubscribe_url: str | None = None) -> tuple[str, str, str]:
    subject = f"Resume parsed: {candidate_name} applied for {job_title}"
    score_html = f'<p style="margin:6px 0 0;font-size:13px;color:#6b7280">Fit score: <strong style="color:#4f46e5">{fit_score:.0f}/100</strong></p>' if fit_score else ""
    body = f"""
<p style="color:#374151;font-size:14px">A new resume has been parsed and is ready for review.</p>
<div style="background:#f0fdf4;border-radius:8px;padding:16px;margin:16px 0">
  <p style="margin:0 0 4px;font-size:13px;color:#6b7280">Candidate</p>
  <p style="margin:0;font-size:15px;font-weight:600;color:#111827">{candidate_name}</p>
  <p style="margin:4px 0 0;font-size:13px;color:#6b7280">Job: {job_title}</p>
  {score_html}
</div>
"""
    return subject, _base_template(subject, body, unsubscribe_url), f"{subject}\n\nCandidate: {candidate_name}\nJob: {job_title}"


# ── SMTP sender ───────────────────────────────────────────────────────────────

def send_email_sync(to_email: str, to_name: str | None, subject: str, html_body: str, text_body: str | None = None) -> bool:
    """Send email synchronously via SMTP. Used by Celery tasks."""
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
        msg["To"] = f"{to_name} <{to_email}>" if to_name else to_email

        if text_body:
            msg.attach(MIMEText(text_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            if settings.SMTP_TLS:
                server.starttls()
            if settings.SMTP_USER:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM_EMAIL, [to_email], msg.as_string())

        logger.info("Email sent to %s: %s", to_email, subject)
        return True
    except Exception as exc:
        logger.error("Failed to send email to %s: %s", to_email, exc)
        return False


# ── Queue helpers (async, for use in API routes) ──────────────────────────────

async def queue_email(
    db: AsyncSession,
    to_email: str,
    to_name: str | None,
    subject: str,
    html_body: str,
    text_body: str | None = None,
    metadata: dict | None = None,
) -> str:
    """Insert email into queue. Celery worker picks it up."""
    import json
    email_id = str(uuid.uuid4())
    await db.execute(
        text("""
            INSERT INTO email_queue (id, to_email, to_name, subject, html_body, text_body, status, metadata)
            VALUES (:id, :to, :name, :subj, :html, :txt, 'pending', :meta)
        """),
        {
            "id": email_id,
            "to": to_email,
            "name": to_name,
            "subj": subject,
            "html": html_body,
            "txt": text_body,
            "meta": json.dumps(metadata) if metadata else None,
        },
    )
    return email_id
