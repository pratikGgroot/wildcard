"""
Interview Kit Service — Epic 07
Stories: 07.1 Skill gap analysis, 07.2 Technical questions,
         07.3 Behavioral questions, 07.4 Gap-probe questions, 07.6 Kit review/edit
"""
import hashlib
import json
import logging
import uuid
from typing import Optional

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings

logger = logging.getLogger(__name__)

# ── Prompts ───────────────────────────────────────────────────────────────────

TECH_QUESTION_PROMPT = """\
You are an expert technical interviewer. Generate {count} highly specific technical interview questions for a {job_title} candidate.

JOB REQUIREMENTS:
- Required skills: {required_skills}
- Job description excerpt: {job_description}

CANDIDATE PROFILE:
- Skills they have: {matched_skills}
- Skill gaps (missing or weak): {skill_gaps}
- Years of experience: {years_exp}
- Recent roles: {recent_roles}

RULES:
1. Each question must reference a SPECIFIC skill from the required list — not generic
2. For skills the candidate HAS: ask depth/advanced questions (e.g. "You listed React — describe how you've handled state management at scale")
3. For skill GAPS: ask foundational questions to assess learning ability
4. Questions must be concrete — mention real tools, scenarios, or trade-offs
5. Avoid generic questions like "Tell me about yourself" or "What is X?"

Return ONLY a valid JSON array (no markdown, no explanation):
[{{"question_text":"...","competency_area":"...","difficulty":"Easy|Medium|Hard","suggested_answer":"...","green_flags":["...","..."],"red_flags":["..."]}}]
"""

BEHAVIORAL_PROMPT = """\
You are an expert behavioral interviewer. Generate {count} targeted behavioral questions for a {job_title} candidate.

JOB CONTEXT:
- Role: {job_title}
- Key competencies needed: {competencies}
- Job description: {job_description}

CANDIDATE CONTEXT:
- Background: {candidate_background}
- Recent experience: {recent_roles}

RULES:
1. Each question must map to a specific competency from the list
2. Use "Tell me about a time..." or "Describe a situation where..." format
3. Make questions relevant to the specific role — e.g. for a senior engineer, ask about technical leadership, not just "teamwork"
4. Include what a strong STAR-format answer looks like

Return ONLY a valid JSON array (no markdown):
[{{"question_text":"...","competency_area":"...","green_flags":["...","..."],"red_flags":["..."]}}]
"""

GAP_PROBE_PROMPT = """\
You are probing a {job_title} candidate on their skill gaps. Generate targeted questions for each gap.

CANDIDATE'S GAPS:
{gaps_json}

CANDIDATE'S EXISTING SKILLS (for context): {existing_skills}

RULES:
1. For COMPLETE gaps (never used): ask "How would you approach learning X given your background in Y?" — reference their actual skills
2. For PARTIAL gaps (limited use): ask a specific depth question — e.g. "You mentioned basic SQL — have you worked with query optimization or indexing strategies?"
3. Each question must be specific to the gap skill AND reference the candidate's actual background
4. Include a rationale explaining why this gap matters for the role

Return ONLY a valid JSON array (no markdown):
[{{"question_text":"...","gap_skill":"...","gap_criticality":"critical|important","question_rationale":"..."}}]
"""

# ── Fallback templates ────────────────────────────────────────────────────────

def _fallback_tech_questions(job_title: str, required_skills: list[str], matched: set[str], gaps: list[dict]) -> list[dict]:
    topics = required_skills if required_skills else [job_title]
    questions = []
    for skill in topics[:8]:
        is_gap = skill.lower() in {g["skill"].lower() for g in gaps}
        difficulty = "Easy" if is_gap else "Medium"
        if skill.lower() in {s.lower() for s in matched}:
            q_text = f"You have experience with {skill} — walk me through the most complex problem you solved using it and the specific approach you took."
        elif is_gap:
            q_text = f"The role requires {skill}, which isn't listed on your resume. How would you approach getting up to speed, and can you describe any adjacent experience?"
        else:
            q_text = f"Describe a project where you applied {skill} and the specific challenges you encountered."
        questions.append({
            "question_text": q_text,
            "competency_area": skill,
            "difficulty": difficulty,
            "suggested_answer": f"A strong answer demonstrates hands-on {skill} experience with concrete examples, specific technical decisions made, and measurable outcomes.",
            "green_flags": [f"Specific {skill} examples with measurable results", "Mentions trade-offs or alternatives considered"],
            "red_flags": ["Vague or purely theoretical answer", "Cannot give a concrete example"],
        })
    if not questions:
        return _generic_role_questions(job_title)
    return questions


def _generic_role_questions(job_title: str) -> list[dict]:
    """Generate generic but relevant questions when no skill criteria exist."""
    return [
        {
            "question_text": f"Walk me through a project where you demonstrated core {job_title} responsibilities.",
            "competency_area": job_title,
            "difficulty": "Medium",
            "suggested_answer": "Strong answers include scope, stakeholders, challenges, and measurable outcomes.",
            "green_flags": ["Clear ownership", "Quantified results"],
            "red_flags": ["No concrete example", "Unclear role"],
        },
        {
            "question_text": f"How do you prioritize competing tasks and deadlines in a {job_title} role?",
            "competency_area": "Prioritization",
            "difficulty": "Medium",
            "suggested_answer": "Look for a structured approach (e.g., MoSCoW, impact/effort matrix) with real examples.",
            "green_flags": ["Uses a framework", "Gives specific example"],
            "red_flags": ["No system", "Relies on gut feeling only"],
        },
        {
            "question_text": "Describe a time you had to manage a difficult stakeholder. What was your approach?",
            "competency_area": "Stakeholder Management",
            "difficulty": "Medium",
            "suggested_answer": "Strong answers show empathy, clear communication, and a positive resolution.",
            "green_flags": ["Proactive communication", "Positive outcome"],
            "red_flags": ["Blames stakeholder", "Escalated without trying to resolve"],
        },
        {
            "question_text": "How do you track and report project progress to leadership?",
            "competency_area": "Reporting",
            "difficulty": "Easy",
            "suggested_answer": "Look for use of tools (Jira, dashboards), cadence, and tailoring to audience.",
            "green_flags": ["Specific tools mentioned", "Adapts to audience"],
            "red_flags": ["Ad-hoc only", "No metrics"],
        },
        {
            "question_text": "Tell me about a project that failed or went significantly off-track. What did you learn?",
            "competency_area": "Problem Solving",
            "difficulty": "Hard",
            "suggested_answer": "Honest reflection with clear learnings and changes made afterward.",
            "green_flags": ["Takes ownership", "Specific learnings applied later"],
            "red_flags": ["Blames others", "No learnings extracted"],
        },
    ]


def _fallback_behavioral_questions(job_title: str, competencies: list[str]) -> list[dict]:
    templates = [
        ("Tell me about a time you had to meet a tight deadline. How did you manage it?", "Time Management"),
        ("Describe a situation where you had to work with a difficult team member.", "Collaboration"),
        ("Tell me about a time you identified and fixed a critical bug or issue under pressure.", "Problem Solving"),
        ("Describe a project where you had to learn a new technology quickly.", "Adaptability"),
        ("Tell me about a time you disagreed with a technical decision. What did you do?", "Communication"),
    ]
    questions = []
    for i, comp in enumerate(competencies[:5]):
        if i < len(templates):
            q, _ = templates[i]
        else:
            q = f"Tell me about a time you demonstrated {comp} in a professional setting."
        questions.append({
            "question_text": q,
            "competency_area": comp,
            "green_flags": ["Specific situation with clear outcome", "Shows self-awareness"],
            "red_flags": ["Blames others", "No concrete example"],
        })
    return questions


def _fallback_gap_probe_questions(job_title: str, gaps: list[dict]) -> list[dict]:
    questions = []
    for gap in gaps[:5]:
        skill = gap["skill"]
        criticality = gap["criticality"]
        if gap.get("is_complete_gap"):
            q = f"The {job_title} role requires {skill}, which isn't on your resume. Walk me through how you'd approach learning it — what resources would you use and how long do you think it would take to be productive?"
        else:
            q = f"You have some exposure to {skill} — can you describe the most advanced use case you've worked on and where you feel your knowledge has limits?"
        questions.append({
            "question_text": q,
            "gap_skill": skill,
            "gap_criticality": criticality,
            "question_rationale": f"Candidate has {'no' if gap.get('is_complete_gap') else 'limited'} {skill} experience, which is a {criticality} requirement for this role.",
        })
    return questions


# ── Gap analysis (Story 07.1) ─────────────────────────────────────────────────

def analyze_skill_gap(candidate_skills: list[str], criteria: list[dict]) -> dict:
    """
    Pure function — no DB, no LLM.
    Returns: { matched, partial, gaps: [{skill, criticality, is_complete_gap}] }
    """
    cand_lower = {s.lower() for s in candidate_skills}
    matched, partial, gaps = [], [], []

    for c in criteria:
        if c.get("criterion_type") != "skill":
            continue
        name = c["criterion_name"]
        name_lower = name.lower()
        weight = c.get("weight", "medium")

        # Simple match: exact or substring
        if name_lower in cand_lower or any(name_lower in cs or cs in name_lower for cs in cand_lower if len(cs) >= 3):
            matched.append(name)
        elif any(name_lower[:4] in cs for cs in cand_lower):
            partial.append(name)
        else:
            criticality = "critical" if weight == "high" else ("important" if weight == "medium" else "minor")
            is_complete = not any(name_lower[:3] in cs for cs in cand_lower)
            gaps.append({"skill": name, "criticality": criticality, "is_complete_gap": is_complete, "weight": weight})

    return {
        "matched_skills": matched,
        "partial_skills": partial,
        "gaps": gaps,
        "has_critical_gaps": any(g["criticality"] == "critical" for g in gaps),
        "gap_count": len(gaps),
    }


def _hash_criteria(criteria: list[dict]) -> str:
    s = json.dumps(sorted([c.get("criterion_name", "") for c in criteria]))
    return hashlib.sha256(s.encode()).hexdigest()[:16]


# ── LLM call helpers ──────────────────────────────────────────────────────────

async def _call_llm_json(prompt: str, fallback: list) -> list:
    """Call Ollama and parse JSON array response. Returns fallback on any error."""
    if settings.LLM_PROVIDER != "ollama":
        return fallback

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(connect=5.0, read=90.0, write=10.0, pool=5.0)) as client:
            resp = await client.post(
                f"{settings.OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": settings.OLLAMA_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.3, "num_predict": 2048},
                },
            )
            resp.raise_for_status()
            raw = resp.json().get("response", "")
            # Extract JSON array from response
            import re
            m = re.search(r"\[.*\]", raw, re.DOTALL)
            if m:
                return json.loads(m.group(0))
    except Exception as exc:
        logger.warning("LLM call failed for interview kit: %s — using fallback", exc)
    return fallback


# ── Main service ──────────────────────────────────────────────────────────────

class InterviewKitService:

    # ── Generate full kit ─────────────────────────────────────────────────────

    async def generate_kit(
        self,
        db: AsyncSession,
        candidate_id: uuid.UUID,
        job_id: uuid.UUID,
        generated_by: Optional[uuid.UUID] = None,
    ) -> dict:
        """Generate or regenerate a full interview kit for a candidate+job."""

        # Load candidate
        cand_row = await db.execute(
            text("SELECT full_name, parsed_data FROM candidates WHERE id = :cid"),
            {"cid": str(candidate_id)},
        )
        cand = cand_row.fetchone()
        if not cand:
            return {"status": "error", "detail": "Candidate not found"}

        # Load job + criteria
        job_row = await db.execute(
            text("SELECT title, description FROM jobs WHERE id = :jid"),
            {"jid": str(job_id)},
        )
        job = job_row.fetchone()
        if not job:
            return {"status": "error", "detail": "Job not found"}

        criteria_rows = await db.execute(
            text("SELECT id, criterion_name, criterion_type, weight, required FROM job_criteria WHERE job_id = :jid"),
            {"jid": str(job_id)},
        )
        criteria = [
            {"id": str(r[0]), "criterion_name": r[1], "criterion_type": r[2], "weight": r[3], "required": r[4]}
            for r in criteria_rows.fetchall()
        ]

        pd = cand[1] or {}
        candidate_skills = (pd.get("normalized_skills") or pd.get("skills") or [])
        job_title = job[0]
        job_description = (job[1] or "")[:600]
        criteria_hash = _hash_criteria(criteria)

        # Extract candidate context for richer prompts
        experience_list = pd.get("experience") or []
        recent_roles = ", ".join(
            f"{e.get('title', '')} at {e.get('company', '')}"
            for e in experience_list[:3]
            if e.get("title")
        ) or "not specified"
        years_exp = pd.get("total_years_experience") or "unknown"
        candidate_background = f"{years_exp} years experience" + (f", recent roles: {recent_roles}" if recent_roles != "not specified" else "")

        # 07.1 — Skill gap analysis
        gap_analysis = analyze_skill_gap(candidate_skills, criteria)

        # Upsert kit record
        existing = await db.execute(
            text("SELECT id FROM interview_kits WHERE candidate_id = :cid AND job_id = :jid"),
            {"cid": str(candidate_id), "jid": str(job_id)},
        )
        ex = existing.fetchone()
        kit_id = uuid.uuid4()
        if ex:
            kit_id = ex[0]
            await db.execute(
                text("""
                    UPDATE interview_kits
                    SET status = 'generated', gap_analysis = :ga, criteria_hash = :ch,
                        generated_by = :gb, approved_by = NULL, approved_at = NULL, updated_at = now()
                    WHERE id = :kid
                """),
                {"ga": json.dumps(gap_analysis), "ch": criteria_hash, "gb": str(generated_by) if generated_by else None, "kid": str(kit_id)},
            )
            # Delete old questions
            await db.execute(text("DELETE FROM interview_questions WHERE kit_id = :kid"), {"kid": str(kit_id)})
        else:
            await db.execute(
                text("""
                    INSERT INTO interview_kits (id, candidate_id, job_id, status, gap_analysis, criteria_hash, generated_by)
                    VALUES (:id, :cid, :jid, 'generated', :ga, :ch, :gb)
                """),
                {
                    "id": str(kit_id), "cid": str(candidate_id), "jid": str(job_id),
                    "ga": json.dumps(gap_analysis), "ch": criteria_hash,
                    "gb": str(generated_by) if generated_by else None,
                },
            )
        await db.commit()

        # 07.2 — Technical questions
        tech_questions = await self._generate_technical_questions(job_title, job_description, criteria, gap_analysis, candidate_skills, years_exp, recent_roles)

        # 07.3 — Behavioral questions
        behavioral_questions = await self._generate_behavioral_questions(job_title, job[1], criteria, candidate_background, recent_roles)

        # 07.4 — Gap-probe questions
        gap_probe_questions = await self._generate_gap_probe_questions(job_title, gap_analysis["gaps"], candidate_skills)

        # Persist all questions
        all_questions = []
        order = 0
        for q in tech_questions:
            qid = uuid.uuid4()
            try:
                rubric = await generate_rubric_for_question(job_title, q["question_text"], "technical", q.get("competency_area"))
            except Exception:
                rubric = None
            try:
                await db.execute(
                    text("""
                        INSERT INTO interview_questions
                            (id, kit_id, question_text, question_type, competency_area, difficulty,
                             suggested_answer, green_flags, red_flags, rubric, display_order)
                        VALUES (:id, :kid, :qt, 'technical', :ca, :diff, :sa, :gf, :rf, :rubric, :ord)
                    """),
                    {
                        "id": str(qid), "kid": str(kit_id), "qt": q["question_text"],
                        "ca": q.get("competency_area"), "diff": q.get("difficulty"),
                        "sa": q.get("suggested_answer"),
                        "gf": json.dumps(q.get("green_flags", [])),
                        "rf": json.dumps(q.get("red_flags", [])),
                        "rubric": json.dumps(rubric) if rubric else None,
                        "ord": order,
                    },
                )
            except Exception:
                await db.rollback()
                await db.execute(
                    text("""
                        INSERT INTO interview_questions
                            (id, kit_id, question_text, question_type, competency_area, difficulty,
                             suggested_answer, green_flags, red_flags, display_order)
                        VALUES (:id, :kid, :qt, 'technical', :ca, :diff, :sa, :gf, :rf, :ord)
                    """),
                    {
                        "id": str(qid), "kid": str(kit_id), "qt": q["question_text"],
                        "ca": q.get("competency_area"), "diff": q.get("difficulty"),
                        "sa": q.get("suggested_answer"),
                        "gf": json.dumps(q.get("green_flags", [])),
                        "rf": json.dumps(q.get("red_flags", [])),
                        "ord": order,
                    },
                )
            all_questions.append({**q, "id": str(qid), "question_type": "technical", "display_order": order, "rubric": rubric})
            order += 1

        for q in behavioral_questions:
            qid = uuid.uuid4()
            try:
                rubric = await generate_rubric_for_question(job_title, q["question_text"], "behavioral", q.get("competency_area"))
            except Exception:
                rubric = None
            try:
                await db.execute(
                    text("""
                        INSERT INTO interview_questions
                            (id, kit_id, question_text, question_type, competency_area,
                             green_flags, red_flags, rubric, display_order)
                        VALUES (:id, :kid, :qt, 'behavioral', :ca, :gf, :rf, :rubric, :ord)
                    """),
                    {
                        "id": str(qid), "kid": str(kit_id), "qt": q["question_text"],
                        "ca": q.get("competency_area"),
                        "gf": json.dumps(q.get("green_flags", [])),
                        "rf": json.dumps(q.get("red_flags", [])),
                        "rubric": json.dumps(rubric) if rubric else None,
                        "ord": order,
                    },
                )
            except Exception:
                await db.rollback()
                await db.execute(
                    text("""
                        INSERT INTO interview_questions
                            (id, kit_id, question_text, question_type, competency_area,
                             green_flags, red_flags, display_order)
                        VALUES (:id, :kid, :qt, 'behavioral', :ca, :gf, :rf, :ord)
                    """),
                    {
                        "id": str(qid), "kid": str(kit_id), "qt": q["question_text"],
                        "ca": q.get("competency_area"),
                        "gf": json.dumps(q.get("green_flags", [])),
                        "rf": json.dumps(q.get("red_flags", [])),
                        "ord": order,
                    },
                )
            all_questions.append({**q, "id": str(qid), "question_type": "behavioral", "display_order": order, "rubric": rubric})
            order += 1

        for q in gap_probe_questions:
            qid = uuid.uuid4()
            try:
                rubric = await generate_rubric_for_question(job_title, q["question_text"], "gap_probe", q.get("gap_skill"))
            except Exception:
                rubric = None
            try:
                await db.execute(
                    text("""
                        INSERT INTO interview_questions
                            (id, kit_id, question_text, question_type, gap_skill, gap_criticality, rubric, display_order)
                        VALUES (:id, :kid, :qt, 'gap_probe', :gs, :gc, :rubric, :ord)
                    """),
                    {
                        "id": str(qid), "kid": str(kit_id), "qt": q["question_text"],
                        "gs": q.get("gap_skill"), "gc": q.get("gap_criticality"),
                        "rubric": json.dumps(rubric) if rubric else None,
                        "ord": order,
                    },
                )
            except Exception:
                await db.rollback()
                await db.execute(
                    text("""
                        INSERT INTO interview_questions
                            (id, kit_id, question_text, question_type, gap_skill, gap_criticality, display_order)
                        VALUES (:id, :kid, :qt, 'gap_probe', :gs, :gc, :ord)
                    """),
                    {
                        "id": str(qid), "kid": str(kit_id), "qt": q["question_text"],
                        "gs": q.get("gap_skill"), "gc": q.get("gap_criticality"),
                        "ord": order,
                    },
                )
            all_questions.append({**q, "id": str(qid), "question_type": "gap_probe", "display_order": order, "rubric": rubric})
            order += 1

        await db.commit()

        return {
            "kit_id": str(kit_id),
            "candidate_id": str(candidate_id),
            "job_id": str(job_id),
            "status": "generated",
            "gap_analysis": gap_analysis,
            "questions": all_questions,
            "question_counts": {
                "technical": len(tech_questions),
                "behavioral": len(behavioral_questions),
                "gap_probe": len(gap_probe_questions),
                "total": len(all_questions),
            },
        }

    # ── Get kit ───────────────────────────────────────────────────────────────

    async def get_kit(self, db: AsyncSession, candidate_id: uuid.UUID, job_id: uuid.UUID) -> dict | None:
        kit_row = await db.execute(
            text("""
                SELECT id, status, gap_analysis, approved_by, approved_at, criteria_hash, created_at, updated_at
                FROM interview_kits WHERE candidate_id = :cid AND job_id = :jid
            """),
            {"cid": str(candidate_id), "jid": str(job_id)},
        )
        kit = kit_row.fetchone()
        if not kit:
            return None

        kit_id = kit[0]

        # Check if outdated
        criteria_rows = await db.execute(
            text("SELECT criterion_name FROM job_criteria WHERE job_id = :jid"),
            {"jid": str(job_id)},
        )
        current_hash = _hash_criteria([{"criterion_name": r[0]} for r in criteria_rows.fetchall()])
        status = kit[1]
        if status == "approved" and current_hash != kit[5]:
            await db.execute(
                text("UPDATE interview_kits SET status = 'outdated' WHERE id = :kid"),
                {"kid": str(kit_id)},
            )
            await db.commit()
            status = "outdated"

        q_rows = await db.execute(
            text("""
                SELECT id, question_text, question_type, competency_area, difficulty,
                       suggested_answer, green_flags, red_flags, gap_skill, gap_criticality,
                       display_order, is_edited,
                       CASE WHEN EXISTS (
                           SELECT 1 FROM information_schema.columns
                           WHERE table_name='interview_questions' AND column_name='rubric'
                       ) THEN rubric ELSE NULL END as rubric
                FROM interview_questions WHERE kit_id = :kid ORDER BY display_order
            """),
            {"kid": str(kit_id)},
        )
        questions = []
        for r in q_rows.fetchall():
            questions.append({
                "id": str(r[0]),
                "question_text": r[1],
                "question_type": r[2],
                "competency_area": r[3],
                "difficulty": r[4],
                "suggested_answer": r[5],
                "green_flags": r[6] or [],
                "red_flags": r[7] or [],
                "gap_skill": r[8],
                "gap_criticality": r[9],
                "display_order": r[10],
                "is_edited": r[11],
                "rubric": r[12],
            })

        return {
            "kit_id": str(kit_id),
            "candidate_id": str(candidate_id),
            "job_id": str(job_id),
            "status": status,
            "gap_analysis": kit[2],
            "approved_by": str(kit[3]) if kit[3] else None,
            "approved_at": kit[4].isoformat() if kit[4] else None,
            "created_at": kit[6].isoformat() if kit[6] else None,
            "updated_at": kit[7].isoformat() if kit[7] else None,
            "questions": questions,
            "question_counts": {
                t: sum(1 for q in questions if q["question_type"] == t)
                for t in ("technical", "behavioral", "gap_probe")
            },
        }

    # ── Edit question (07.6) ──────────────────────────────────────────────────

    async def update_question(self, db: AsyncSession, kit_id: uuid.UUID, question_id: uuid.UUID, data: dict) -> dict | None:
        fields = []
        params: dict = {"qid": str(question_id), "kid": str(kit_id)}
        for field in ("question_text", "competency_area", "difficulty", "suggested_answer"):
            if field in data:
                fields.append(f"{field} = :{field}")
                params[field] = data[field]
        if not fields:
            return None
        fields.append("is_edited = true")
        await db.execute(
            text(f"UPDATE interview_questions SET {', '.join(fields)} WHERE id = :qid AND kit_id = :kid"),
            params,
        )
        await db.commit()
        return await self._get_question(db, question_id)

    async def add_question(self, db: AsyncSession, kit_id: uuid.UUID, data: dict) -> dict:
        # Get next order
        ord_row = await db.execute(
            text("SELECT COALESCE(MAX(display_order), -1) + 1 FROM interview_questions WHERE kit_id = :kid"),
            {"kid": str(kit_id)},
        )
        next_order = ord_row.scalar()
        qid = uuid.uuid4()
        await db.execute(
            text("""
                INSERT INTO interview_questions
                    (id, kit_id, question_text, question_type, competency_area, difficulty, display_order, is_edited)
                VALUES (:id, :kid, :qt, :qtype, :ca, :diff, :ord, true)
            """),
            {
                "id": str(qid), "kid": str(kit_id),
                "qt": data["question_text"],
                "qtype": data.get("question_type", "technical"),
                "ca": data.get("competency_area"),
                "diff": data.get("difficulty"),
                "ord": next_order,
            },
        )
        await db.commit()
        return await self._get_question(db, qid)

    async def delete_question(self, db: AsyncSession, kit_id: uuid.UUID, question_id: uuid.UUID) -> bool:
        result = await db.execute(
            text("DELETE FROM interview_questions WHERE id = :qid AND kit_id = :kid"),
            {"qid": str(question_id), "kid": str(kit_id)},
        )
        await db.commit()
        return result.rowcount > 0

    async def reorder_questions(self, db: AsyncSession, kit_id: uuid.UUID, question_ids: list[uuid.UUID]) -> bool:
        for i, qid in enumerate(question_ids):
            await db.execute(
                text("UPDATE interview_questions SET display_order = :ord WHERE id = :qid AND kit_id = :kid"),
                {"ord": i, "qid": str(qid), "kid": str(kit_id)},
            )
        await db.commit()
        return True

    async def approve_kit(self, db: AsyncSession, kit_id: uuid.UUID, approved_by: uuid.UUID) -> dict | None:
        await db.execute(
            text("UPDATE interview_kits SET status = 'approved', approved_by = :by, approved_at = now() WHERE id = :kid"),
            {"by": str(approved_by), "kid": str(kit_id)},
        )
        await db.commit()
        row = await db.execute(
            text("SELECT candidate_id, job_id FROM interview_kits WHERE id = :kid"),
            {"kid": str(kit_id)},
        )
        r = row.fetchone()
        if r:
            return await self.get_kit(db, r[0], r[1])
        return None

    # ── Private helpers ───────────────────────────────────────────────────────

    async def _generate_technical_questions(
        self, job_title: str, job_description: str, criteria: list[dict], gap_analysis: dict, candidate_skills: list[str], years_exp, recent_roles: str
    ) -> list[dict]:
        required_skills = [c["criterion_name"] for c in criteria if c["criterion_type"] == "skill"][:10]
        all_criteria_names = [c["criterion_name"] for c in criteria[:10]]
        topics = required_skills if required_skills else all_criteria_names
        matched = set(gap_analysis.get("matched_skills", []))
        gaps = gap_analysis.get("gaps", [])
        count = min(8, max(5, len(topics) + 3))

        fallback = _fallback_tech_questions(job_title, topics or [job_title], matched, gaps)
        if not topics:
            return _generic_role_questions(job_title)

        prompt = TECH_QUESTION_PROMPT.format(
            count=count,
            job_title=job_title,
            required_skills=", ".join(topics),
            job_description=job_description[:400],
            matched_skills=", ".join(list(matched)[:10]) or "none listed",
            skill_gaps=", ".join(g["skill"] for g in gaps[:5]) or "none identified",
            years_exp=years_exp,
            recent_roles=recent_roles,
        )
        result = await _call_llm_json(prompt, fallback)
        return result[:8] if result else fallback

    async def _generate_behavioral_questions(
        self, job_title: str, job_description: str, criteria: list[dict], candidate_background: str, recent_roles: str
    ) -> list[dict]:
        competencies = _infer_competencies(job_title, job_description)
        fallback = _fallback_behavioral_questions(job_title, competencies)

        prompt = BEHAVIORAL_PROMPT.format(
            count=min(5, len(competencies)),
            job_title=job_title,
            competencies=", ".join(competencies[:5]),
            job_description=(job_description or "")[:300],
            candidate_background=candidate_background,
            recent_roles=recent_roles,
        )
        result = await _call_llm_json(prompt, fallback)
        return result[:5] if result else fallback

    async def _generate_gap_probe_questions(self, job_title: str, gaps: list[dict], candidate_skills: list[str]) -> list[dict]:
        critical_gaps = [g for g in gaps if g["criticality"] == "critical"]
        important_gaps = [g for g in gaps if g["criticality"] == "important"]
        target_gaps = (critical_gaps[:2] + important_gaps[:3])[:5]
        if not target_gaps:
            return []

        fallback = _fallback_gap_probe_questions(job_title, target_gaps)
        prompt = GAP_PROBE_PROMPT.format(
            job_title=job_title,
            gaps_json=json.dumps(target_gaps, indent=None)[:600],
            existing_skills=", ".join(candidate_skills[:15]) or "not specified",
        )
        result = await _call_llm_json(prompt, fallback)
        return result[:5] if result else fallback

    async def _get_question(self, db: AsyncSession, question_id: uuid.UUID) -> dict | None:
        row = await db.execute(
            text("""
                SELECT id, question_text, question_type, competency_area, difficulty,
                       suggested_answer, green_flags, red_flags, gap_skill, gap_criticality,
                       display_order, is_edited, rubric
                FROM interview_questions WHERE id = :qid
            """),
            {"qid": str(question_id)},
        )
        r = row.fetchone()
        if not r:
            return None
        return {
            "id": str(r[0]), "question_text": r[1], "question_type": r[2],
            "competency_area": r[3], "difficulty": r[4], "suggested_answer": r[5],
            "green_flags": r[6] or [], "red_flags": r[7] or [],
            "gap_skill": r[8], "gap_criticality": r[9],
            "display_order": r[10], "is_edited": r[11], "rubric": r[12],
        }


# ── Competency inference ──────────────────────────────────────────────────────

_COMPETENCY_SIGNALS = {
    "leadership": ["lead", "manager", "director", "head", "principal", "senior", "team lead"],
    "collaboration": ["team", "cross-functional", "stakeholder", "partner", "coordinate"],
    "problem solving": ["solve", "debug", "troubleshoot", "analyze", "investigate", "root cause"],
    "communication": ["present", "communicate", "document", "report", "write", "articulate"],
    "adaptability": ["fast-paced", "startup", "change", "pivot", "flexible", "dynamic"],
    "ownership": ["own", "drive", "initiative", "proactive", "accountable", "responsible"],
    "mentoring": ["mentor", "coach", "guide", "train", "onboard", "junior"],
}


def _infer_competencies(job_title: str, job_description: str) -> list[str]:
    text_lower = (job_title + " " + job_description).lower()
    found = []
    for comp, signals in _COMPETENCY_SIGNALS.items():
        if any(s in text_lower for s in signals):
            found.append(comp)
    # Always include at least these defaults
    defaults = ["problem solving", "collaboration", "communication"]
    for d in defaults:
        if d not in found:
            found.append(d)
    return found[:5]


# ── Rubric generation (Story 07.5) ────────────────────────────────────────────

RUBRIC_PROMPT = """\
Generate a scoring rubric for this interview question for a {job_title} role.

Question: {question_text}
Type: {question_type}
Competency: {competency_area}

Return ONLY valid JSON (no markdown):
{{
  "scale": [
    {{"score": 1, "label": "Poor", "description": "..."}},
    {{"score": 2, "label": "Below Expectations", "description": "..."}},
    {{"score": 3, "label": "Meets Expectations", "description": "..."}},
    {{"score": 4, "label": "Exceeds Expectations", "description": "..."}}
  ],
  "green_flags": ["...", "..."],
  "red_flags": ["..."]
}}
"""


def _fallback_rubric(question_type: str, competency_area: str | None) -> dict:
    comp = competency_area or "the required skill"
    is_behavioral = question_type == "behavioral"
    return {
        "scale": [
            {"score": 1, "label": "Poor", "description": f"No relevant experience or understanding of {comp}. Unable to provide a concrete example."},
            {"score": 2, "label": "Below Expectations", "description": f"Limited experience with {comp}. Example provided but lacks depth or measurable outcomes."},
            {"score": 3, "label": "Meets Expectations", "description": f"Solid understanding of {comp} with a clear, relevant example and reasonable outcome."},
            {"score": 4, "label": "Exceeds Expectations", "description": f"Exceptional depth in {comp}. Example demonstrates leadership, innovation, or significant measurable impact."},
        ],
        "green_flags": [
            "STAR format used clearly" if is_behavioral else f"Specific {comp} examples with measurable results",
            "Demonstrates ownership and initiative",
        ],
        "red_flags": [
            "Blames others or external factors" if is_behavioral else "Vague or purely theoretical answer",
        ],
    }


async def generate_rubric_for_question(
    job_title: str,
    question_text: str,
    question_type: str,
    competency_area: str | None,
) -> dict:
    """Generate a 1–4 scoring rubric for a single question."""
    fallback = _fallback_rubric(question_type, competency_area)
    prompt = RUBRIC_PROMPT.format(
        job_title=job_title,
        question_text=question_text,
        question_type=question_type,
        competency_area=competency_area or "general",
    )
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(connect=5.0, read=60.0, write=10.0, pool=5.0)) as client:
            resp = await client.post(
                f"{settings.OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": settings.OLLAMA_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.2, "num_predict": 1024},
                },
            )
            resp.raise_for_status()
            raw = resp.json().get("response", "")
            import re
            m = re.search(r"\{.*\}", raw, re.DOTALL)
            if m:
                return json.loads(m.group(0))
    except Exception as exc:
        logger.warning("Rubric LLM call failed: %s — using fallback", exc)
    return fallback


# ── Share link service (Story 07.7) ───────────────────────────────────────────

import secrets
from datetime import datetime, timedelta


async def create_share_link(
    db: AsyncSession,
    kit_id: uuid.UUID,
    created_by: uuid.UUID | None = None,
    days: int = 30,
) -> dict:
    """Create a 30-day share link for a kit."""
    token = secrets.token_urlsafe(48)
    expires_at = datetime.utcnow() + timedelta(days=days)
    await db.execute(
        text("""
            INSERT INTO kit_share_links (kit_id, token, created_by, expires_at)
            VALUES (:kid, :token, :cb, :exp)
        """),
        {"kid": str(kit_id), "token": token, "cb": str(created_by) if created_by else None, "exp": expires_at},
    )
    await db.commit()
    return {"token": token, "expires_at": expires_at.isoformat(), "kit_id": str(kit_id)}


async def get_kit_by_share_token(db: AsyncSession, token: str) -> dict | None:
    """Resolve a share token to a kit (public, no auth)."""
    row = await db.execute(
        text("""
            SELECT sl.kit_id, sl.expires_at, sl.is_revoked, ik.candidate_id, ik.job_id
            FROM kit_share_links sl
            JOIN interview_kits ik ON ik.id = sl.kit_id
            WHERE sl.token = :token
        """),
        {"token": token},
    )
    r = row.fetchone()
    if not r:
        return None
    kit_id, expires_at, is_revoked, candidate_id, job_id = r
    if is_revoked or datetime.utcnow() > expires_at:
        return None
    # Increment access count
    await db.execute(
        text("UPDATE kit_share_links SET accessed_count = accessed_count + 1 WHERE token = :token"),
        {"token": token},
    )
    await db.commit()
    svc = InterviewKitService()
    return await svc.get_kit(db, candidate_id, job_id)


async def revoke_share_link(db: AsyncSession, kit_id: uuid.UUID) -> bool:
    result = await db.execute(
        text("UPDATE kit_share_links SET is_revoked = true WHERE kit_id = :kid AND is_revoked = false"),
        {"kid": str(kit_id)},
    )
    await db.commit()
    return result.rowcount > 0


async def get_share_links_for_kit(db: AsyncSession, kit_id: uuid.UUID) -> list[dict]:
    rows = await db.execute(
        text("""
            SELECT token, expires_at, is_revoked, accessed_count, created_at
            FROM kit_share_links WHERE kit_id = :kid ORDER BY created_at DESC
        """),
        {"kid": str(kit_id)},
    )
    return [
        {
            "token": r[0],
            "expires_at": r[1].isoformat(),
            "is_revoked": r[2],
            "accessed_count": r[3],
            "created_at": r[4].isoformat(),
        }
        for r in rows.fetchall()
    ]
