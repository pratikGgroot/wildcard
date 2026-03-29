"""Interview Kit API — Epic 07 (Stories 07.1–07.5, 07.6, 07.7)"""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, RecruiterOrAbove
from app.db.base import get_db
from app.services.interview_kit_service import (
    InterviewKitService,
    generate_rubric_for_question,
    create_share_link,
    get_kit_by_share_token,
    revoke_share_link,
    get_share_links_for_kit,
)

router = APIRouter(tags=["interview-kits"])


def get_svc() -> InterviewKitService:
    return InterviewKitService()


# ── Schemas ───────────────────────────────────────────────────────────────────

class QuestionUpdate(BaseModel):
    question_text: Optional[str] = None
    competency_area: Optional[str] = None
    difficulty: Optional[str] = None
    suggested_answer: Optional[str] = None


class QuestionCreate(BaseModel):
    question_text: str
    question_type: str = "technical"
    competency_area: Optional[str] = None
    difficulty: Optional[str] = None


class ReorderRequest(BaseModel):
    question_ids: list[uuid.UUID]


# ── Generate / get kit ────────────────────────────────────────────────────────

@router.post("/candidates/{candidate_id}/jobs/{job_id}/interview-kit/generate")
async def generate_kit(
    candidate_id: uuid.UUID,
    job_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    svc: InterviewKitService = Depends(get_svc),
):
    """Generate or regenerate an interview kit for a candidate+job (07.1–07.4)."""
    result = await svc.generate_kit(db, candidate_id, job_id, generated_by=current_user.id)
    if result.get("status") == "error":
        raise HTTPException(status_code=404, detail=result["detail"])
    return result


@router.get("/candidates/{candidate_id}/jobs/{job_id}/interview-kit")
async def get_kit(
    candidate_id: uuid.UUID,
    job_id: uuid.UUID,
    _: RecruiterOrAbove,
    db: AsyncSession = Depends(get_db),
    svc: InterviewKitService = Depends(get_svc),
):
    """Get the current interview kit for a candidate+job."""
    kit = await svc.get_kit(db, candidate_id, job_id)
    if not kit:
        raise HTTPException(status_code=404, detail="No interview kit found. Generate one first.")
    return kit


# ── Question CRUD (07.6) ──────────────────────────────────────────────────────

@router.put("/interview-kits/{kit_id}/questions/{question_id}")
async def update_question(
    kit_id: uuid.UUID,
    question_id: uuid.UUID,
    body: QuestionUpdate,
    _: RecruiterOrAbove,
    db: AsyncSession = Depends(get_db),
    svc: InterviewKitService = Depends(get_svc),
):
    result = await svc.update_question(db, kit_id, question_id, body.model_dump(exclude_none=True))
    if not result:
        raise HTTPException(status_code=404, detail="Question not found")
    return result


@router.post("/interview-kits/{kit_id}/questions", status_code=status.HTTP_201_CREATED)
async def add_question(
    kit_id: uuid.UUID,
    body: QuestionCreate,
    _: RecruiterOrAbove,
    db: AsyncSession = Depends(get_db),
    svc: InterviewKitService = Depends(get_svc),
):
    return await svc.add_question(db, kit_id, body.model_dump())


@router.delete("/interview-kits/{kit_id}/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question(
    kit_id: uuid.UUID,
    question_id: uuid.UUID,
    _: RecruiterOrAbove,
    db: AsyncSession = Depends(get_db),
    svc: InterviewKitService = Depends(get_svc),
):
    deleted = await svc.delete_question(db, kit_id, question_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Question not found")


@router.patch("/interview-kits/{kit_id}/questions/reorder")
async def reorder_questions(
    kit_id: uuid.UUID,
    body: ReorderRequest,
    _: RecruiterOrAbove,
    db: AsyncSession = Depends(get_db),
    svc: InterviewKitService = Depends(get_svc),
):
    await svc.reorder_questions(db, kit_id, body.question_ids)
    return {"status": "ok"}


# ── Approve kit (07.6) ────────────────────────────────────────────────────────

@router.post("/interview-kits/{kit_id}/approve")
async def approve_kit(
    kit_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    svc: InterviewKitService = Depends(get_svc),
):
    result = await svc.approve_kit(db, kit_id, current_user.id)
    if not result:
        raise HTTPException(status_code=404, detail="Kit not found")
    return result


# ── Rubric endpoints (07.5) ───────────────────────────────────────────────────

@router.get("/interview-kits/{kit_id}/questions/{question_id}/rubric")
async def get_rubric(
    kit_id: uuid.UUID,
    question_id: uuid.UUID,
    _: RecruiterOrAbove,
    db: AsyncSession = Depends(get_db),
):
    """Get the scoring rubric for a specific question."""
    from sqlalchemy import text
    row = await db.execute(
        text("SELECT rubric, question_text, question_type, competency_area FROM interview_questions WHERE id = :qid AND kit_id = :kid"),
        {"qid": str(question_id), "kid": str(kit_id)},
    )
    r = row.fetchone()
    if not r:
        raise HTTPException(status_code=404, detail="Question not found")
    return {"question_id": str(question_id), "rubric": r[0]}


@router.put("/interview-kits/{kit_id}/questions/{question_id}/rubric")
async def update_rubric(
    kit_id: uuid.UUID,
    question_id: uuid.UUID,
    body: dict,
    _: RecruiterOrAbove,
    db: AsyncSession = Depends(get_db),
):
    """Manually update the rubric for a question."""
    import json
    from sqlalchemy import text
    result = await db.execute(
        text("UPDATE interview_questions SET rubric = :rubric WHERE id = :qid AND kit_id = :kid"),
        {"rubric": json.dumps(body), "qid": str(question_id), "kid": str(kit_id)},
    )
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Question not found")
    return {"question_id": str(question_id), "rubric": body}


@router.post("/interview-kits/{kit_id}/questions/{question_id}/rubric/generate")
async def generate_rubric(
    kit_id: uuid.UUID,
    question_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """(Re)generate rubric for a single question using LLM."""
    import json
    from sqlalchemy import text
    # Get job title for context
    row = await db.execute(
        text("""
            SELECT iq.question_text, iq.question_type, iq.competency_area, j.title
            FROM interview_questions iq
            JOIN interview_kits ik ON ik.id = iq.kit_id
            JOIN jobs j ON j.id = ik.job_id
            WHERE iq.id = :qid AND iq.kit_id = :kid
        """),
        {"qid": str(question_id), "kid": str(kit_id)},
    )
    r = row.fetchone()
    if not r:
        raise HTTPException(status_code=404, detail="Question not found")
    rubric = await generate_rubric_for_question(r[3], r[0], r[1], r[2])
    await db.execute(
        text("UPDATE interview_questions SET rubric = :rubric WHERE id = :qid"),
        {"rubric": json.dumps(rubric), "qid": str(question_id)},
    )
    await db.commit()
    return {"question_id": str(question_id), "rubric": rubric}


# ── Share link endpoints (07.7) ───────────────────────────────────────────────

@router.post("/interview-kits/{kit_id}/share-link")
async def create_kit_share_link(
    kit_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Create a 30-day read-only share link for an approved kit."""
    from sqlalchemy import text
    # Verify kit exists and is approved
    row = await db.execute(
        text("SELECT status FROM interview_kits WHERE id = :kid"),
        {"kid": str(kit_id)},
    )
    r = row.fetchone()
    if not r:
        raise HTTPException(status_code=404, detail="Kit not found")
    if r[0] != "approved":
        raise HTTPException(status_code=400, detail="Kit must be approved before sharing")
    return await create_share_link(db, kit_id, created_by=current_user.id)


@router.get("/interview-kits/{kit_id}/share-links")
async def list_share_links(
    kit_id: uuid.UUID,
    _: RecruiterOrAbove,
    db: AsyncSession = Depends(get_db),
):
    """List all share links for a kit."""
    return await get_share_links_for_kit(db, kit_id)


@router.delete("/interview-kits/{kit_id}/share-link", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_kit_share_link(
    kit_id: uuid.UUID,
    _: RecruiterOrAbove,
    db: AsyncSession = Depends(get_db),
):
    """Revoke all active share links for a kit."""
    await revoke_share_link(db, kit_id)


# ── Public shared kit view (07.7) — no auth required ─────────────────────────

@router.get("/interview-kits/shared/{token}")
async def get_shared_kit(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """Public read-only kit view via share token (no login required)."""
    kit = await get_kit_by_share_token(db, token)
    if not kit:
        raise HTTPException(status_code=404, detail="Share link not found, expired, or revoked")
    return kit


# ── Get kit by ID (for print page) ───────────────────────────────────────────

@router.get("/interview-kits/{kit_id}")
async def get_kit_by_id(
    kit_id: uuid.UUID,
    _: RecruiterOrAbove,
    db: AsyncSession = Depends(get_db),
    svc: InterviewKitService = Depends(get_svc),
):
    """Get a kit directly by its ID (used by print page)."""
    from sqlalchemy import text
    row = await db.execute(
        text("SELECT candidate_id, job_id FROM interview_kits WHERE id = :kid"),
        {"kid": str(kit_id)},
    )
    r = row.fetchone()
    if not r:
        raise HTTPException(status_code=404, detail="Kit not found")
    kit = await svc.get_kit(db, r[0], r[1])
    if not kit:
        raise HTTPException(status_code=404, detail="Kit not found")
    return kit
