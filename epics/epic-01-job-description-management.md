# Epic 01: Job Description Management

## Overview
Enable recruiters to create, manage, and configure job postings with AI-powered criteria extraction and intelligent suggestions. This epic establishes the foundation for all downstream candidate matching and scoring.

## Business Value
- Reduces time to create job postings by 50%
- Ensures consistent screening criteria across roles
- Enables accurate AI-driven candidate matching

## Acceptance Criteria
- Recruiters can create job postings with free-text descriptions
- AI automatically extracts screening criteria from job descriptions
- Recruiters can review, edit, and approve AI-extracted criteria
- Job postings support configurable criteria weights
- Jobs can be assigned to specific recruiters and hiring managers
- Job status lifecycle (active/paused/closed) is fully supported

## Priority
**CRITICAL** - Foundation for all candidate matching functionality

## Dependencies
- None (foundational epic)

## NFR / Tech Notes
- **Performance:** JD criteria extraction must complete within 5 seconds (NFR-P-02)
- **Scalability:** System must support up to 10,000 active job postings (NFR 7.2)
- **AI Model:** Use Claude Sonnet 4 or GPT-4o with structured output for criteria extraction
- **Data Storage:** PostgreSQL for relational job data, embeddings in pgvector

## Technical Design

### Architecture Components
```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   React UI  │─────▶│  Job Service │─────▶│  LLM Agent  │
│  (Next.js)  │      │   (FastAPI)  │      │  (Claude)   │
└─────────────┘      └──────┬───────┘      └─────────────┘
                            │
                     ┌──────▼───────┐
                     │  PostgreSQL  │
                     │  + pgvector  │
                     └──────────────┘
```

### Data Model
```json
{
  "job": {
    "id": "uuid",
    "title": "string",
    "department": "string",
    "location": "string",
    "type": "enum[full-time, contract, internship]",
    "description": "text",
    "extracted_criteria": [
      {
        "criterion": "string",
        "type": "enum[skill, experience, education, certification]",
        "weight": "enum[high, medium, low]",
        "required": "boolean"
      }
    ],
    "embedding_vector": "float[]",
    "status": "enum[draft, active, paused, closed]",
    "assigned_recruiter_ids": "uuid[]",
    "hiring_manager_id": "uuid",
    "created_at": "timestamp",
    "updated_at": "timestamp"
  }
}
```

### AI Integration
- **Criteria Extraction Prompt:**
  ```
  Extract screening criteria from this job description.
  Return structured JSON with: skills (required/preferred), 
  experience requirements, education requirements, certifications.
  For each criterion, suggest a weight (high/medium/low).
  ```
- **Embedding Generation:** Use text-embedding-3-large to create JD embeddings for semantic matching
- **Caching:** Cache extracted criteria and embeddings; invalidate on JD text changes

### API Endpoints
- `POST /api/jobs` - Create job posting
- `GET /api/jobs/:id` - Get job details
- `PUT /api/jobs/:id` - Update job posting
- `POST /api/jobs/:id/extract-criteria` - Trigger AI criteria extraction
- `PUT /api/jobs/:id/criteria` - Update criteria and weights
- `PATCH /api/jobs/:id/status` - Change job status
- `GET /api/jobs` - List jobs with filters

## Stories
- [Story 01.1: Create Job Posting](stories/epic-01/story-01.1-create-job-posting.md)
- [Story 01.2: AI Criteria Extraction](stories/epic-01/story-01.2-ai-criteria-extraction.md)
- [Story 01.3: Review and Edit Criteria](stories/epic-01/story-01.3-review-edit-criteria.md)
- [Story 01.4: Configure Criteria Weights](stories/epic-01/story-01.4-configure-criteria-weights.md)
- [Story 01.5: Job Assignment and Status](stories/epic-01/story-01.5-job-assignment-status.md)
- [Story 01.6: Job Templates](stories/epic-01/story-01.6-job-templates.md)
- [Story 01.7: AI Criteria Suggestions](stories/epic-01/story-01.7-ai-criteria-suggestions.md)

## Estimated Effort
**16-20 story points** (2-3 sprints)

## Success Metrics
- 95% of job postings have AI-extracted criteria approved with minimal edits
- Average time to create job posting reduced from 30 minutes to 10 minutes
- Criteria extraction accuracy ≥ 90% (validated against recruiter edits)
