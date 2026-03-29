"""
Celery tasks for resume processing.
Story 02.2: Real PDF/DOCX text extraction via TextExtractionService.
Story 02.3: OCR fallback for scanned PDFs via OCRService (Tesseract).
Story 02.4: LLM entity extraction via LLMService.
"""
import asyncio
import uuid
import logging
from datetime import datetime
from decimal import Decimal

from celery import shared_task
from sqlalchemy import select

from app.services import celery_app
from app.db.base import SyncSessionLocal
from app.models.candidate import ResumeUpload, Candidate, ParsingError
from app.services.storage_service import download_object
from app.services.text_extraction_service import TextExtractionService
from app.services.ocr_service import OCRService
from app.services.llm_service import LLMService
from app.services.skill_normalizer import SkillNormalizerService
from app.services.duplicate_service import DuplicateDetectionService
from app.services.embedding_service import SyncEmbeddingService
from app.services.fit_score_service import SyncFitScoreService

logger = logging.getLogger(__name__)

_extractor = TextExtractionService()
_ocr = OCRService()
_llm = LLMService()
_normalizer = SkillNormalizerService()
_dedup = DuplicateDetectionService()
_embedder = SyncEmbeddingService()
_fit_scorer = SyncFitScoreService()


def _record_error(db, upload: "ResumeUpload", error_type: str, message: str, stage: str) -> None:
    """Create a ParsingError record for the error queue."""
    try:
        err = ParsingError(
            id=uuid.uuid4(),
            upload_id=upload.id,
            job_id=upload.job_id,
            error_type=error_type,
            error_message=message,
            stage=stage,
            status="pending",
        )
        db.add(err)
        db.flush()
    except Exception as exc:
        logger.error("Failed to record parsing error: %s", exc)


@celery_app.task(
    name="app.tasks.resume_tasks.parse_resume",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def parse_resume(self, upload_id: str) -> dict:
    """
    Async resume parsing pipeline.
    Step 1 (02.2): Download from MinIO → extract text → store in candidate.raw_resume_text.
    Step 2 (02.3): OCR fallback for scanned PDFs (stub).
    Step 3 (02.4): LLM entity extraction (stub).
    """
    try:
        with SyncSessionLocal() as db:
            upload = db.execute(
                select(ResumeUpload).where(ResumeUpload.id == uuid.UUID(upload_id))
            ).scalar_one_or_none()

            if not upload:
                logger.error("Upload not found: %s", upload_id)
                return {"error": "Upload not found", "upload_id": upload_id}

            upload.status = "parsing"
            db.flush()

            # ── Step 1: Download file from MinIO ──────────────────────────────
            try:
                file_bytes = download_object(upload.file_key)
            except Exception as exc:
                logger.exception("Failed to download file %s", upload.file_key)
                upload.status = "failed"
                upload.error_message = f"Failed to download file: {exc}"
                _record_error(db, upload, "download_failed", str(exc), "download")
                db.commit()
                return {"error": str(exc), "upload_id": upload_id}

            # ── Step 2: Extract text ──────────────────────────────────────────
            result = _extractor.extract(
                file_bytes=file_bytes,
                content_type=upload.content_type or "",
                file_name=upload.file_name or "",
            )

            if result.error:
                logger.warning("Extraction error for %s: %s", upload_id, result.error)
                upload.status = "failed"
                upload.error_message = result.error
                _record_error(db, upload, "text_extraction_failed", result.error, "text_extraction")
                db.commit()
                return {"error": result.error, "upload_id": upload_id}

            # ── Step 3: OCR for scanned PDFs (Story 02.3) ────────────────────
            ocr_confidence: float | None = None
            ocr_needs_review = False

            if result.is_scanned:
                logger.info("Scanned PDF detected for %s — running Tesseract OCR", upload_id)
                ocr_result = _ocr.process(file_bytes)

                if ocr_result.error:
                    logger.warning("OCR error for %s: %s", upload_id, ocr_result.error)
                    parsing_errors_pre = [ocr_result.error]
                    ocr_needs_review = True
                    _record_error(db, upload, "ocr_failed", ocr_result.error, "ocr")
                else:
                    result = result.__class__(
                        text=ocr_result.text,
                        is_scanned=True,
                        page_count=ocr_result.page_count or result.page_count,
                        truncated=result.truncated,
                    )
                    ocr_confidence = ocr_result.confidence
                    ocr_needs_review = ocr_result.needs_review
                    if ocr_needs_review:
                        parsing_errors_pre = [
                            f"OCR confidence {ocr_confidence:.0%} — flagged for manual review"
                        ]
                    else:
                        parsing_errors_pre = []
                    logger.info(
                        "OCR complete for %s: chars=%d confidence=%.2f",
                        upload_id, len(result.text), ocr_confidence,
                    )
            else:
                parsing_errors_pre = []

            # ── Step 4: LLM entity extraction (Story 02.4) ───────────────────
            profile = None
            llm_needs_review = False

            if result.text:
                logger.info("Running LLM entity extraction for %s", upload_id)
                try:
                    profile = asyncio.run(_llm.extract_resume_entities(result.text))
                    llm_needs_review = profile.needs_review
                    logger.info(
                        "LLM extraction complete for %s: name=%s email=%s skills=%d",
                        upload_id,
                        profile.full_name,
                        profile.email,
                        len(profile.skills),
                    )
                except Exception as exc:
                    logger.error("LLM extraction failed for %s: %s", upload_id, exc)
                    _record_error(db, upload, "llm_extraction_failed", str(exc), "llm_extraction")

            # ── Step 5: Skill normalization (Story 02.5) ─────────────────────
            normalized_skills: list[str] = []
            normalized_inferred: list[str] = []
            skill_details: list[dict] = []

            if profile:
                all_raw = profile.skills + profile.inferred_skills
                if all_raw:
                    norm_result = _normalizer.normalize_list(all_raw)
                    # Split back into explicit vs inferred
                    explicit_count = len(profile.skills)
                    for i, ns in enumerate(norm_result.normalized):
                        skill_details.append({
                            "raw": ns.raw,
                            "canonical": ns.canonical,
                            "confidence": ns.confidence,
                            "method": ns.method,
                            "type": "explicit" if i < explicit_count else "inferred",
                        })
                    normalized_skills = _normalizer.get_canonical_names(
                        norm_result.normalized[:explicit_count]
                    )
                    normalized_inferred = _normalizer.get_canonical_names(
                        norm_result.normalized[explicit_count:]
                    )
                    logger.info(
                        "Skill normalization complete for %s: %d→%d explicit, %d→%d inferred",
                        upload_id,
                        len(profile.skills), len(normalized_skills),
                        len(profile.inferred_skills), len(normalized_inferred),
                    )

            # ── Step 6: Create / update candidate record ──────────────────────
            parsing_errors: list[str] = list(parsing_errors_pre)
            if result.truncated:
                parsing_errors.append("Resume text was truncated at 50,000 characters")
            if llm_needs_review:
                parsing_errors.append("LLM extraction confidence low — flagged for review")

            # Overall confidence: prefer LLM confidence on name field, else OCR
            overall_confidence: Decimal | None = None
            if profile and profile.confidence:
                name_conf = profile.confidence.get("full_name")
                if name_conf is not None:
                    overall_confidence = Decimal(str(round(name_conf, 3)))
            if overall_confidence is None and ocr_confidence is not None:
                overall_confidence = Decimal(str(round(ocr_confidence, 3)))

            candidate = Candidate(
                id=uuid.uuid4(),
                resume_file_key=upload.file_key,
                raw_resume_text=result.text or None,
                # Populate structured fields from LLM profile, fall back to applicant-provided values
                full_name=(profile.full_name if profile else None) or upload.applicant_name,
                email=(profile.email if profile else None) or upload.applicant_email,
                phone=profile.phone if profile else None,
                location=profile.location if profile else None,
                linkedin_url=profile.linkedin_url if profile else None,
                parsing_confidence=overall_confidence,
                parsing_errors=parsing_errors if parsing_errors else None,
                parsed_data={
                    "page_count": result.page_count,
                    "is_scanned": result.is_scanned,
                    "char_count": len(result.text),
                    "ocr_confidence": ocr_confidence,
                    "ocr_needs_review": ocr_needs_review,
                    "extraction_stage": "llm_parsed" if profile else ("ocr" if result.is_scanned else "text_only"),
                    # LLM-extracted structured data
                    "skills": profile.skills if profile else [],
                    "inferred_skills": profile.inferred_skills if profile else [],
                    "normalized_skills": normalized_skills,
                    "normalized_inferred": normalized_inferred,
                    "skill_details": skill_details,
                    "experience": profile.experience if profile else [],
                    "education": profile.education if profile else [],
                    "certifications": profile.certifications if profile else [],
                    "projects": profile.projects if profile else [],
                    "total_years_experience": profile.total_years_experience if profile else None,
                    "highest_degree": profile.highest_degree if profile else None,
                    "llm_confidence": profile.confidence if profile else {},
                    "llm_needs_review": llm_needs_review,
                },
            )
            db.add(candidate)
            db.flush()

            upload.candidate_id = candidate.id
            upload.status = "completed"
            upload.completed_at = datetime.utcnow()

            # ── Step 7: Duplicate detection (Story 02.6) ──────────────────────
            dedup_result = None
            try:
                dedup_result = _dedup.check_and_handle(db, candidate, upload)
                logger.info(
                    "Dedup check for %s: type=%s match=%s",
                    upload_id, dedup_result.type, dedup_result.match_id,
                )
            except Exception as exc:
                logger.error("Duplicate detection failed for %s: %s", upload_id, exc)

            db.commit()

            # ── Step 8: Generate embedding (Story 04.1) ───────────────────────
            try:
                embed_result = _embedder.embed_candidate_sync(db, candidate)
                db.commit()
                logger.info("Embedding step for %s: %s", upload_id, embed_result.get("status"))
            except Exception as exc:
                logger.error("Embedding failed for %s: %s", upload_id, exc)

            # ── Step 9: Compute fit score against the applied job (Story 04.2) ─
            try:
                score_result = _fit_scorer.score_candidate_sync(db, candidate.id, upload.job_id)
                db.commit()
                logger.info("Fit score step for %s: %s", upload_id, score_result.get("status"))
            except Exception as exc:
                logger.error("Fit scoring failed for %s: %s", upload_id, exc)

            # ── Step 10: Add candidate to pipeline (Epic 09) ──────────────────
            try:
                from sqlalchemy import text as _text
                # Get the first (lowest order) stage for this job
                stage_row = db.execute(
                    _text("""
                        SELECT id FROM pipeline_stages
                        WHERE job_id = :jid
                        ORDER BY "order" ASC LIMIT 1
                    """),
                    {"jid": str(upload.job_id)},
                ).fetchone()

                if not stage_row:
                    # No stages yet — create defaults inline
                    from app.models.pipeline import DEFAULT_STAGES
                    import uuid as _uuid
                    first_stage_id = None
                    for i, s in enumerate(DEFAULT_STAGES):
                        sid = _uuid.uuid4()
                        db.execute(
                            _text("""
                                INSERT INTO pipeline_stages (id, job_id, name, "order", color, is_terminal)
                                VALUES (:id, :jid, :name, :ord, :color, :terminal)
                                ON CONFLICT DO NOTHING
                            """),
                            {"id": str(sid), "jid": str(upload.job_id), "name": s["name"],
                             "ord": s["order"], "color": s.get("color"), "terminal": s.get("is_terminal", False)},
                        )
                        if i == 0:
                            first_stage_id = str(sid)
                    db.flush()
                else:
                    first_stage_id = str(stage_row[0])

                if first_stage_id:
                    db.execute(
                        _text("""
                            INSERT INTO candidate_pipeline (id, candidate_id, job_id, stage_id, moved_at)
                            VALUES (gen_random_uuid(), :cid, :jid, :sid, now())
                            ON CONFLICT (candidate_id, job_id) DO UPDATE
                            SET stage_id = EXCLUDED.stage_id, moved_at = now()
                        """),
                        {"cid": str(candidate.id), "jid": str(upload.job_id), "sid": first_stage_id},
                    )
                    db.commit()
                    logger.info("Added candidate %s to pipeline stage %s for job %s", candidate.id, first_stage_id, upload.job_id)
            except Exception as exc:
                logger.error("Pipeline placement failed for %s: %s", upload_id, exc)

            logger.info(
                "Resume parsed: upload=%s candidate=%s chars=%d scanned=%s",
                upload_id, candidate.id, len(result.text), result.is_scanned,
            )
            return {
                "success": True,
                "upload_id": upload_id,
                "candidate_id": str(candidate.id),
                "char_count": len(result.text),
                "is_scanned": result.is_scanned,
                "page_count": result.page_count,
                "ocr_confidence": ocr_confidence,
                "ocr_needs_review": ocr_needs_review,
                "llm_extracted": profile is not None,
                "full_name": profile.full_name if profile else None,
                "skills_count": len(profile.skills) if profile else 0,
                "dedup_type": dedup_result.type if dedup_result else None,
                "dedup_match_id": str(dedup_result.match_id) if dedup_result and dedup_result.match_id else None,
            }

    except Exception as exc:
        logger.exception("Unexpected error in parse_resume for %s", upload_id)
        raise self.retry(exc=exc)
