"""
Chat Service — Epic 06
Hybrid agent: rule-based intent routing + LLM for response formatting.
No LangChain/LangGraph — uses Ollama directly via httpx.
"""
import json
import logging
import re
import uuid
from datetime import datetime, timedelta
from typing import AsyncGenerator

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.services.llm_service import LLMService

logger = logging.getLogger(__name__)

MAX_TURNS = 20
SESSION_EXPIRY_HOURS = 24

_llm = LLMService()

# ── System prompt ─────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """\
You are Apex Hire, an AI recruiting assistant for a hiring platform.

You have access to these tools (already called before this message):
- search_candidates: semantic search over candidate profiles
- filter_pipeline: filter candidates by date range or score
- get_pipeline_summary: aggregate stats for a job
- list_jobs: list job postings
- get_job_details: full job description and criteria from the database

CRITICAL RULES:
1. ONLY use data provided in <tool_data> tags. NEVER invent names, scores, counts, or qualifications.
2. If tool_data is provided, present it accurately. Do not add rows, change numbers, or fabricate details.
3. If no tool_data is provided, answer from conversation context only.
4. Candidate links look like [Name](/candidates/uuid) — copy them exactly, never modify the UUID.
5. Be concise and helpful. Use markdown tables when presenting lists.

Today's date: {today}
"""

# ── Session helpers ───────────────────────────────────────────────────────────

async def get_or_create_session(db: AsyncSession, session_id: uuid.UUID | None) -> dict:
    if session_id:
        row = await db.execute(
            text("SELECT id, is_expired, last_active FROM conversation_sessions WHERE id = :sid"),
            {"sid": str(session_id)},
        )
        session = row.fetchone()
        if session and not session.is_expired:
            if datetime.utcnow() - session.last_active > timedelta(hours=SESSION_EXPIRY_HOURS):
                await db.execute(
                    text("UPDATE conversation_sessions SET is_expired = true WHERE id = :sid"),
                    {"sid": str(session_id)},
                )
                await db.commit()
            else:
                return {"id": str(session.id), "expired": False, "new": False}

    new_id = uuid.uuid4()
    await db.execute(
        text("INSERT INTO conversation_sessions (id) VALUES (:sid)"),
        {"sid": str(new_id)},
    )
    await db.commit()
    return {"id": str(new_id), "expired": session_id is not None, "new": True}


async def get_context_messages(db: AsyncSession, session_id: str) -> list[dict]:
    rows = await db.execute(
        text("""
            SELECT role, content FROM conversation_messages
            WHERE session_id = :sid
            ORDER BY created_at DESC
            LIMIT :limit
        """),
        {"sid": session_id, "limit": MAX_TURNS * 2},
    )
    return [{"role": r.role, "content": r.content} for r in reversed(rows.fetchall())]


async def save_message(db: AsyncSession, session_id: str, role: str, content: str,
                       tool_name: str | None = None, tool_args: dict | None = None) -> None:
    await db.execute(
        text("""
            INSERT INTO conversation_messages (session_id, role, content, tool_name, tool_args)
            VALUES (:sid, :role, :content, :tool_name, :tool_args)
        """),
        {
            "sid": session_id, "role": role, "content": content,
            "tool_name": tool_name,
            "tool_args": json.dumps(tool_args) if tool_args else None,
        },
    )
    await db.execute(
        text("UPDATE conversation_sessions SET last_active = now() WHERE id = :sid"),
        {"sid": session_id},
    )
    await db.commit()


# ── Tool handlers ─────────────────────────────────────────────────────────────

def _format_candidate_rows(rows: list) -> str:
    if not rows:
        return "No candidates found matching your query."
    lines = ["| Name | Score | Location | Top Skills |",
             "|------|-------|----------|------------|"]
    for r in rows:
        name = r.full_name or "Unknown"
        cid = str(r.id)
        score = f"{r.fit_score:.0f}" if r.fit_score else "—"
        location = r.location or "—"
        pd = r.parsed_data or {}
        skills = (pd.get("normalized_skills") or pd.get("skills") or [])[:3]
        skills_str = ", ".join(skills) if skills else "—"
        lines.append(f"| [{name}](/candidates/{cid}) | {score} | {location} | {skills_str} |")
    return "\n".join(lines)


async def _tool_search_candidates(db: AsyncSession, args: dict) -> str:
    query = args.get("query", "")
    job_id = args.get("job_id")
    min_score = float(args.get("min_score", 0))
    limit = min(int(args.get("limit", 10)), 50)

    query_embedding = await _llm.generate_embedding(query)
    if query_embedding is None:
        return await _tool_search_candidates_text(db, query, job_id, min_score, limit)

    # Fetch candidates with stored embeddings, compute cosine similarity in Python
    # (avoids asyncpg/pgvector type casting issues)
    if job_id:
        rows = await db.execute(
            text("""
                SELECT DISTINCT ON (c.id)
                       c.id, c.full_name, c.email, c.location, c.parsed_data,
                       fs.fit_score, ce.embedding
                FROM candidates c
                JOIN candidate_embeddings ce ON ce.candidate_id = c.id
                JOIN resume_uploads ru ON ru.candidate_id = c.id AND ru.job_id = :job_id
                LEFT JOIN fit_scores fs ON fs.candidate_id = c.id AND fs.job_id = :job_id
                WHERE fs.fit_score >= :min_score OR fs.fit_score IS NULL
                ORDER BY c.id, fs.fit_score DESC NULLS LAST
                LIMIT 100
            """),
            {"job_id": job_id, "min_score": min_score},
        )
    else:
        rows = await db.execute(
            text("""
                SELECT DISTINCT ON (c.id)
                       c.id, c.full_name, c.email, c.location, c.parsed_data,
                       NULL::float AS fit_score, ce.embedding
                FROM candidates c
                JOIN candidate_embeddings ce ON ce.candidate_id = c.id
                ORDER BY c.id
                LIMIT 100
            """),
        )

    results = rows.fetchall()
    if not results:
        return await _tool_search_candidates_text(db, query, job_id, min_score, limit)

    # Cosine similarity in Python
    import math

    def cosine_sim(a: list, b: list) -> float:
        dot = sum(x * y for x, y in zip(a, b))
        mag_a = math.sqrt(sum(x * x for x in a))
        mag_b = math.sqrt(sum(x * x for x in b))
        return dot / (mag_a * mag_b) if mag_a and mag_b else 0.0

    scored = []
    for r in results:
        try:
            emb = json.loads(r.embedding) if isinstance(r.embedding, str) else list(r.embedding)
            sim = cosine_sim(query_embedding, emb)
            scored.append((sim, r))
        except Exception:
            continue

    scored.sort(key=lambda x: x[0], reverse=True)
    top = [r for _, r in scored[:limit]]
    return _format_candidate_rows(top)


async def _tool_search_candidates_text(db: AsyncSession, query: str, job_id: str | None,
                                        min_score: float, limit: int) -> str:
    terms = query.lower().split()
    like_clauses = " OR ".join([f"LOWER(c.raw_resume_text) LIKE '%{t}%'" for t in terms[:5]])
    if not like_clauses:
        like_clauses = "1=1"

    if job_id:
        sql = text(f"""
            SELECT c.id, c.full_name, c.email, c.location, c.parsed_data,
                   fs.fit_score, 0.5 AS similarity
            FROM candidates c
            JOIN resume_uploads ru ON ru.candidate_id = c.id AND ru.job_id = :job_id
            LEFT JOIN fit_scores fs ON fs.candidate_id = c.id AND fs.job_id = :job_id
            WHERE ({like_clauses})
            ORDER BY fs.fit_score DESC NULLS LAST
            LIMIT :limit
        """)
        rows = await db.execute(sql, {"job_id": job_id, "limit": limit})
    else:
        sql = text(f"""
            SELECT c.id, c.full_name, c.email, c.location, c.parsed_data,
                   NULL::float AS fit_score, 0.5 AS similarity
            FROM candidates c
            WHERE ({like_clauses})
            LIMIT :limit
        """)
        rows = await db.execute(sql, {"limit": limit})
    return _format_candidate_rows(rows.fetchall())


async def _tool_filter_pipeline(db: AsyncSession, args: dict) -> str:
    job_id = args.get("job_id")
    applied_after = args.get("applied_after")
    applied_before = args.get("applied_before")
    min_score = args.get("min_score")
    max_score = args.get("max_score")
    limit = min(int(args.get("limit", 20)), 50)

    conditions = ["1=1"]
    params: dict = {"limit": limit}
    if job_id:
        conditions.append("ru.job_id = :job_id")
        params["job_id"] = job_id
    if applied_after:
        conditions.append("ru.uploaded_at >= :applied_after")
        params["applied_after"] = applied_after
    if applied_before:
        conditions.append("ru.uploaded_at <= :applied_before")
        params["applied_before"] = applied_before
    if min_score is not None:
        conditions.append("fs.fit_score >= :min_score")
        params["min_score"] = min_score
    if max_score is not None:
        conditions.append("fs.fit_score <= :max_score")
        params["max_score"] = max_score

    where = " AND ".join(conditions)
    rows = await db.execute(
        text(f"""
            SELECT DISTINCT ON (c.id)
                c.id, c.full_name, c.email, c.location, c.parsed_data,
                fs.fit_score, ru.uploaded_at
            FROM candidates c
            JOIN resume_uploads ru ON ru.candidate_id = c.id
            LEFT JOIN fit_scores fs ON fs.candidate_id = c.id AND fs.job_id = ru.job_id
            WHERE {where}
            ORDER BY c.id, ru.uploaded_at DESC
            LIMIT :limit
        """),
        params,
    )
    results = rows.fetchall()
    if not results:
        return "No candidates found matching those criteria."

    lines = ["| Name | Score | Applied | Location |", "|------|-------|---------|----------|"]
    for r in results:
        name = r.full_name or "Unknown"
        cid = str(r.id)
        score = f"{r.fit_score:.0f}" if r.fit_score else "—"
        applied = r.uploaded_at.strftime("%b %d, %Y") if r.uploaded_at else "—"
        location = r.location or "—"
        lines.append(f"| [{name}](/candidates/{cid}) | {score} | {applied} | {location} |")
    return "\n".join(lines)


async def _tool_get_pipeline_summary(db: AsyncSession, args: dict) -> str:
    job_id = args.get("job_id")
    if not job_id:
        row = await db.execute(text("""
            SELECT COUNT(DISTINCT c.id) AS total,
                   AVG(fs.fit_score) AS avg_score,
                   COUNT(DISTINCT CASE WHEN fs.fit_score >= 70 THEN c.id END) AS high_fit
            FROM candidates c
            LEFT JOIN fit_scores fs ON fs.candidate_id = c.id AND fs.is_current = true
        """))
        r = row.fetchone()
        if not r or not r.total:
            return "No candidates found in the system."
        avg = f"{r.avg_score:.1f}" if r.avg_score else "N/A"
        return (
            f"**Overall Pipeline**\n"
            f"- Total candidates: {r.total}\n"
            f"- High fit (>=70): {r.high_fit}\n"
            f"- Avg score: {avg}\n\n"
            "Tip: Ask about a specific job for a detailed breakdown."
        )

    row = await db.execute(
        text("""
            SELECT COUNT(DISTINCT c.id) AS total,
                   AVG(fs.fit_score) AS avg_score,
                   MAX(fs.fit_score) AS max_score,
                   MIN(fs.fit_score) AS min_score,
                   COUNT(DISTINCT CASE WHEN fs.fit_score >= 70 THEN c.id END) AS high_fit
            FROM candidates c
            JOIN resume_uploads ru ON ru.candidate_id = c.id AND ru.job_id = :job_id
            LEFT JOIN fit_scores fs ON fs.candidate_id = c.id AND fs.job_id = :job_id
        """),
        {"job_id": job_id},
    )
    r = row.fetchone()
    if not r or not r.total:
        return "No candidates found for this job."

    top_rows = await db.execute(
        text("""
            SELECT c.id, c.full_name, fs.fit_score
            FROM candidates c
            JOIN resume_uploads ru ON ru.candidate_id = c.id AND ru.job_id = :job_id
            JOIN fit_scores fs ON fs.candidate_id = c.id AND fs.job_id = :job_id
            ORDER BY fs.fit_score DESC
            LIMIT 5
        """),
        {"job_id": job_id},
    )
    top = top_rows.fetchall()

    lines = [
        "**Pipeline Summary**",
        f"- Total candidates: {r.total}",
        f"- High fit (>=70): {r.high_fit}",
        f"- Avg score: {r.avg_score:.1f}" if r.avg_score else "- Avg score: N/A",
        f"- Score range: {r.min_score:.0f}-{r.max_score:.0f}" if r.max_score else "",
        "",
        "**Top Candidates:**",
    ]
    for t in top:
        name = t.full_name or "Unknown"
        cid = str(t.id)
        lines.append(f"- [{name}](/candidates/{cid}) - {t.fit_score:.0f}")
    return "\n".join(lines)


async def _tool_list_jobs(db: AsyncSession, args: dict) -> str:
    status_filter = args.get("status")
    limit = min(int(args.get("limit", 20)), 50)

    conditions = ["1=1"]
    params: dict = {"limit": limit}
    if status_filter:
        conditions.append("j.status = :status")
        params["status"] = status_filter

    where = " AND ".join(conditions)
    rows = await db.execute(
        text(f"""
            SELECT j.id, j.title, j.department, j.location, j.type, j.status,
                   COUNT(DISTINCT ru.candidate_id) AS applicant_count
            FROM jobs j
            LEFT JOIN resume_uploads ru ON ru.job_id = j.id AND ru.status = 'completed'
            WHERE {where}
            GROUP BY j.id
            ORDER BY j.created_at DESC
            LIMIT :limit
        """),
        params,
    )
    results = rows.fetchall()
    if not results:
        return "No jobs found."

    lines = ["| Title | Status | Department | Location | Applicants |",
             "|-------|--------|------------|----------|------------|"]
    for r in results:
        title = f"[{r.title}](/jobs/{r.id})"
        dept = r.department or "—"
        loc = r.location or "—"
        lines.append(f"| {title} | {r.status} | {dept} | {loc} | {r.applicant_count} |")
    return "\n".join(lines)


async def _tool_get_job_details(db: AsyncSession, args: dict) -> str:
    job_title = args.get("job_title", "").strip()
    if not job_title:
        return "Please specify a job title."

    row = await db.execute(
        text("""
            SELECT id, title, description, department, location, type, status
            FROM jobs
            WHERE LOWER(title) LIKE :hint
            ORDER BY CASE WHEN LOWER(title) = :exact THEN 0 ELSE 1 END, created_at DESC
            LIMIT 1
        """),
        {"hint": f"%{job_title.lower()}%", "exact": job_title.lower()},
    )
    job = row.fetchone()
    if not job:
        return f"No job found matching '{job_title}'."

    criteria_rows = await db.execute(
        text("""
            SELECT criterion_name, criterion_type, weight, required
            FROM job_criteria
            WHERE job_id = :jid
            ORDER BY required DESC, weight DESC
        """),
        {"jid": str(job.id)},
    )
    criteria = criteria_rows.fetchall()

    lines = [
        f"**{job.title}** ([View Job](/jobs/{job.id}))",
        f"- Status: {job.status}",
        f"- Department: {job.department or 'N/A'}",
        f"- Location: {job.location or 'N/A'}",
        f"- Type: {job.type}",
        "",
        "**Job Description:**",
        job.description or "No description provided.",
    ]
    if criteria:
        lines += ["", "**Requirements/Criteria (from database):**",
                  "| Requirement | Type | Weight | Required |",
                  "|-------------|------|--------|----------|"]
        for c in criteria:
            req = "Yes" if c.required else "No"
            lines.append(f"| {c.criterion_name} | {c.criterion_type} | {c.weight} | {req} |")
    else:
        lines.append("\nNo criteria defined for this job yet.")
    return "\n".join(lines)


# ── Tool dispatcher ───────────────────────────────────────────────────────────

async def execute_tool(db: AsyncSession, tool_name: str, tool_args: dict) -> tuple[str, dict[str, str]]:
    """Returns (result_text, name_to_uuid_map)."""
    try:
        if tool_name == "search_candidates":
            result = await _tool_search_candidates(db, tool_args)
        elif tool_name == "filter_pipeline":
            result = await _tool_filter_pipeline(db, tool_args)
        elif tool_name == "get_pipeline_summary":
            result = await _tool_get_pipeline_summary(db, tool_args)
        elif tool_name == "list_jobs":
            result = await _tool_list_jobs(db, tool_args)
        elif tool_name == "get_job_details":
            result = await _tool_get_job_details(db, tool_args)
        else:
            return f"Unknown tool: {tool_name}", {}
    except Exception as exc:
        logger.error("Tool %s failed: %s", tool_name, exc, exc_info=True)
        return f"Tool error: {exc}", {}

    # Extract real candidate UUIDs from result links for post-processing
    name_to_id: dict[str, str] = {}
    for m in re.finditer(r'\[([^\]]+)\]\(/candidates/([a-f0-9-]{36})\)', result):
        name_to_id[m.group(1).lower()] = m.group(2)
    return result, name_to_id


def _fix_candidate_links(response: str, name_to_id: dict[str, str]) -> str:
    """Replace any hallucinated /candidates/FAKE_ID with real UUIDs matched by name."""
    uuid_pattern = re.compile(
        r'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
    )

    def replacer(m: re.Match) -> str:
        name, fake_id = m.group(1), m.group(2)
        if uuid_pattern.match(fake_id):
            return m.group(0)
        real_id = name_to_id.get(name.lower())
        return f"[{name}](/candidates/{real_id})" if real_id else m.group(0)

    return re.sub(r'\[([^\]]+)\]\(/candidates/([^)]+)\)', replacer, response)


# ── Intent classifier ─────────────────────────────────────────────────────────

def _classify_intent(message: str) -> tuple[str, dict]:
    """Rule-based intent routing. Returns (tool_name, args) or ('none', {})."""
    msg = message.lower().strip()

    # Job details / qualifications
    if re.search(
        r'\b(qualifications?|requirements?|skills?\s+needed|criteria|description)\b.{0,50}\b(for|of|about)\b'
        r'|\bwhat.{0,20}(require|need|look\s+for).{0,30}\b(job|role|position)\b'
        r'|\b(job|role|position)\s+description\b'
        r'|\btell\s+me\s+about.{0,30}\b(job|role|position)\b',
        msg
    ):
        title_m = re.search(
            r'(?:for|about|of)\s+(?:the\s+)?([A-Za-z][A-Za-z\s]{2,40}?)(?:\s+role|\s+job|\s+position|[?]|$)',
            message, re.IGNORECASE
        )
        title = title_m.group(1).strip() if title_m else message
        return "get_job_details", {"job_title": title}

    # List jobs
    if re.search(
        r'\b(list|show|get|give|display|what are|find)\b.{0,30}\b(jobs?|positions?|openings?|postings?|roles?)\b'
        r'|\bjobs?\b.{0,20}\b(active|open|available|current|all)\b'
        r'|\b(active|open|available|current|all)\b.{0,20}\bjobs?\b',
        msg
    ):
        args: dict = {}
        if any(w in msg for w in ["active", "open"]):
            args["status"] = "active"
        elif "draft" in msg:
            args["status"] = "draft"
        elif "closed" in msg:
            args["status"] = "closed"
        return "list_jobs", args

    # Pipeline summary / count queries
    if re.search(
        r'\bpipeline\s+(summary|stats?|overview)\b'
        r'|\bhow many\b.{0,40}\b(candidates?|applicants?|applied)\b'
        r'|\btotal\s+candidates?\b'
        r'|\bcount\s+(?:of\s+)?candidates?\b',
        msg
    ):
        return "get_pipeline_summary", {}

    # Date/score filter
    today = datetime.utcnow()
    date_args: dict = {}

    m = re.search(r'last\s+(\d+)\s+days?', msg)
    if m:
        date_args["applied_after"] = (today - timedelta(days=int(m.group(1)))).strftime("%Y-%m-%d")
        date_args["applied_before"] = today.strftime("%Y-%m-%d")

    m = re.search(r'last\s+(\d+)\s+weeks?', msg)
    if m:
        date_args["applied_after"] = (today - timedelta(weeks=int(m.group(1)))).strftime("%Y-%m-%d")
        date_args["applied_before"] = today.strftime("%Y-%m-%d")

    if "this week" in msg:
        date_args["applied_after"] = (today - timedelta(days=today.weekday())).strftime("%Y-%m-%d")
        date_args["applied_before"] = today.strftime("%Y-%m-%d")

    if "this month" in msg:
        date_args["applied_after"] = today.replace(day=1).strftime("%Y-%m-%d")
        date_args["applied_before"] = today.strftime("%Y-%m-%d")

    m = re.search(r'score\s+(?:above|over|>)\s*(\d+)', msg)
    if m:
        date_args["min_score"] = float(m.group(1))

    m = re.search(r'score\s+(?:below|under|<)\s*(\d+)', msg)
    if m:
        date_args["max_score"] = float(m.group(1))

    if date_args or re.search(r'\b(who applied|recent applicants?|new applicants?)\b', msg):
        if not date_args.get("applied_after") and "recent" in msg:
            date_args["applied_after"] = (today - timedelta(days=7)).strftime("%Y-%m-%d")
            date_args["applied_before"] = today.strftime("%Y-%m-%d")
        return "filter_pipeline", date_args

    # Candidate search
    if re.search(
        r'\b(show|find|search|get|list|give)\b.{0,30}\b(candidates?|applicants?|engineers?|developers?|designers?|managers?)\b'
        r'|\b(top|best|senior|junior|experienced)\b.{0,30}\b(candidates?|engineers?|developers?|managers?)\b'
        r'|\bcandidates?\b.{0,20}\b(with|who have|having|skilled in)\b'
        r'|\bsuitable\b.{0,30}\b(for|candidate)\b',
        msg
    ):
        return "search_candidates", {"query": message, "limit": 10}

    return "none", {}


async def _resolve_job_id(db: AsyncSession, message: str) -> str | None:
    """Extract job title from message and look up its UUID in the DB."""
    patterns = [
        r'for\s+(?:the\s+)?([A-Za-z][A-Za-z\s]{2,40}?)\s+(?:role|position|job|opening)',
        r'(?:role|position|job)\s+(?:of\s+)?([A-Za-z][A-Za-z\s]{2,40})',
        r'applied\s+(?:for\s+)?(?:the\s+)?([A-Za-z][A-Za-z\s]{2,40}?)\s+(?:role|position|job)',
        r'candidates?\s+(?:for\s+)?(?:the\s+)?([A-Za-z][A-Za-z\s]{2,40}?)\s+(?:role|position|job)',
        r'suitable\s+for\s+(?:the\s+)?([A-Za-z][A-Za-z\s]{2,40}?)\s+(?:role|position|job)',
    ]
    title_hint = None
    for pat in patterns:
        m = re.search(pat, message, re.IGNORECASE)
        if m:
            title_hint = m.group(1).strip()
            break

    if not title_hint:
        return None

    row = await db.execute(
        text("""
            SELECT id FROM jobs
            WHERE LOWER(title) LIKE :hint
            ORDER BY CASE WHEN LOWER(title) = :exact THEN 0 ELSE 1 END, created_at DESC
            LIMIT 1
        """),
        {"hint": f"%{title_hint.lower()}%", "exact": title_hint.lower()},
    )
    result = row.fetchone()
    return str(result.id) if result else None


# ── Agent stream ──────────────────────────────────────────────────────────────

async def agent_stream(
    db: AsyncSession,
    session_id: str,
    user_message: str,
) -> AsyncGenerator[str, None]:
    """
    Hybrid agent:
    1. Rule-based intent routing → deterministic tool call
    2. Job title resolution → inject real job_id
    3. LLM formats the response using tool data as ground truth
    """
    await save_message(db, session_id, "user", user_message)

    history = await get_context_messages(db, session_id)
    today = datetime.utcnow().strftime("%Y-%m-%d")
    system = SYSTEM_PROMPT.replace("{today}", today)

    all_name_to_id: dict[str, str] = {}
    tool_context = ""

    # Step 1: classify intent
    tool_name, tool_args = _classify_intent(user_message)

    # Step 2: resolve job title → job_id for scoped queries
    if tool_name in ("filter_pipeline", "search_candidates", "get_pipeline_summary"):
        resolved_job_id = await _resolve_job_id(db, user_message)
        if resolved_job_id:
            tool_args["job_id"] = resolved_job_id

    # Step 3: execute tool
    if tool_name != "none":
        yield f"data: {json.dumps({'type': 'tool_call', 'tool': tool_name, 'args': tool_args})}\n\n"
        tool_result, name_to_id = await execute_tool(db, tool_name, tool_args)
        all_name_to_id.update(name_to_id)
        yield f"data: {json.dumps({'type': 'tool_result', 'tool': tool_name, 'result': tool_result})}\n\n"

        # If tool errored, return the error directly without passing to LLM
        if tool_result.startswith("Tool error:"):
            error_msg = "Sorry, I encountered a database error while fetching that data. Please try again."
            await save_message(db, session_id, "assistant", error_msg)
            yield f"data: {json.dumps({'type': 'token', 'content': error_msg})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            return

        tool_context = tool_result

    # Step 4: build LLM messages
    messages: list[dict] = [{"role": "system", "content": system}]
    messages += history

    if tool_context:
        # Inject tool data as ground truth — LLM must not modify it
        user_content = (
            f"{user_message}\n\n"
            f"<tool_data>\n{tool_context}\n</tool_data>\n\n"
            "Present the tool_data above to the recruiter. "
            "Do NOT change any numbers, names, scores, or IDs. "
            "You may add a brief one-sentence summary before the data."
        )
    else:
        user_content = user_message

    messages.append({"role": "user", "content": user_content})

    # Step 5: stream LLM response
    full_response = ""
    try:
        if settings.LLM_PROVIDER == "ollama":
            async for event in _ollama_generate(messages):
                if event["type"] == "token":
                    full_response += event["content"]
                    yield f"data: {json.dumps(event)}\n\n"
                elif event["type"] == "done":
                    break
        else:
            full_response = tool_context or f"[Mock] {user_message}"
            yield f"data: {json.dumps({'type': 'token', 'content': full_response})}\n\n"

    except Exception as exc:
        logger.error("LLM error: %s", exc, exc_info=True)
        if tool_context:
            # Fallback: return raw tool data if LLM fails
            full_response = tool_context
            yield f"data: {json.dumps({'type': 'token', 'content': tool_context})}\n\n"
        else:
            yield f"data: {json.dumps({'type': 'error', 'content': str(exc)})}\n\n"

    # Step 6: fix any hallucinated candidate links
    if all_name_to_id and full_response:
        fixed = _fix_candidate_links(full_response, all_name_to_id)
        if fixed != full_response:
            yield f"data: {json.dumps({'type': 'replace', 'content': fixed})}\n\n"
            full_response = fixed

    await save_message(db, session_id, "assistant", full_response)
    yield f"data: {json.dumps({'type': 'done'})}\n\n"


# ── Ollama streaming ──────────────────────────────────────────────────────────

async def _ollama_generate(messages: list[dict]) -> AsyncGenerator[dict, None]:
    """Stream tokens from Ollama /api/chat — no tool calling, just text generation."""
    payload = {
        "model": settings.OLLAMA_MODEL,
        "messages": messages,
        "stream": True,
        "options": {
            "temperature": 0.1,
            "num_predict": 1024,
            "stop": ["<|eot_id|>", "</tool_data>"],
        },
    }

    async with httpx.AsyncClient(timeout=180.0) as client:
        async with client.stream(
            "POST",
            f"{settings.OLLAMA_BASE_URL}/api/chat",
            json=payload,
        ) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line.strip():
                    continue
                try:
                    chunk = json.loads(line)
                except json.JSONDecodeError:
                    continue
                content = chunk.get("message", {}).get("content", "")
                if content:
                    yield {"type": "token", "content": content}
                if chunk.get("done"):
                    yield {"type": "done"}
                    return

    yield {"type": "done"}
