# Story 02.2: Text Extraction from PDF and DOCX

## User Story
**As a** system  
**I want to** extract raw text from uploaded PDF and DOCX resume files  
**So that** the text can be passed to the LLM parsing pipeline

## BRD Requirements Covered
- FR-RP-02: Parse resumes using AI to extract structured data
- BRD Section 8.1: Must handle PDF (native text + scanned OCR), DOCX, and plain text formats

## Acceptance Criteria
1. **Given** a native-text PDF is uploaded  
   **When** text extraction runs  
   **Then** raw text is extracted preserving structure (sections, bullet points) within 2 seconds

2. **Given** a DOCX file is uploaded  
   **When** text extraction runs  
   **Then** raw text is extracted including all paragraphs, tables, and lists within 2 seconds

3. **Given** a scanned PDF (image-based) is uploaded  
   **When** text extraction detects no native text  
   **Then** OCR pipeline is triggered automatically (see Story 02.3)

4. **Given** a corrupted or password-protected file is uploaded  
   **When** extraction fails  
   **Then** the file is flagged with error "Unable to extract text — file may be corrupted or password-protected"

5. **Given** text extraction succeeds  
   **When** complete  
   **Then** raw text is stored in `candidates.raw_resume_text` and passed to LLM extraction

## Priority
**P0 — Must Have**

## Estimated Effort
**3 story points**

## NFR / Tech Notes
- **Latency:** Text extraction ≤2 seconds per file (native PDF/DOCX)
- **Libraries:** PyMuPDF (fitz) for PDF, python-docx for DOCX
- **Encoding:** Handle UTF-8, Latin-1, and common encodings
- **Max Text Length:** Truncate at 50,000 characters with warning if exceeded

### SLA Requirements
- **Extraction Latency:** ≤2 seconds per file (native text)
- **OCR Fallback Trigger:** Within 500ms of detecting no native text

## Technical Design

### Text Extraction Service
```python
import fitz  # PyMuPDF
from docx import Document

class TextExtractionService:
    def extract(self, file_bytes: bytes, file_type: str) -> dict:
        if file_type == 'pdf':
            return self._extract_pdf(file_bytes)
        elif file_type == 'docx':
            return self._extract_docx(file_bytes)
    
    def _extract_pdf(self, file_bytes: bytes) -> dict:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        text = ""
        for page in doc:
            text += page.get_text()
        
        is_scanned = len(text.strip()) < 100  # Heuristic
        return {
            'text': text,
            'is_scanned': is_scanned,
            'page_count': len(doc)
        }
    
    def _extract_docx(self, file_bytes: bytes) -> dict:
        doc = Document(io.BytesIO(file_bytes))
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        # Also extract table content
        for table in doc.tables:
            for row in table.rows:
                for cell in row.cells:
                    if cell.text.strip():
                        paragraphs.append(cell.text)
        return {'text': '\n'.join(paragraphs), 'is_scanned': False}
```

## Sub-Tasks
- [ ] 02.2.a — Implement PDF text extraction (PyMuPDF)
- [ ] 02.2.b — Implement DOCX text extraction (python-docx)
- [ ] 02.2.c — Implement scanned PDF detection heuristic
- [ ] 02.2.d — Handle encoding edge cases and corrupted files

## Testing Strategy
- Unit: Extract from 20 sample PDFs and DOCXs of varying formats
- Edge cases: Password-protected, corrupted, empty, very large files
- Performance: ≤2 second extraction for files up to 10MB

## Dependencies
- Story 02.1 (File upload)
