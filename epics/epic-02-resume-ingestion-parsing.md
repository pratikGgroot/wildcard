# Epic 02: Resume Ingestion & Parsing

## Overview
Build an AI-powered resume parsing pipeline that converts unstructured resume documents (PDF, DOCX) into structured candidate profiles with high accuracy. This epic enables automated data extraction, skill normalization, and duplicate detection.

## Business Value
- Eliminates 90% of manual data entry for candidate profiles
- Enables instant candidate profile creation from resume uploads
- Provides structured data foundation for AI scoring and matching

## Acceptance Criteria
- System supports bulk resume upload (ZIP, individual PDF/DOCX files)
- AI parses resumes with ≥95% field extraction accuracy
- Extracted data includes: personal info, education, work history, skills, certifications, projects
- System handles unstructured and non-standard resume formats
- Duplicate candidates are automatically detected and flagged
- Parsing errors are flagged for manual correction
- Skills are normalized to canonical forms

## Priority
**CRITICAL** - Core functionality for candidate data ingestion

## Dependencies
- File storage service (S3/GCS)
- LLM API access

## NFR / Tech Notes
- **Performance:** ≥100 resumes/minute batch processing throughput (NFR-P-01)
- **Accuracy:** ≥95% field extraction accuracy (NFR-P-03)
- **Latency:** Single resume parsing ≤10 seconds (NFR-P-02)
- **Bulk Processing:** 500 resumes processed within 10 minutes (NFR-P-05)
- **File Formats:** PDF (native text + OCR for scanned), DOCX, TXT
- **OCR:** AWS Textract or Tesseract for scanned PDFs
- **Storage:** S3/GCS for raw resume files, PostgreSQL for structured data

### SLA Requirements
- **Parsing Throughput:** ≥100 resumes/minute (batch mode)
- **Single Resume Latency:** ≤10 seconds end-to-end
- **Bulk Upload Processing:** 500 resumes in ≤10 minutes
- **Extraction Accuracy:** ≥95% field-level accuracy

## Technical Design

### Parsing Pipeline Architecture
```
Resume Upload (PDF/DOCX)
       ↓
[File Storage: S3/GCS]
       ↓
[Format Detection & Text Extraction]
       ↓
[OCR if Scanned PDF: AWS Textract]
       ↓
[LLM-based Entity Extraction]
       ↓
[Skill Normalization & Validation]
       ↓
[Duplicate Detection]
       ↓
[Store Structured Profile in PostgreSQL]
       ↓
[Generate Embedding Vector]
```

### Data Model
```json
{
  "candidate_profile": {
    "id": "uuid",
    "personal": {
      "name": "string",
      "email": "string (encrypted)",
      "phone": "string (encrypted)",
      "location": "string",
      "linkedin_url": "string"
    },
    "education": [
      {
        "institution": "string",
        "degree": "string",
        "field": "string",
        "start_date": "date",
        "end_date": "date",
        "gpa": "float"
      }
    ],
    "experience": [
      {
        "company": "string",
        "title": "string",
        "start_date": "date",
        "end_date": "date",
        "responsibilities": ["string"],
        "inferred_skills": ["string"]
      }
    ],
    "skills": {
      "explicit": ["string"],
      "inferred": ["string"],
      "normalized": ["string"]
    },
    "certifications": [
      {
        "name": "string",
        "issuer": "string",
        "date": "date"
      }
    ],
    "projects": [
      {
        "name": "string",
        "description": "string",
        "technologies": ["string"]
      }
    ],
    "total_years_experience": "int",
    "highest_degree": "string",
    "raw_resume_text": "text",
    "resume_file_url": "string",
    "parsing_confidence": "float",
    "parsing_errors": ["string"],
    "created_at": "timestamp"
  }
}
```

### Message Queue Architecture
```python
# Use Celery + Redis for async processing
from celery import Celery

app = Celery('resume_parser', broker='redis://localhost:6379/0')

@app.task(bind=True, max_retries=3)
def parse_resume_task(self, resume_file_url: str, candidate_id: str):
    """Async task for parsing a single resume."""
    try:
        # Download file from S3
        file_content = download_from_s3(resume_file_url)
        
        # Extract text
        text = extract_text(file_content)
        
        # Parse with LLM
        profile = parse_with_llm(text)
        
        # Normalize skills
        profile['skills']['normalized'] = normalize_skills(profile['skills'])
        
        # Check for duplicates
        duplicate = check_duplicate(profile)
        
        # Store in database
        save_candidate_profile(candidate_id, profile, duplicate)
        
        return {'success': True, 'candidate_id': candidate_id}
        
    except Exception as e:
        logger.error(f"Resume parsing failed: {e}")
        self.retry(exc=e, countdown=60)
```

## Stories
- [Story 02.1: Resume Upload Interface](stories/epic-02/story-02.1-resume-upload.md)
- [Story 02.2: Text Extraction from PDF/DOCX](stories/epic-02/story-02.2-text-extraction.md)
- [Story 02.3: OCR for Scanned PDFs](stories/epic-02/story-02.3-ocr-scanned-pdfs.md)
- [Story 02.4: LLM-based Entity Extraction](stories/epic-02/story-02.4-llm-entity-extraction.md)
- [Story 02.5: Skill Normalization](stories/epic-02/story-02.5-skill-normalization.md)
- [Story 02.6: Duplicate Detection](stories/epic-02/story-02.6-duplicate-detection.md)
- [Story 02.7: Parsing Error Handling](stories/epic-02/story-02.7-parsing-error-handling.md)
- [Story 02.8: LinkedIn Profile Import](stories/epic-02/story-02.8-linkedin-import.md)

## Estimated Effort
**21-25 story points** (3-4 sprints)

## Success Metrics
- Parsing accuracy ≥95% validated against 1,000 test resumes
- Batch processing throughput ≥100 resumes/minute
- Parsing error rate <5%
- Duplicate detection precision ≥90%
- Skill normalization accuracy ≥85%
