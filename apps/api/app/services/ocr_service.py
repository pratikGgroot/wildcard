"""
Story 02.3: OCR for scanned PDF resumes.
Uses Tesseract (via pytesseract + pdf2image) as the free/open-source OCR engine.
AWS Textract is referenced in the story spec but we use Tesseract to stay fully free.
"""
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)

OCR_CONFIDENCE_THRESHOLD = 0.6
OCR_TIMEOUT_SECONDS = 30


@dataclass
class OCRResult:
    text: str
    confidence: float          # 0.0–1.0 estimated from Tesseract word confidences
    page_count: int
    needs_review: bool         # True when confidence < threshold or error occurred
    error: str | None = None


class OCRService:
    """
    Converts scanned PDF pages to images and runs Tesseract OCR.
    Returns extracted text with a confidence estimate.
    """

    def process(self, file_bytes: bytes) -> OCRResult:
        """
        Run OCR on a scanned PDF.
        Returns OCRResult with text, confidence, and review flag.
        """
        try:
            return self._tesseract_ocr(file_bytes)
        except Exception as exc:
            logger.exception("OCR failed")
            return OCRResult(
                text="",
                confidence=0.0,
                page_count=0,
                needs_review=True,
                error=f"OCR failed: {exc}",
            )

    def _tesseract_ocr(self, file_bytes: bytes) -> OCRResult:
        import pytesseract
        from pdf2image import convert_from_bytes
        from pdf2image.exceptions import PDFPageCountError

        try:
            images = convert_from_bytes(file_bytes, dpi=300, timeout=OCR_TIMEOUT_SECONDS)
        except PDFPageCountError as exc:
            raise RuntimeError(f"Cannot read PDF for OCR: {exc}") from exc
        except Exception as exc:
            # pdf2image raises a generic Exception on timeout
            if "timeout" in str(exc).lower():
                return OCRResult(
                    text="",
                    confidence=0.0,
                    page_count=0,
                    needs_review=True,
                    error="OCR timeout — manual review required",
                )
            raise

        page_texts: list[str] = []
        all_confidences: list[float] = []

        for image in images:
            # Get per-word confidence data
            data = pytesseract.image_to_data(
                image,
                output_type=pytesseract.Output.DICT,
                config="--psm 1",  # automatic page segmentation
            )
            page_text = pytesseract.image_to_string(image, config="--psm 1")
            page_texts.append(page_text.strip())

            # Collect word-level confidences (Tesseract returns -1 for non-word blocks)
            word_confs = [
                c / 100.0
                for c in data["conf"]
                if isinstance(c, (int, float)) and c >= 0
            ]
            if word_confs:
                all_confidences.extend(word_confs)

        full_text = "\n".join(t for t in page_texts if t).strip()
        avg_confidence = (
            sum(all_confidences) / len(all_confidences) if all_confidences else 0.0
        )

        needs_review = avg_confidence < OCR_CONFIDENCE_THRESHOLD

        if needs_review:
            logger.warning(
                "OCR confidence %.2f below threshold %.2f — flagging for review",
                avg_confidence,
                OCR_CONFIDENCE_THRESHOLD,
            )

        logger.info(
            "OCR complete: pages=%d chars=%d confidence=%.2f",
            len(images),
            len(full_text),
            avg_confidence,
        )

        return OCRResult(
            text=full_text,
            confidence=avg_confidence,
            page_count=len(images),
            needs_review=needs_review,
        )
