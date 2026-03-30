"""Analytics API — Epic 11 (Stories 11.1, 11.2, 11.3, 11.5, 11.7)"""
import csv
import io
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import RecruiterOrAbove
from app.db.base import get_db

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _date_conditions(date_from: Optional[date], date_to: Optional[date], col: str = "ru.uploaded_at") -> tuple[str, dict]:
    conds, params = [], {}
    if date_from:
        conds.append(f"{col} >= :date_from")
        params["date_from"] = date_from
    if date_to:
        conds.append(f"{col} <= :date_to")
        params["date_to"] = date_to
    return (" AND ".join(conds), params)


# ── 11.1 Overview ─────────────────────────────────────────────────────────────

@router.get("/overview")
async def get_overview(
    _: RecruiterOrAbove,
    job_id: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    params: dict = {}
    job_cond = "AND ru.job_id = :job_id" if job_id else ""
    if job_id:
        params["job_id"] = job_id

    date_cond, date_params = _date_conditions(date_from, date_to)
    if date_cond:
        date_cond = "AND " + date_cond
    params.update(date_params)

    # Open roles
    open_roles_row = await db.execute(
        text("SELECT COUNT(*) FROM jobs WHERE status = 'active'" + (" AND id = :job_id" if job_id else "")),
        {"job_id": job_id} if job_id else {},
    )
    open_roles = open_roles_row.scalar() or 0

    # Total applicants
    applicants_row = await db.execute(
        text(f"SELECT COUNT(DISTINCT ru.candidate_id) FROM resume_uploads ru WHERE ru.candidate_id IS NOT NULL {job_cond} {date_cond}"),
        params,
    )
    total_applicants = applicants_row.scalar() or 0

    # Stage-based counts — use actual stage names from the DB
    stage_row = await db.execute(
        text(f"""
            SELECT
                COUNT(DISTINCT CASE WHEN LOWER(ps.name) = 'screening' THEN cp.candidate_id END) as shortlisted,
                COUNT(DISTINCT CASE WHEN LOWER(ps.name) = 'interview' THEN cp.candidate_id END) as in_interview,
                COUNT(DISTINCT CASE WHEN LOWER(ps.name) = 'offer' THEN cp.candidate_id END) as offers_made,
                COUNT(DISTINCT CASE WHEN LOWER(ps.name) = 'hired' THEN cp.candidate_id END) as hired
            FROM candidate_pipeline cp
            JOIN pipeline_stages ps ON ps.id = cp.stage_id
            LEFT JOIN resume_uploads ru ON ru.candidate_id = cp.candidate_id AND ru.job_id = cp.job_id
            WHERE 1=1 {job_cond} {date_cond}
        """),
        params,
    )
    row = stage_row.fetchone()

    # Conversion rates
    s = row[0] or 0
    i = row[1] or 0
    o = row[2] or 0
    h = row[3] or 0
    ta = total_applicants or 1  # avoid div by zero

    return {
        "open_roles": open_roles,
        "total_applicants": total_applicants,
        "shortlisted": s,
        "in_interview": i,
        "offers_made": o,
        "hired": h,
        "funnel": [
            {"stage": "Applied", "count": total_applicants, "pct": 100},
            {"stage": "Screening", "count": s, "pct": round(s / ta * 100, 1)},
            {"stage": "Interview", "count": i, "pct": round(i / ta * 100, 1)},
            {"stage": "Offer", "count": o, "pct": round(o / ta * 100, 1)},
            {"stage": "Hired", "count": h, "pct": round(h / ta * 100, 1)},
        ],
    }


# ── Per-job breakdown ─────────────────────────────────────────────────────────

@router.get("/jobs-breakdown")
async def get_jobs_breakdown(
    _: RecruiterOrAbove,
    db: AsyncSession = Depends(get_db),
):
    rows = await db.execute(
        text("""
            SELECT
                j.id,
                j.title,
                j.status,
                j.created_at,
                COUNT(DISTINCT ru.candidate_id) FILTER (WHERE ru.candidate_id IS NOT NULL) AS applicants,
                COUNT(DISTINCT cp.candidate_id) FILTER (WHERE LOWER(ps.name) = 'screening') AS screening,
                COUNT(DISTINCT cp.candidate_id) FILTER (WHERE LOWER(ps.name) = 'interview') AS interview,
                COUNT(DISTINCT cp.candidate_id) FILTER (WHERE LOWER(ps.name) = 'offer') AS offer,
                COUNT(DISTINCT cp.candidate_id) FILTER (WHERE LOWER(ps.name) = 'hired') AS hired,
                ROUND(AVG(fs.fit_score)::numeric, 1) AS avg_score
            FROM jobs j
            LEFT JOIN resume_uploads ru ON ru.job_id = j.id
            LEFT JOIN candidate_pipeline cp ON cp.job_id = j.id
            LEFT JOIN pipeline_stages ps ON ps.id = cp.stage_id
            LEFT JOIN fit_scores fs ON fs.job_id = j.id AND fs.is_current = true
            GROUP BY j.id, j.title, j.status, j.created_at
            ORDER BY j.created_at DESC
        """),
    )
    return [
        {
            "job_id": str(r[0]),
            "title": r[1],
            "status": r[2],
            "applicants": r[4] or 0,
            "screening": r[5] or 0,
            "interview": r[6] or 0,
            "offer": r[7] or 0,
            "hired": r[8] or 0,
            "avg_score": float(r[9]) if r[9] else None,
        }
        for r in rows.fetchall()
    ]


# ── 11.2 Time-in-stage ────────────────────────────────────────────────────────

@router.get("/time-in-stage")
async def get_time_in_stage(
    _: RecruiterOrAbove,
    job_id: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    params: dict = {}
    job_cond = "AND psa.job_id = :job_id" if job_id else ""
    if job_id:
        params["job_id"] = job_id

    rows = await db.execute(
        text(f"""
            WITH ordered AS (
                SELECT
                    psa.candidate_id,
                    psa.job_id,
                    psa.to_stage_id,
                    psa.moved_at,
                    LEAD(psa.moved_at) OVER (
                        PARTITION BY psa.candidate_id, psa.job_id
                        ORDER BY psa.moved_at
                    ) AS next_moved_at
                FROM pipeline_stage_audit psa
                WHERE 1=1 {job_cond}
            )
            SELECT
                ps.name AS stage_name,
                ps.order AS stage_order,
                ROUND(AVG(
                    EXTRACT(EPOCH FROM (o.next_moved_at - o.moved_at)) / 86400.0
                )::numeric, 1) AS avg_days
            FROM ordered o
            JOIN pipeline_stages ps ON ps.id = o.to_stage_id
            WHERE o.next_moved_at IS NOT NULL
              AND ps.is_terminal = false
            GROUP BY ps.name, ps.order
            ORDER BY ps.order
        """),
        params,
    )
    return [
        {"stage": r[0], "order": r[1], "avg_days": float(r[2]) if r[2] else 0}
        for r in rows.fetchall()
    ]


# ── 11.3 Score distribution ───────────────────────────────────────────────────

@router.get("/score-distribution")
async def get_score_distribution(
    _: RecruiterOrAbove,
    job_id: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    params: dict = {"is_current": True}
    job_cond = "AND fs.job_id = :job_id" if job_id else ""
    if job_id:
        params["job_id"] = job_id

    rows = await db.execute(
        text(f"""
            SELECT
                FLOOR(fs.fit_score / 10) * 10 AS bucket_start,
                COUNT(*) AS count
            FROM fit_scores fs
            WHERE fs.is_current = :is_current {job_cond}
            GROUP BY bucket_start
            ORDER BY bucket_start
        """),
        params,
    )
    bucket_map = {int(r[0]): int(r[1]) for r in rows.fetchall()}

    # Fill all 10 buckets (0-9, 10-19, ..., 90-100)
    buckets = []
    for start in range(0, 100, 10):
        end = start + 9 if start < 90 else 100
        buckets.append({
            "range": f"{start}–{end}",
            "start": start,
            "count": bucket_map.get(start, 0),
        })

    # Mean score
    mean_row = await db.execute(
        text(f"SELECT ROUND(AVG(fs.fit_score)::numeric, 1) FROM fit_scores fs WHERE fs.is_current = :is_current {job_cond}"),
        params,
    )
    mean_score = mean_row.scalar()

    return {
        "buckets": buckets,
        "mean_score": float(mean_score) if mean_score else None,
        "total": sum(b["count"] for b in buckets),
    }


# ── 11.5 Bias analytics ───────────────────────────────────────────────────────

VARIANCE_THRESHOLD = 15.0  # flag if std dev of group means exceeds this

@router.get("/bias")
async def get_bias_analytics(
    _: RecruiterOrAbove,
    job_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    params: dict = {}
    job_cond = "AND fs.job_id = :job_id" if job_id else ""
    if job_id:
        params["job_id"] = job_id

    # Get fit scores with candidate parsed_data for proxy extraction
    rows = await db.execute(
        text(f"""
            SELECT
                fs.job_id,
                j.title AS job_title,
                fs.fit_score,
                c.parsed_data
            FROM fit_scores fs
            JOIN candidates c ON c.id = fs.candidate_id
            JOIN jobs j ON j.id = fs.job_id
            WHERE fs.is_current = true {job_cond}
        """),
        params,
    )
    records = rows.fetchall()

    # Group by job → by location proxy
    from collections import defaultdict
    import statistics

    job_groups: dict = defaultdict(lambda: {"title": "", "location_groups": defaultdict(list), "edu_groups": defaultdict(list)})

    for r in records:
        jid = str(r[0])
        job_groups[jid]["title"] = r[1]
        pd = r[3] or {}
        score = float(r[2]) if r[2] else None
        if score is None:
            continue

        loc = pd.get("location") or "Unknown"
        # Normalize to city/region only (first part before comma)
        loc = loc.split(",")[0].strip() if loc else "Unknown"
        job_groups[jid]["location_groups"][loc].append(score)

        edu = pd.get("education") or []
        inst = edu[0].get("institution", "Unknown") if edu else "Unknown"
        job_groups[jid]["edu_groups"][inst].append(score)

    flagged_jobs = []
    all_location_data = []
    all_edu_data = []

    for jid, data in job_groups.items():
        is_flagged = False

        # Location analysis
        loc_means = []
        for group, scores in data["location_groups"].items():
            if len(scores) >= 5:  # min 5 candidates per group
                mean = round(statistics.mean(scores), 1)
                loc_means.append(mean)
                all_location_data.append({"job_id": jid, "group": group, "mean_score": mean, "count": len(scores)})

        if len(loc_means) >= 2:
            std = statistics.stdev(loc_means)
            if std > VARIANCE_THRESHOLD:
                is_flagged = True

        # Education analysis
        edu_means = []
        for group, scores in data["edu_groups"].items():
            if len(scores) >= 5:
                mean = round(statistics.mean(scores), 1)
                edu_means.append(mean)
                all_edu_data.append({"job_id": jid, "group": group, "mean_score": mean, "count": len(scores)})

        if len(edu_means) >= 2:
            std = statistics.stdev(edu_means)
            if std > VARIANCE_THRESHOLD:
                is_flagged = True

        if is_flagged:
            flagged_jobs.append({"job_id": jid, "job_title": data["title"]})

    return {
        "flagged_jobs": flagged_jobs,
        "flagged_count": len(flagged_jobs),
        "location_distribution": all_location_data[:50],  # cap for UI
        "education_distribution": all_edu_data[:50],
        "variance_threshold": VARIANCE_THRESHOLD,
        "disclaimer": "Proxy-based analysis is indicative only and does not constitute a legal compliance determination.",
    }


# ── 11.4 Source-of-hire ───────────────────────────────────────────────────────

@router.get("/source-of-hire")
async def get_source_of_hire(
    _: RecruiterOrAbove,
    job_id: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Source-of-hire breakdown:
    - uploaded_by IS NULL  → candidate self-applied via public careers page
    - uploaded_by IS NOT NULL → recruiter/admin uploaded on behalf of candidate
    """
    params: dict = {}
    job_cond = "AND ru.job_id = :job_id" if job_id else ""
    if job_id:
        params["job_id"] = job_id
    date_cond, date_params = _date_conditions(date_from, date_to)
    if date_cond:
        date_cond = "AND " + date_cond
    params.update(date_params)

    rows = await db.execute(
        text(f"""
            SELECT
                CASE WHEN ru.uploaded_by IS NULL THEN 'Careers Page' ELSE 'Recruiter Upload' END AS source,
                COUNT(DISTINCT ru.candidate_id) FILTER (WHERE ru.candidate_id IS NOT NULL) AS applicants,
                COUNT(DISTINCT cp.candidate_id) FILTER (WHERE LOWER(ps.name) = 'hired') AS hired
            FROM resume_uploads ru
            LEFT JOIN candidate_pipeline cp ON cp.candidate_id = ru.candidate_id AND cp.job_id = ru.job_id
            LEFT JOIN pipeline_stages ps ON ps.id = cp.stage_id
            WHERE 1=1 {job_cond} {date_cond}
            GROUP BY source
            ORDER BY applicants DESC
        """),
        params,
    )
    results = rows.fetchall()
    total_applicants = sum(r[1] or 0 for r in results) or 1

    return [
        {
            "source": r[0],
            "applicants": r[1] or 0,
            "hired": r[2] or 0,
            "conversion_rate": round((r[2] or 0) / (r[1] or 1) * 100, 1),
            "pct_of_total": round((r[1] or 0) / total_applicants * 100, 1),
        }
        for r in results
    ]


# ── 11.6 Recruiter activity ───────────────────────────────────────────────────

@router.get("/recruiter-activity")
async def get_recruiter_activity(
    _: RecruiterOrAbove,
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Per-recruiter activity: pipeline moves, shortlist actions, resume uploads."""
    params: dict = {}
    date_cond_psa, dp1 = _date_conditions(date_from, date_to, col="psa.moved_at")
    date_cond_sal, dp2 = _date_conditions(date_from, date_to, col="sal.performed_at")
    date_cond_ru, dp3 = _date_conditions(date_from, date_to, col="ru.uploaded_at")

    # Pipeline moves per user
    moves_rows = await db.execute(
        text(f"""
            SELECT psa.moved_by, COUNT(*) AS moves
            FROM pipeline_stage_audit psa
            WHERE psa.moved_by IS NOT NULL {"AND " + date_cond_psa if date_cond_psa else ""}
            GROUP BY psa.moved_by
        """),
        dp1,
    )
    moves_map = {str(r[0]): int(r[1]) for r in moves_rows.fetchall()}

    # Shortlist actions per user
    actions_rows = await db.execute(
        text(f"""
            SELECT sal.performed_by, COUNT(*) AS actions
            FROM shortlist_audit_log sal
            WHERE sal.performed_by IS NOT NULL {"AND " + date_cond_sal if date_cond_sal else ""}
            GROUP BY sal.performed_by
        """),
        dp2,
    )
    actions_map = {str(r[0]): int(r[1]) for r in actions_rows.fetchall()}

    # Resume uploads per user
    uploads_rows = await db.execute(
        text(f"""
            SELECT ru.uploaded_by, COUNT(*) AS uploads
            FROM resume_uploads ru
            WHERE ru.uploaded_by IS NOT NULL {"AND " + date_cond_ru if date_cond_ru else ""}
            GROUP BY ru.uploaded_by
        """),
        dp3,
    )
    uploads_map = {str(r[0]): int(r[1]) for r in uploads_rows.fetchall()}

    # Collect all user IDs
    all_user_ids = set(moves_map) | set(actions_map) | set(uploads_map)
    if not all_user_ids:
        return []

    # Fetch user details
    users_rows = await db.execute(
        text("SELECT id, full_name, email, role FROM users WHERE id = ANY(:ids)"),
        {"ids": list(all_user_ids)},
    )
    users = {str(r[0]): {"name": r[1], "email": r[2], "role": r[3]} for r in users_rows.fetchall()}

    result = []
    for uid in all_user_ids:
        u = users.get(uid, {"name": "Unknown", "email": "", "role": ""})
        moves = moves_map.get(uid, 0)
        actions = actions_map.get(uid, 0)
        uploads = uploads_map.get(uid, 0)
        result.append({
            "user_id": uid,
            "name": u["name"],
            "email": u["email"],
            "role": u["role"],
            "pipeline_moves": moves,
            "shortlist_actions": actions,
            "resume_uploads": uploads,
            "total_actions": moves + actions + uploads,
        })

    return sorted(result, key=lambda x: x["total_actions"], reverse=True)


# ── 11.7 CSV Export ───────────────────────────────────────────────────────────

@router.get("/export/csv")
async def export_csv(
    _: RecruiterOrAbove,
    job_id: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    # Gather all data
    overview = await get_overview(_, job_id=job_id, date_from=date_from, date_to=date_to, db=db)
    time_in_stage = await get_time_in_stage(_, job_id=job_id, date_from=date_from, date_to=date_to, db=db)
    score_dist = await get_score_distribution(_, job_id=job_id, date_from=date_from, date_to=date_to, db=db)

    output = io.StringIO()
    writer = csv.writer(output)

    # Overview section
    writer.writerow(["Section", "Metric", "Value"])
    for k, v in overview.items():
        writer.writerow(["Overview", k.replace("_", " ").title(), v])
    writer.writerow([])

    # Time in stage
    writer.writerow(["Stage", "Avg Days"])
    for s in time_in_stage:
        writer.writerow([s["stage"], s["avg_days"]])
    writer.writerow([])

    # Score distribution
    writer.writerow(["Score Range", "Candidate Count"])
    for b in score_dist["buckets"]:
        writer.writerow([b["range"], b["count"]])
    writer.writerow(["Mean Score", score_dist["mean_score"] or "N/A"])

    output.seek(0)
    filename = f"analytics-export-{date.today().isoformat()}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ── Advanced: AI Hiring Insights (natural language summary) ──────────────────

@router.get("/insights")
async def get_ai_insights(
    _: RecruiterOrAbove,
    job_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Generate natural language hiring insights from the data."""
    # Gather raw data
    params: dict = {}
    job_cond = "AND fs.job_id = :job_id" if job_id else ""
    if job_id:
        params["job_id"] = job_id

    # Overview stats
    overview_row = await db.execute(
        text(f"""
            SELECT
                COUNT(DISTINCT ru.candidate_id) FILTER (WHERE ru.candidate_id IS NOT NULL) AS total,
                COUNT(DISTINCT cp.candidate_id) FILTER (WHERE LOWER(ps.name) = 'screening') AS screening,
                COUNT(DISTINCT cp.candidate_id) FILTER (WHERE LOWER(ps.name) = 'interview') AS interview,
                COUNT(DISTINCT cp.candidate_id) FILTER (WHERE LOWER(ps.name) = 'hired') AS hired,
                ROUND(AVG(fs.fit_score)::numeric, 1) AS avg_score,
                COUNT(DISTINCT fs.candidate_id) FILTER (WHERE fs.fit_score >= 70) AS high_scorers
            FROM resume_uploads ru
            LEFT JOIN candidate_pipeline cp ON cp.candidate_id = ru.candidate_id AND cp.job_id = ru.job_id
            LEFT JOIN pipeline_stages ps ON ps.id = cp.stage_id
            LEFT JOIN fit_scores fs ON fs.candidate_id = ru.candidate_id
                AND fs.job_id = ru.job_id AND fs.is_current = true
            WHERE ru.candidate_id IS NOT NULL {"AND ru.job_id = :job_id" if job_id else ""}
        """),
        params,
    )
    ov = overview_row.fetchone()
    total = ov[0] or 0
    screening = ov[1] or 0
    interview = ov[2] or 0
    hired = ov[3] or 0
    avg_score = float(ov[4]) if ov[4] else None
    high_scorers = ov[5] or 0

    # Shortlist accuracy
    accuracy_row = await db.execute(
        text(f"""
            SELECT
                COUNT(*) FILTER (WHERE sal.action = 'accepted') AS accepted,
                COUNT(*) FILTER (WHERE sal.action = 'rejected') AS rejected,
                COUNT(*) AS total
            FROM shortlist_audit_log sal
            {"JOIN shortlist_candidates sc ON sc.id = sal.shortlist_candidate_id WHERE sc.job_id = :job_id" if job_id else "WHERE 1=1"}
        """),
        params,
    )
    acc = accuracy_row.fetchone()
    accepted = acc[0] or 0
    total_actions = acc[2] or 0
    accuracy = round(accepted / total_actions * 100, 1) if total_actions > 0 else None

    # Build insights list
    insights = []

    if total == 0:
        return {"insights": [{"type": "info", "message": "No candidates yet. Post a job and start receiving applications to see insights."}]}

    # Funnel drop-off
    if total > 0 and screening == 0:
        insights.append({"type": "warning", "message": f"All {total} applicant{'s' if total > 1 else ''} are still in Applied stage. Consider running AI shortlisting to move candidates forward."})
    elif screening > 0 and interview == 0 and screening >= 3:
        insights.append({"type": "warning", "message": f"{screening} candidates in Screening but none have reached Interview. Review screening criteria or move top scorers forward."})

    # Score insights
    if avg_score is not None:
        if avg_score >= 75:
            insights.append({"type": "success", "message": f"Strong candidate pool — average fit score is {avg_score}/100. {high_scorers} candidate{'s' if high_scorers != 1 else ''} score above 70."})
        elif avg_score >= 55:
            insights.append({"type": "info", "message": f"Moderate candidate quality — average fit score is {avg_score}/100. Consider refining job criteria to attract better matches."})
        else:
            insights.append({"type": "warning", "message": f"Low average fit score ({avg_score}/100). The job description may need clearer requirements, or criteria weights may need adjustment."})

    if high_scorers > 0 and interview == 0:
        insights.append({"type": "action", "message": f"{high_scorers} high-scoring candidate{'s' if high_scorers != 1 else ''} (70+) {'have' if high_scorers > 1 else 'has'} not been moved to Interview yet. Consider advancing them."})

    # Shortlist accuracy
    if accuracy is not None:
        if accuracy >= 70:
            insights.append({"type": "success", "message": f"AI shortlisting accuracy is {accuracy}% — recruiters are accepting most AI recommendations."})
        elif accuracy >= 40:
            insights.append({"type": "info", "message": f"AI shortlisting accuracy is {accuracy}%. Consider providing feedback on rejected candidates to improve future recommendations."})
        else:
            insights.append({"type": "warning", "message": f"Low AI shortlisting acceptance rate ({accuracy}%). The scoring model may need recalibration — try adjusting criteria weights."})

    # Hiring success
    if hired > 0:
        insights.append({"type": "success", "message": f"{hired} candidate{'s' if hired > 1 else ''} successfully hired. Great work!"})
    elif total >= 5 and hired == 0:
        insights.append({"type": "info", "message": f"No hires yet from {total} applicants. The pipeline is active — keep moving candidates forward."})

    if not insights:
        insights.append({"type": "info", "message": "Pipeline is healthy. Keep reviewing candidates and moving them through stages."})

    return {"insights": insights, "stats": {"total": total, "avg_score": avg_score, "accuracy": accuracy}}


# ── Advanced: Candidate quality trend ────────────────────────────────────────

@router.get("/quality-trend")
async def get_quality_trend(
    _: RecruiterOrAbove,
    job_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Weekly avg fit score trend over the last 12 weeks."""
    params: dict = {}
    job_cond = "AND fs.job_id = :job_id" if job_id else ""
    if job_id:
        params["job_id"] = job_id

    rows = await db.execute(
        text(f"""
            SELECT
                DATE_TRUNC('week', ru.uploaded_at) AS week,
                ROUND(AVG(fs.fit_score)::numeric, 1) AS avg_score,
                COUNT(DISTINCT fs.candidate_id) AS count
            FROM fit_scores fs
            JOIN resume_uploads ru ON ru.candidate_id = fs.candidate_id AND ru.job_id = fs.job_id
            WHERE fs.is_current = true
              AND ru.uploaded_at >= NOW() - INTERVAL '12 weeks'
              {job_cond}
            GROUP BY week
            ORDER BY week
        """),
        params,
    )
    return [
        {
            "week": r[0].strftime("%b %d") if r[0] else "",
            "avg_score": float(r[1]) if r[1] else 0,
            "count": int(r[2]),
        }
        for r in rows.fetchall()
    ]


# ── Advanced: Time-to-hire benchmark ─────────────────────────────────────────

@router.get("/time-to-hire")
async def get_time_to_hire(
    _: RecruiterOrAbove,
    db: AsyncSession = Depends(get_db),
):
    """Per-job time from first application to hire (days)."""
    rows = await db.execute(
        text("""
            SELECT
                j.id,
                j.title,
                MIN(ru.uploaded_at) AS first_applied,
                MAX(psa.moved_at) FILTER (WHERE LOWER(ps.name) = 'hired') AS hired_at,
                ROUND(
                    EXTRACT(EPOCH FROM (
                        MAX(psa.moved_at) FILTER (WHERE LOWER(ps.name) = 'hired')
                        - MIN(ru.uploaded_at)
                    )) / 86400.0
                )::int AS days_to_hire,
                COUNT(DISTINCT ru.candidate_id) FILTER (WHERE ru.candidate_id IS NOT NULL) AS applicants
            FROM jobs j
            LEFT JOIN resume_uploads ru ON ru.job_id = j.id
            LEFT JOIN pipeline_stage_audit psa ON psa.job_id = j.id
            LEFT JOIN pipeline_stages ps ON ps.id = psa.to_stage_id
            GROUP BY j.id, j.title
            HAVING COUNT(DISTINCT ru.candidate_id) > 0
            ORDER BY j.created_at DESC
        """),
    )
    results = []
    for r in rows.fetchall():
        days = int(r[4]) if r[4] is not None else None
        status = "green" if days is not None and days <= 30 else "yellow" if days is not None and days <= 60 else "red" if days is not None else "grey"
        results.append({
            "job_id": str(r[0]),
            "title": r[1],
            "days_to_hire": days,
            "applicants": int(r[5]) if r[5] else 0,
            "status": status,
            "label": f"{days}d" if days is not None else "In progress",
        })
    return results


# ── Advanced: Skills gap heatmap ─────────────────────────────────────────────

@router.get("/skills-gap")
async def get_skills_gap(
    _: RecruiterOrAbove,
    job_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """For each required skill, what % of candidates have it."""
    params: dict = {}
    job_cond_criteria = "WHERE jc.job_id = :job_id" if job_id else ""
    job_cond_candidates = "AND ru.job_id = :job_id" if job_id else ""
    if job_id:
        params["job_id"] = job_id

    # Get required criteria
    criteria_rows = await db.execute(
        text(f"SELECT DISTINCT criterion_name, weight FROM job_criteria {job_cond_criteria} ORDER BY criterion_name"),
        params,
    )
    criteria = [(r[0], r[1]) for r in criteria_rows.fetchall()]

    if not criteria:
        return []

    # Get all candidate skills
    cand_rows = await db.execute(
        text(f"""
            SELECT c.parsed_data
            FROM candidates c
            JOIN resume_uploads ru ON ru.candidate_id = c.id
            WHERE c.parsed_data IS NOT NULL {job_cond_candidates}
        """),
        params,
    )
    all_parsed = [r[0] for r in cand_rows.fetchall() if r[0]]
    total_candidates = len(all_parsed)

    if total_candidates == 0:
        return []

    # Count skill matches
    results = []
    for skill_name, weight in criteria:
        skill_lower = skill_name.lower()
        match_count = 0
        for pd in all_parsed:
            skills = pd.get("normalized_skills") or pd.get("skills") or []
            candidate_skills_lower = [s.lower() if isinstance(s, str) else "" for s in skills]
            if any(skill_lower in s or s in skill_lower for s in candidate_skills_lower):
                match_count += 1

        pct = round(match_count / total_candidates * 100)
        results.append({
            "skill": skill_name,
            "weight": weight,
            "candidates_with_skill": match_count,
            "total_candidates": total_candidates,
            "match_pct": pct,
            "gap_pct": 100 - pct,
            "severity": "critical" if pct < 30 else "moderate" if pct < 60 else "good",
        })

    return sorted(results, key=lambda x: x["match_pct"])


# ── Advanced: Shortlist accuracy ─────────────────────────────────────────────

@router.get("/shortlist-accuracy")
async def get_shortlist_accuracy(
    _: RecruiterOrAbove,
    job_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """AI shortlist accuracy — % of shortlisted candidates accepted by recruiters."""
    params: dict = {}
    job_cond = "AND sc.job_id = :job_id" if job_id else ""
    if job_id:
        params["job_id"] = job_id

    rows = await db.execute(
        text(f"""
            SELECT
                j.title,
                COUNT(*) FILTER (WHERE sal.action = 'accepted') AS accepted,
                COUNT(*) FILTER (WHERE sal.action = 'rejected') AS rejected,
                COUNT(*) FILTER (WHERE sal.action = 'deferred') AS deferred,
                COUNT(*) AS total,
                ROUND(AVG(fs.fit_score) FILTER (WHERE sal.action = 'accepted')::numeric, 1) AS avg_accepted_score,
                ROUND(AVG(fs.fit_score) FILTER (WHERE sal.action = 'rejected')::numeric, 1) AS avg_rejected_score
            FROM shortlist_audit_log sal
            JOIN shortlist_candidates sc ON sc.id = sal.shortlist_candidate_id
            JOIN jobs j ON j.id = sc.job_id
            LEFT JOIN fit_scores fs ON fs.candidate_id = sc.candidate_id AND fs.job_id = sc.job_id AND fs.is_current = true
            WHERE 1=1 {job_cond}
            GROUP BY j.id, j.title
            ORDER BY total DESC
        """),
        params,
    )
    results = []
    for r in rows.fetchall():
        total = r[4] or 0
        accepted = r[1] or 0
        accuracy = round(accepted / total * 100, 1) if total > 0 else 0
        results.append({
            "job_title": r[0],
            "accepted": accepted,
            "rejected": r[2] or 0,
            "deferred": r[3] or 0,
            "total": total,
            "accuracy_pct": accuracy,
            "avg_accepted_score": float(r[5]) if r[5] else None,
            "avg_rejected_score": float(r[6]) if r[6] else None,
        })

    overall_accepted = sum(r["accepted"] for r in results)
    overall_total = sum(r["total"] for r in results)
    return {
        "per_job": results,
        "overall_accuracy": round(overall_accepted / overall_total * 100, 1) if overall_total > 0 else None,
        "overall_total": overall_total,
    }
