"""Pipeline service — stage config, candidate movement, bulk actions, audit (Epic 09)."""
import uuid
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.pipeline import CandidatePipeline, PipelineStage, PipelineStageAudit, DEFAULT_STAGES
from app.models.candidate import Candidate


class PipelineService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Stage config (09.1) ───────────────────────────────────────────────────

    async def get_stages(self, job_id: uuid.UUID) -> list[PipelineStage]:
        result = await self.db.execute(
            select(PipelineStage)
            .where(PipelineStage.job_id == job_id)
            .order_by(PipelineStage.order)
        )
        return list(result.scalars().all())

    async def init_default_stages(self, job_id: uuid.UUID) -> list[PipelineStage]:
        """Create default stages for a job. Idempotent — skips if stages already exist."""
        existing = await self.get_stages(job_id)
        if existing:
            return existing
        stages = []
        for s in DEFAULT_STAGES:
            stage = PipelineStage(job_id=job_id, **s)
            self.db.add(stage)
            stages.append(stage)
        await self.db.flush()
        return stages

    async def create_stage(
        self, job_id: uuid.UUID, name: str, order: int,
        color: str | None = None, is_terminal: bool = False
    ) -> PipelineStage:
        stage = PipelineStage(
            job_id=job_id, name=name, order=order,
            color=color, is_terminal=is_terminal
        )
        self.db.add(stage)
        await self.db.flush()
        await self.db.refresh(stage)
        return stage

    async def update_stage(
        self, job_id: uuid.UUID, stage_id: uuid.UUID,
        name: str | None = None, order: int | None = None,
        color: str | None = None, is_terminal: bool | None = None
    ) -> PipelineStage:
        stage = await self._get_stage(job_id, stage_id)
        if name is not None:
            stage.name = name
        if order is not None:
            stage.order = order
        if color is not None:
            stage.color = color
        if is_terminal is not None:
            stage.is_terminal = is_terminal
        await self.db.flush()
        return stage

    async def delete_stage(self, job_id: uuid.UUID, stage_id: uuid.UUID) -> None:
        stage = await self._get_stage(job_id, stage_id)
        # Move any candidates in this stage to null
        await self.db.execute(
            select(CandidatePipeline)
            .where(CandidatePipeline.stage_id == stage_id)
        )
        await self.db.execute(
            delete(PipelineStage).where(
                PipelineStage.id == stage_id,
                PipelineStage.job_id == job_id,
            )
        )
        await self.db.flush()

    async def reorder_stages(self, job_id: uuid.UUID, stage_ids: list[uuid.UUID]) -> list[PipelineStage]:
        """Reorder stages by providing the full ordered list of stage IDs."""
        stages = await self.get_stages(job_id)
        stage_map = {s.id: s for s in stages}
        for i, sid in enumerate(stage_ids, start=1):
            if sid in stage_map:
                stage_map[sid].order = i
        await self.db.flush()
        return await self.get_stages(job_id)

    # ── Candidate placement ───────────────────────────────────────────────────

    async def get_pipeline(self, job_id: uuid.UUID) -> list[dict]:
        """Return all candidates in the pipeline for a job, grouped by stage."""
        stages = await self.get_stages(job_id)
        if not stages:
            stages = await self.init_default_stages(job_id)

        placements_result = await self.db.execute(
            select(CandidatePipeline)
            .options(selectinload(CandidatePipeline.stage))
            .where(CandidatePipeline.job_id == job_id)
        )
        placements = placements_result.scalars().all()

        # Fetch candidate details
        candidate_ids = [p.candidate_id for p in placements]
        candidates_map: dict[uuid.UUID, Candidate] = {}
        if candidate_ids:
            cands_result = await self.db.execute(
                select(Candidate).where(Candidate.id.in_(candidate_ids))
            )
            candidates_map = {c.id: c for c in cands_result.scalars().all()}

        stage_map: dict[uuid.UUID | None, list] = {s.id: [] for s in stages}
        stage_map[None] = []  # unassigned

        for p in placements:
            cand = candidates_map.get(p.candidate_id)
            stage_map[p.stage_id].append({
                "placement_id": str(p.id),
                "candidate_id": str(p.candidate_id),
                "full_name": cand.full_name if cand else None,
                "email": cand.email if cand else None,
                "moved_at": p.moved_at.isoformat() if p.moved_at else None,
                "moved_by": str(p.moved_by) if p.moved_by else None,
            })

        return [
            {
                "id": str(s.id),
                "name": s.name,
                "order": s.order,
                "color": s.color,
                "is_terminal": s.is_terminal,
                "candidates": stage_map.get(s.id, []),
            }
            for s in stages
        ]

    async def move_candidate(
        self,
        job_id: uuid.UUID,
        candidate_id: uuid.UUID,
        stage_id: uuid.UUID,
        moved_by: uuid.UUID | None,
        note: str | None = None,
    ) -> CandidatePipeline:
        """Move a candidate to a stage. Creates placement row if first time."""
        # Validate stage belongs to job
        stage = await self._get_stage(job_id, stage_id)

        result = await self.db.execute(
            select(CandidatePipeline).where(
                CandidatePipeline.candidate_id == candidate_id,
                CandidatePipeline.job_id == job_id,
            )
        )
        placement = result.scalar_one_or_none()
        old_stage_id = placement.stage_id if placement else None

        if placement:
            placement.stage_id = stage_id
            placement.moved_by = moved_by
            placement.moved_at = datetime.utcnow()
        else:
            placement = CandidatePipeline(
                candidate_id=candidate_id,
                job_id=job_id,
                stage_id=stage_id,
                moved_by=moved_by,
            )
            self.db.add(placement)

        # Audit log
        self.db.add(PipelineStageAudit(
            candidate_id=candidate_id,
            job_id=job_id,
            from_stage_id=old_stage_id,
            to_stage_id=stage_id,
            moved_by=moved_by,
            note=note,
        ))

        await self.db.flush()
        await self.db.refresh(placement)

        # Notify assigned users about the stage move
        try:
            from app.services.notification_service import notify_pipeline_move
            from app.models.candidate import Candidate
            from sqlalchemy import select as sa_select
            from app.models.job import Job
            cand_row = await self.db.execute(sa_select(Candidate).where(Candidate.id == candidate_id))
            cand = cand_row.scalar_one_or_none()
            job_row = await self.db.execute(sa_select(Job).where(Job.id == job_id))
            job = job_row.scalar_one_or_none()
            if cand and job:
                from app.models.pipeline import PipelineStage as PS
                from_stage_name = None
                if old_stage_id:
                    fs_row = await self.db.execute(sa_select(PS).where(PS.id == old_stage_id))
                    fs = fs_row.scalar_one_or_none()
                    from_stage_name = fs.name if fs else None
                await notify_pipeline_move(
                    self.db, job_id, candidate_id,
                    cand.full_name or "Unknown",
                    job.title,
                    from_stage_name,
                    stage.name,
                )
        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning("Pipeline notification failed: %s", exc)

        return placement

    async def bulk_move(
        self,
        job_id: uuid.UUID,
        candidate_ids: list[uuid.UUID],
        stage_id: uuid.UUID,
        moved_by: uuid.UUID | None,
        note: str | None = None,
    ) -> dict:
        """Move multiple candidates to the same stage (09.4 bulk actions)."""
        await self._get_stage(job_id, stage_id)  # validate
        moved = 0
        errors = 0
        for cid in candidate_ids:
            try:
                await self.move_candidate(job_id, cid, stage_id, moved_by, note)
                moved += 1
            except Exception:
                errors += 1
        return {"moved": moved, "errors": errors, "stage_id": str(stage_id)}

    async def add_candidate_to_pipeline(
        self,
        job_id: uuid.UUID,
        candidate_id: uuid.UUID,
        moved_by: uuid.UUID | None = None,
    ) -> CandidatePipeline:
        """Add a candidate to the first stage of the pipeline (called on resume parse completion)."""
        stages = await self.get_stages(job_id)
        if not stages:
            stages = await self.init_default_stages(job_id)
        first_stage = min(stages, key=lambda s: s.order)
        return await self.move_candidate(job_id, candidate_id, first_stage.id, moved_by)

    # ── Audit log (09.7) ──────────────────────────────────────────────────────

    async def get_audit_log(
        self, job_id: uuid.UUID, candidate_id: uuid.UUID | None = None
    ) -> list[PipelineStageAudit]:
        q = select(PipelineStageAudit).where(PipelineStageAudit.job_id == job_id)
        if candidate_id:
            q = q.where(PipelineStageAudit.candidate_id == candidate_id)
        q = q.order_by(PipelineStageAudit.moved_at.desc())
        result = await self.db.execute(q)
        return list(result.scalars().all())

    # ── Helpers ───────────────────────────────────────────────────────────────

    async def _get_stage(self, job_id: uuid.UUID, stage_id: uuid.UUID) -> PipelineStage:
        result = await self.db.execute(
            select(PipelineStage).where(
                PipelineStage.id == stage_id,
                PipelineStage.job_id == job_id,
            )
        )
        stage = result.scalar_one_or_none()
        if not stage:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stage not found")
        return stage
