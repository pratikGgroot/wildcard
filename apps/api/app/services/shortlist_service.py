"""
Shortlist Service — Epic 05 (Stories 05.1, 05.2, 05.3, 05.4, 05.5)
Generates ranked shortlists, LLM reasoning, handles accept/reject/defer actions,
near-miss candidates, and recruiter feedback loop.
"""
import json
import logging
import uuid
from datetime import datetime
from typing import Optional

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings

logger = logging.getLogger(__name__)

# ── Confidence level thresholds ───────────────────────────────────────────────
def _confidence_level(score: float) -> str:
    if score >= 80:
        return "High"
    if score >= 60:
        return "Medium"
    return "Low"


# ── Reasoning prompt ──────────────────────────────────────────────────────────
REASONING_PROMPT = """\
You are a senior recruiter reviewing a candidate for a job role.
Given the candidate's fit score breakdown and job requirements, write a concise shortlist reasoning note.

Include:
1. Top 2-3 strengths relevant to this role
2. Main gap or concern (if any)
3. Overall confidence: High / Medium / Low

Be specific and factual. No filler phrases. 2-3 sentences max.

Fit Score: {fit_score}/100
Score Breakdown: {score_breakdown}
Job Criteria: {job_criteria}
Candidate Skills: {candidate_skills}
Candidate Experience: {total_years} years total experience
Highest Degree: {highest_degree}

Return ONLY valid JSON (no markdown):
{{"reasoning": "...", "confidence": "High|Medium|Low"}}
"""


class ShortlistService:

    # ── Story 05.1: Generate shortlist ────────────────────────────────────────

    async def generate_shortlist(
        self,
        db: AsyncSession,
        job_id: uuid.UUID,
        n: Optional[int] = None,
    ) -> dict:
        """
        Generate or refresh the shortlist for a job.
        Uses admin-configured shortlist_threshold (min score) if set,
        otherwise falls back to top 15% or top 20 (whichever is smaller).
        """
        from app.services.settings_service import get_ai_settings
        ai_cfg = await get_ai_settings(db)
        min_score_threshold = ai_cfg.get("shortlist_threshold", 60)

        # Get all current fit scores for this job, ranked desc
        rows = await db.execute(
            text("""
                SELECT
                    fs.candidate_id,
                    COALESCE(CASE WHEN fs.is_overridden THEN fs.override_score END, fs.fit_score) AS effective_score,
                    fs.score_breakdown,
                    c.full_name,
                    c.email,
                    c.parsed_data,
                    fs.technical_score,
                    fs.culture_score,
                    fs.growth_score
                FROM fit_scores fs
                JOIN candidates c ON c.id = fs.candidate_id
                WHERE fs.job_id = :jid AND fs.is_current = true
                ORDER BY effective_score DESC
            """),
            {"jid": str(job_id)},
        )
        all_scores = rows.fetchall()
        total = len(all_scores)

        if total == 0:
            return {
                "status": "error",
                "detail": "No scored candidates found. Run score-all first.",
            }

        # Determine N — respect explicit n, otherwise use score threshold from admin settings
        if n is None:
            # Filter by admin-configured minimum score threshold
            above_threshold = [r for r in all_scores if float(r[1]) >= min_score_threshold]
            if above_threshold:
                n = len(above_threshold)
            else:
                # Fallback: top 15% or top 20
                n = min(20, max(1, int(total * 0.15)))

        shortlisted = all_scores[:n]
        threshold_score = float(shortlisted[-1][1]) if shortlisted else 0.0
        notice = f"Showing all {total} scored candidates" if total <= n else None

        # Upsert shortlist record
        shortlist_id_row = await db.execute(
            text("SELECT id FROM shortlists WHERE job_id = :jid"),
            {"jid": str(job_id)},
        )
        existing = shortlist_id_row.fetchone()

        shortlist_id = uuid.uuid4()
        if existing:
            shortlist_id = existing[0]
            # Delete old candidates
            await db.execute(
                text("DELETE FROM shortlist_candidates WHERE shortlist_id = :sid"),
                {"sid": str(shortlist_id)},
            )
            await db.execute(
                text("""
                    UPDATE shortlists
                    SET status = 'active', threshold_n = :n, threshold_score = :ts,
                        total_candidates = :total, generated_at = now()
                    WHERE id = :sid
                """),
                {"n": n, "ts": threshold_score, "total": total, "sid": str(shortlist_id)},
            )
        else:
            await db.execute(
                text("""
                    INSERT INTO shortlists (id, job_id, status, threshold_n, threshold_score, total_candidates, generated_at)
                    VALUES (:id, :jid, 'active', :n, :ts, :total, now())
                """),
                {"id": str(shortlist_id), "jid": str(job_id), "n": n, "ts": threshold_score, "total": total},
            )

        # Insert shortlist candidates
        candidates_out = []
        for rank, row in enumerate(shortlisted, start=1):
            cand_id, score, breakdown, full_name, email, parsed_data, tech, cult, grow = row
            confidence = _confidence_level(float(score))
            sc_id = uuid.uuid4()
            await db.execute(
                text("""
                    INSERT INTO shortlist_candidates
                        (id, shortlist_id, candidate_id, job_id, rank, fit_score, confidence_level, created_at)
                    VALUES (:id, :sid, :cid, :jid, :rank, :score, :conf, now())
                """),
                {
                    "id": str(sc_id),
                    "sid": str(shortlist_id),
                    "cid": str(cand_id),
                    "jid": str(job_id),
                    "rank": rank,
                    "score": float(score),
                    "conf": confidence,
                },
            )
            pd = parsed_data or {}
            candidates_out.append({
                "id": str(sc_id),
                "candidate_id": str(cand_id),
                "rank": rank,
                "fit_score": float(score),
                "confidence_level": confidence,
                "full_name": full_name,
                "email": email,
                "reasoning": None,
                "action": None,
                "technical_score": tech,
                "culture_score": cult,
                "growth_score": grow,
                "total_years_experience": pd.get("total_years_experience"),
                "top_skills": (pd.get("normalized_skills") or pd.get("skills") or [])[:5],
            })

        await db.commit()

        return {
            "shortlist_id": str(shortlist_id),
            "job_id": str(job_id),
            "status": "active",
            "threshold_n": n,
            "threshold_score": threshold_score,
            "total_candidates_scored": total,
            "shortlisted_count": len(candidates_out),
            "notice": notice,
            "generated_at": datetime.utcnow().isoformat(),
            "candidates": candidates_out,
        }

    async def get_shortlist(self, db: AsyncSession, job_id: uuid.UUID) -> dict:
        """Get the current shortlist for a job."""
        sl_row = await db.execute(
            text("SELECT id, status, threshold_n, threshold_score, total_candidates, generated_at FROM shortlists WHERE job_id = :jid"),
            {"jid": str(job_id)},
        )
        sl = sl_row.fetchone()
        if not sl:
            return {"status": "not_generated", "job_id": str(job_id)}

        shortlist_id, status, threshold_n, threshold_score, total_candidates, generated_at = sl

        # Check if outdated: new scored candidates since generation
        outdated_row = await db.execute(
            text("""
                SELECT COUNT(*) FROM fit_scores fs
                WHERE fs.job_id = :jid AND fs.is_current = true
                  AND fs.computed_at > :gen_at
            """),
            {"jid": str(job_id), "gen_at": generated_at},
        )
        new_count = outdated_row.scalar()
        if new_count and new_count > 0 and status == "active":
            await db.execute(
                text("UPDATE shortlists SET status = 'outdated' WHERE id = :sid"),
                {"sid": str(shortlist_id)},
            )
            await db.commit()
            status = "outdated"

        cand_rows = await db.execute(
            text("""
                SELECT
                    sc.id, sc.candidate_id, sc.rank, sc.fit_score, sc.confidence_level,
                    sc.reasoning, sc.action, sc.action_taken_at, sc.defer_until,
                    sc.rejection_reason,
                    c.full_name, c.email, c.parsed_data,
                    fs.technical_score, fs.culture_score, fs.growth_score
                FROM shortlist_candidates sc
                JOIN candidates c ON c.id = sc.candidate_id
                LEFT JOIN fit_scores fs ON fs.candidate_id = sc.candidate_id
                    AND fs.job_id = :jid AND fs.is_current = true
                WHERE sc.shortlist_id = :sid
                ORDER BY sc.rank ASC
            """),
            {"sid": str(shortlist_id), "jid": str(job_id)},
        )

        candidates = []
        for r in cand_rows.fetchall():
            pd = r[12] or {}
            candidates.append({
                "id": str(r[0]),
                "candidate_id": str(r[1]),
                "rank": r[2],
                "fit_score": r[3],
                "confidence_level": r[4],
                "reasoning": r[5],
                "action": r[6],
                "action_taken_at": r[7].isoformat() if r[7] else None,
                "defer_until": r[8].isoformat() if r[8] else None,
                "rejection_reason": r[9],
                "full_name": r[10],
                "email": r[11],
                "technical_score": r[13],
                "culture_score": r[14],
                "growth_score": r[15],
                "total_years_experience": pd.get("total_years_experience"),
                "top_skills": (pd.get("normalized_skills") or pd.get("skills") or [])[:5],
            })

        return {
            "shortlist_id": str(shortlist_id),
            "job_id": str(job_id),
            "status": status,
            "threshold_n": threshold_n,
            "threshold_score": threshold_score,
            "total_candidates_scored": total_candidates,
            "shortlisted_count": len(candidates),
            "generated_at": generated_at.isoformat() if generated_at else None,
            "candidates": candidates,
        }

    async def update_config(self, db: AsyncSession, job_id: uuid.UUID, n: int) -> dict:
        """Update the N threshold and regenerate."""
        return await self.generate_shortlist(db, job_id, n=n)

    # ── Story 05.2: Reasoning generation ─────────────────────────────────────

    async def generate_reasoning_for_candidate(
        self,
        db: AsyncSession,
        shortlist_candidate_id: uuid.UUID,
        job_id: uuid.UUID,
    ) -> dict:
        """Generate LLM reasoning for a single shortlist candidate."""
        row = await db.execute(
            text("""
                SELECT sc.candidate_id, sc.fit_score, sc.confidence_level,
                       c.parsed_data, fs.score_breakdown
                FROM shortlist_candidates sc
                JOIN candidates c ON c.id = sc.candidate_id
                LEFT JOIN fit_scores fs ON fs.candidate_id = sc.candidate_id
                    AND fs.job_id = :jid AND fs.is_current = true
                WHERE sc.id = :scid
            """),
            {"scid": str(shortlist_candidate_id), "jid": str(job_id)},
        )
        rec = row.fetchone()
        if not rec:
            return {"status": "error", "detail": "Shortlist candidate not found"}

        candidate_id, fit_score, confidence_level, parsed_data, score_breakdown = rec

        # Get job criteria
        criteria_rows = await db.execute(
            text("SELECT criterion_name, criterion_type, weight FROM job_criteria WHERE job_id = :jid"),
            {"jid": str(job_id)},
        )
        criteria = [{"name": r[0], "type": r[1], "weight": r[2]} for r in criteria_rows.fetchall()]

        pd = parsed_data or {}
        skills = (pd.get("normalized_skills") or pd.get("skills") or [])[:15]
        total_years = pd.get("total_years_experience")
        highest_degree = pd.get("highest_degree")

        reasoning, confidence = await self._call_llm_reasoning(
            fit_score=fit_score,
            score_breakdown=score_breakdown,
            criteria=criteria,
            skills=skills,
            total_years=total_years,
            highest_degree=highest_degree,
        )

        # Update the shortlist_candidate record
        await db.execute(
            text("""
                UPDATE shortlist_candidates
                SET reasoning = :reasoning, reasoning_generated_at = now(),
                    confidence_level = :conf
                WHERE id = :scid
            """),
            {"reasoning": reasoning, "conf": confidence, "scid": str(shortlist_candidate_id)},
        )
        await db.commit()

        return {
            "shortlist_candidate_id": str(shortlist_candidate_id),
            "reasoning": reasoning,
            "confidence_level": confidence,
        }

    async def generate_all_reasoning(self, db: AsyncSession, job_id: uuid.UUID) -> dict:
        """Batch generate reasoning for all candidates on the shortlist."""
        sl_row = await db.execute(
            text("SELECT id FROM shortlists WHERE job_id = :jid"),
            {"jid": str(job_id)},
        )
        sl = sl_row.fetchone()
        if not sl:
            return {"status": "error", "detail": "No shortlist found. Generate shortlist first."}

        shortlist_id = sl[0]
        sc_rows = await db.execute(
            text("SELECT id FROM shortlist_candidates WHERE shortlist_id = :sid AND reasoning IS NULL"),
            {"sid": str(shortlist_id)},
        )
        sc_ids = [r[0] for r in sc_rows.fetchall()]

        generated = 0
        errors = 0
        for sc_id in sc_ids:
            result = await self.generate_reasoning_for_candidate(db, sc_id, job_id)
            if result.get("status") == "error":
                errors += 1
            else:
                generated += 1

        return {"status": "ok", "generated": generated, "errors": errors, "job_id": str(job_id)}

    async def _call_llm_reasoning(
        self,
        fit_score: float,
        score_breakdown: dict | None,
        criteria: list[dict],
        skills: list[str],
        total_years: float | None,
        highest_degree: str | None,
    ) -> tuple[str, str]:
        """Call Ollama to generate reasoning. Returns (reasoning_text, confidence_level)."""
        fallback_reasoning = self._fallback_reasoning(fit_score, skills, criteria)
        fallback_confidence = _confidence_level(fit_score)

        if settings.LLM_PROVIDER == "mock":
            return fallback_reasoning, fallback_confidence

        prompt = REASONING_PROMPT.format(
            fit_score=round(fit_score, 1),
            score_breakdown=json.dumps(score_breakdown or {}, indent=None)[:500],
            job_criteria=json.dumps([c["name"] for c in criteria[:10]])[:300],
            candidate_skills=json.dumps(skills[:10])[:200],
            total_years=total_years or "unknown",
            highest_degree=highest_degree or "unknown",
        )

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    f"{settings.OLLAMA_BASE_URL}/api/generate",
                    json={
                        "model": settings.OLLAMA_MODEL,
                        "prompt": prompt,
                        "stream": False,
                        "format": "json",
                        "options": {"temperature": 0.2, "num_predict": 300},
                    },
                )
                resp.raise_for_status()
                raw = resp.json().get("response", "")
                data = json.loads(raw)
                reasoning = data.get("reasoning", "").strip()
                confidence = data.get("confidence", fallback_confidence)
                if confidence not in ("High", "Medium", "Low"):
                    confidence = fallback_confidence
                if not reasoning:
                    return fallback_reasoning, fallback_confidence
                return reasoning, confidence
        except Exception as exc:
            logger.warning("Reasoning LLM call failed: %s — using fallback", exc)
            return fallback_reasoning, fallback_confidence

    def _fallback_reasoning(self, fit_score: float, skills: list[str], criteria: list[dict]) -> str:
        """Template-based fallback when LLM is unavailable."""
        top_skills = ", ".join(skills[:3]) if skills else "N/A"
        skill_criteria = [c["name"] for c in criteria if c.get("type") == "skill"]
        missing = [s for s in skill_criteria if s.lower() not in {sk.lower() for sk in skills}]
        gap = f" Gap: missing {missing[0]}." if missing else ""
        return f"Score: {round(fit_score, 1)}/100. Top skills: {top_skills}.{gap}"

    # ── Story 05.3: Accept / Reject / Defer ───────────────────────────────────

    async def take_action(
        self,
        db: AsyncSession,
        shortlist_candidate_id: uuid.UUID,
        job_id: uuid.UUID,
        action: str,  # accepted | rejected | deferred
        reason: Optional[str] = None,
        performed_by: Optional[uuid.UUID] = None,
    ) -> dict:
        """Accept, reject, or defer a shortlist candidate."""
        if action not in ("accepted", "rejected", "deferred"):
            return {"status": "error", "detail": "action must be accepted, rejected, or deferred"}

        row = await db.execute(
            text("SELECT id, candidate_id FROM shortlist_candidates WHERE id = :scid"),
            {"scid": str(shortlist_candidate_id)},
        )
        rec = row.fetchone()
        if not rec:
            return {"status": "error", "detail": "Shortlist candidate not found"}

        sc_id, candidate_id = rec

        await db.execute(
            text("""
                UPDATE shortlist_candidates
                SET action = :action,
                    action_taken_at = now(),
                    action_taken_by = :by,
                    rejection_reason = :reason,
                    defer_until = NULL
                WHERE id = :scid
            """),
            {
                "action": action,
                "by": str(performed_by) if performed_by else None,
                "reason": reason,
                "scid": str(shortlist_candidate_id),
            },
        )

        # Audit log
        await db.execute(
            text("""
                INSERT INTO shortlist_audit_log
                    (id, shortlist_candidate_id, candidate_id, job_id, action, performed_by, reason, performed_at)
                VALUES (gen_random_uuid(), :scid, :cid, :jid, :action, :by, :reason, now())
            """),
            {
                "scid": str(shortlist_candidate_id),
                "cid": str(candidate_id),
                "jid": str(job_id),
                "action": action,
                "by": str(performed_by) if performed_by else None,
                "reason": reason,
            },
        )

        # Record feedback signal for weight learning (05.4)
        if action in ("accepted", "rejected"):
            fs_row = await db.execute(
                text("SELECT score_breakdown FROM fit_scores WHERE job_id = :jid AND candidate_id = :cid AND is_current = true"),
                {"jid": str(job_id), "cid": str(candidate_id)},
            )
            fs = fs_row.fetchone()
            await self.record_feedback_signal(
                db, job_id, candidate_id, action,
                score_breakdown=fs[0] if fs else None,
            )

        # Check if all candidates have been actioned (accepted or rejected) → mark shortlist complete
        pending_row = await db.execute(
            text("""
                SELECT COUNT(*) FROM shortlist_candidates sc
                JOIN shortlists sl ON sl.id = sc.shortlist_id
                WHERE sl.job_id = :jid AND (sc.action IS NULL OR sc.action = 'deferred')
            """),
            {"jid": str(job_id)},
        )
        pending = pending_row.scalar()
        if pending == 0:
            await db.execute(
                text("UPDATE shortlists SET status = 'complete' WHERE job_id = :jid"),
                {"jid": str(job_id)},
            )

        await db.commit()

        # ── Auto-move in pipeline based on action ─────────────────────────────
        if action in ("accepted", "rejected"):
            try:
                from app.services.pipeline_service import PipelineService
                pipeline_svc = PipelineService(db)
                stages = await pipeline_svc.get_stages(job_id)
                if stages:
                    stage_map = {s.name.lower(): s for s in stages}
                    target_stage = stage_map.get("interview") if action == "accepted" else stage_map.get("rejected")
                    if target_stage:
                        await pipeline_svc.move_candidate(
                            job_id, candidate_id, target_stage.id,
                            performed_by, f"Auto-moved: shortlist {action}"
                        )
                        await db.commit()
            except Exception as exc:
                logger.warning("Pipeline auto-move failed for candidate %s: %s", candidate_id, exc)

        return {
            "status": "ok",
            "shortlist_candidate_id": str(shortlist_candidate_id),
            "candidate_id": str(candidate_id),
            "action": action,
        }

    async def bulk_action(
        self,
        db: AsyncSession,
        job_id: uuid.UUID,
        shortlist_candidate_ids: list[uuid.UUID],
        action: str,
        reason: Optional[str] = None,
        performed_by: Optional[uuid.UUID] = None,
    ) -> dict:
        """Bulk accept/reject/defer multiple shortlist candidates."""
        results = []
        for sc_id in shortlist_candidate_ids:
            result = await self.take_action(db, sc_id, job_id, action, reason, performed_by=performed_by)
            results.append(result)

        succeeded = sum(1 for r in results if r.get("status") == "ok")
        failed = len(results) - succeeded
        return {"status": "ok", "succeeded": succeeded, "failed": failed, "results": results}

    # ── Story 05.5: Near-miss candidates ──────────────────────────────────────

    async def get_near_misses(
        self,
        db: AsyncSession,
        job_id: uuid.UUID,
        window: float = 10.0,
        limit: int = 10,
    ) -> dict:
        """
        Return candidates just below the shortlist threshold.
        Window: candidates within `window` points below threshold_score.
        """
        sl_row = await db.execute(
            text("SELECT threshold_score, threshold_n FROM shortlists WHERE job_id = :jid"),
            {"jid": str(job_id)},
        )
        sl = sl_row.fetchone()
        if not sl:
            return {"status": "no_shortlist", "near_misses": []}

        threshold_score, threshold_n = sl
        lower_bound = float(threshold_score) - window

        # Get shortlisted candidate IDs to exclude them
        sc_rows = await db.execute(
            text("SELECT candidate_id FROM shortlist_candidates sc JOIN shortlists s ON s.id = sc.shortlist_id WHERE s.job_id = :jid"),
            {"jid": str(job_id)},
        )
        shortlisted_ids = {str(r[0]) for r in sc_rows.fetchall()}

        rows = await db.execute(
            text("""
                SELECT
                    fs.candidate_id,
                    COALESCE(CASE WHEN fs.is_overridden THEN fs.override_score END, fs.fit_score) AS effective_score,
                    fs.score_breakdown,
                    c.full_name,
                    c.email,
                    c.parsed_data,
                    fs.technical_score,
                    fs.culture_score,
                    fs.growth_score
                FROM fit_scores fs
                JOIN candidates c ON c.id = fs.candidate_id
                WHERE fs.job_id = :jid
                  AND fs.is_current = true
                  AND COALESCE(CASE WHEN fs.is_overridden THEN fs.override_score END, fs.fit_score)
                      BETWEEN :lower AND :upper
                ORDER BY effective_score DESC
                LIMIT :lim
            """),
            {
                "jid": str(job_id),
                "lower": lower_bound,
                "upper": float(threshold_score) - 0.01,
                "lim": limit,
            },
        )

        near_misses = []
        for r in rows.fetchall():
            cand_id, score, breakdown, full_name, email, parsed_data, tech, cult, grow = r
            if str(cand_id) in shortlisted_ids:
                continue
            pd = parsed_data or {}
            score = float(score)
            gap = round(float(threshold_score) - score, 1)

            # Template-based gap explanation (no LLM needed)
            explanation = self._gap_explanation(gap, breakdown, pd)

            near_misses.append({
                "candidate_id": str(cand_id),
                "fit_score": score,
                "gap_to_threshold": gap,
                "explanation": explanation,
                "full_name": full_name,
                "email": email,
                "technical_score": tech,
                "culture_score": cult,
                "growth_score": grow,
                "total_years_experience": pd.get("total_years_experience"),
                "top_skills": (pd.get("normalized_skills") or pd.get("skills") or [])[:5],
            })

        return {
            "threshold_score": float(threshold_score),
            "threshold_n": threshold_n,
            "window": window,
            "near_misses": near_misses,
        }

    def _gap_explanation(self, gap: float, breakdown: dict | None, parsed_data: dict) -> str:
        """Template-based explanation of why a candidate missed the threshold."""
        parts = []
        if gap:
            parts.append(f"{gap} points below cutoff")
        if breakdown:
            # Find the weakest dimension
            dims = {k: v for k, v in breakdown.items() if isinstance(v, (int, float)) and k != "overall"}
            if dims:
                weakest = min(dims, key=dims.get)
                parts.append(f"weak on {weakest.replace('_', ' ')} ({dims[weakest]:.0f}/100)")
        return ". ".join(parts) + "." if parts else f"{gap} points below cutoff."

    async def promote_near_miss(
        self,
        db: AsyncSession,
        job_id: uuid.UUID,
        candidate_id: uuid.UUID,
    ) -> dict:
        """Promote a near-miss candidate onto the shortlist."""
        # Get shortlist
        sl_row = await db.execute(
            text("SELECT id, threshold_n FROM shortlists WHERE job_id = :jid"),
            {"jid": str(job_id)},
        )
        sl = sl_row.fetchone()
        if not sl:
            return {"status": "error", "detail": "No shortlist found"}
        shortlist_id, threshold_n = sl

        # Check not already on shortlist
        existing = await db.execute(
            text("SELECT id FROM shortlist_candidates WHERE shortlist_id = :sid AND candidate_id = :cid"),
            {"sid": str(shortlist_id), "cid": str(candidate_id)},
        )
        if existing.fetchone():
            return {"status": "error", "detail": "Candidate already on shortlist"}

        # Get candidate score info
        fs_row = await db.execute(
            text("""
                SELECT COALESCE(CASE WHEN is_overridden THEN override_score END, fit_score)
                FROM fit_scores WHERE job_id = :jid AND candidate_id = :cid AND is_current = true
            """),
            {"jid": str(job_id), "cid": str(candidate_id)},
        )
        fs = fs_row.fetchone()
        if not fs:
            return {"status": "error", "detail": "No score found for candidate"}

        score = float(fs[0])

        # Get current max rank
        rank_row = await db.execute(
            text("SELECT COALESCE(MAX(rank), 0) FROM shortlist_candidates WHERE shortlist_id = :sid"),
            {"sid": str(shortlist_id)},
        )
        next_rank = rank_row.scalar() + 1

        sc_id = uuid.uuid4()
        await db.execute(
            text("""
                INSERT INTO shortlist_candidates
                    (id, shortlist_id, candidate_id, job_id, rank, fit_score, confidence_level, created_at)
                VALUES (:id, :sid, :cid, :jid, :rank, :score, :conf, now())
            """),
            {
                "id": str(sc_id),
                "sid": str(shortlist_id),
                "cid": str(candidate_id),
                "jid": str(job_id),
                "rank": next_rank,
                "score": score,
                "conf": _confidence_level(score),
            },
        )

        # Audit log
        await db.execute(
            text("""
                INSERT INTO shortlist_audit_log
                    (id, shortlist_candidate_id, candidate_id, job_id, action, reason, performed_at)
                VALUES (gen_random_uuid(), :scid, :cid, :jid, 'promoted_from_near_miss', 'Manually promoted from near-miss', now())
            """),
            {"scid": str(sc_id), "cid": str(candidate_id), "jid": str(job_id)},
        )

        await db.commit()
        return {"status": "ok", "shortlist_candidate_id": str(sc_id), "rank": next_rank}

    # ── Story 05.4: Feedback loop ─────────────────────────────────────────────

    async def record_feedback_signal(
        self,
        db: AsyncSession,
        job_id: uuid.UUID,
        candidate_id: uuid.UUID,
        action: str,  # accepted | rejected
        score_breakdown: dict | None = None,
    ) -> None:
        """Store a preference signal when a recruiter accepts or rejects a candidate."""
        if action not in ("accepted", "rejected"):
            return
        await db.execute(
            text("""
                INSERT INTO shortlist_feedback
                    (id, job_id, candidate_id, action, score_breakdown, recorded_at)
                VALUES (gen_random_uuid(), :jid, :cid, :action, :breakdown, now())
                ON CONFLICT DO NOTHING
            """),
            {
                "jid": str(job_id),
                "cid": str(candidate_id),
                "action": action,
                "breakdown": json.dumps(score_breakdown) if score_breakdown else None,
            },
        )

    async def get_feedback_stats(self, db: AsyncSession, job_id: uuid.UUID) -> dict:
        """Return signal counts and current learned weights for a job."""
        counts = await db.execute(
            text("""
                SELECT action, COUNT(*) FROM shortlist_feedback
                WHERE job_id = :jid GROUP BY action
            """),
            {"jid": str(job_id)},
        )
        stats = {r[0]: r[1] for r in counts.fetchall()}

        weights_row = await db.execute(
            text("""
                SELECT weights, signal_count, computed_at, is_personalized
                FROM shortlist_learned_weights
                WHERE job_id = :jid AND is_active = true
                ORDER BY computed_at DESC LIMIT 1
            """),
            {"jid": str(job_id)},
        )
        w = weights_row.fetchone()

        return {
            "job_id": str(job_id),
            "accepted_count": stats.get("accepted", 0),
            "rejected_count": stats.get("rejected", 0),
            "total_signals": sum(stats.values()),
            "min_signals_required": 10,
            "learned_weights": w[0] if w else None,
            "signal_count_used": w[1] if w else 0,
            "computed_at": w[2].isoformat() if w and w[2] else None,
            "is_personalized": w[3] if w else False,
        }

    async def optimize_weights(self, db: AsyncSession, job_id: uuid.UUID) -> dict:
        """
        Run weight optimization from feedback signals.
        Uses simple score-weighted averaging (no sklearn dependency).
        Requires at least 10 signals.
        """
        rows = await db.execute(
            text("""
                SELECT action, score_breakdown FROM shortlist_feedback
                WHERE job_id = :jid AND score_breakdown IS NOT NULL
            """),
            {"jid": str(job_id)},
        )
        signals = rows.fetchall()

        if len(signals) < 10:
            return {"status": "insufficient_signals", "count": len(signals), "required": 10}

        DIMENSIONS = ["technical_score", "culture_score", "growth_score"]
        DEFAULT_WEIGHTS = {"technical_score": 0.50, "culture_score": 0.25, "growth_score": 0.25}
        BOUNDS = (0.05, 0.70)

        # Compute weighted average: accepted signals push weights up, rejected push down
        dim_scores_accept = {d: [] for d in DIMENSIONS}
        dim_scores_reject = {d: [] for d in DIMENSIONS}

        for action, breakdown in signals:
            bd = breakdown if isinstance(breakdown, dict) else json.loads(breakdown or "{}")
            target = dim_scores_accept if action == "accepted" else dim_scores_reject
            for d in DIMENSIONS:
                val = bd.get(d)
                if val is not None:
                    target[d].append(float(val))

        new_weights = {}
        for d in DIMENSIONS:
            acc_avg = sum(dim_scores_accept[d]) / len(dim_scores_accept[d]) if dim_scores_accept[d] else 50.0
            rej_avg = sum(dim_scores_reject[d]) / len(dim_scores_reject[d]) if dim_scores_reject[d] else 50.0
            # Higher discriminative power → higher weight
            new_weights[d] = max(0.01, acc_avg - rej_avg + DEFAULT_WEIGHTS[d])

        # Normalize and clip
        total = sum(new_weights.values())
        new_weights = {k: min(BOUNDS[1], max(BOUNDS[0], v / total)) for k, v in new_weights.items()}
        # Re-normalize after clipping
        total2 = sum(new_weights.values())
        new_weights = {k: round(v / total2, 4) for k, v in new_weights.items()}

        # Deactivate old weights
        await db.execute(
            text("UPDATE shortlist_learned_weights SET is_active = false WHERE job_id = :jid"),
            {"jid": str(job_id)},
        )
        await db.execute(
            text("""
                INSERT INTO shortlist_learned_weights
                    (id, job_id, weights, signal_count, computed_at, is_active, is_personalized)
                VALUES (gen_random_uuid(), :jid, :weights, :count, now(), true, true)
            """),
            {"jid": str(job_id), "weights": json.dumps(new_weights), "count": len(signals)},
        )
        await db.commit()

        return {"status": "ok", "weights": new_weights, "signal_count": len(signals)}

    async def reset_weights(self, db: AsyncSession, job_id: uuid.UUID) -> dict:
        """Reset learned weights and clear feedback signals for a job."""
        await db.execute(
            text("UPDATE shortlist_learned_weights SET is_active = false WHERE job_id = :jid"),
            {"jid": str(job_id)},
        )
        await db.execute(
            text("DELETE FROM shortlist_feedback WHERE job_id = :jid"),
            {"jid": str(job_id)},
        )
        await db.commit()
        return {"status": "ok", "message": "Weights reset to defaults, feedback cleared"}
