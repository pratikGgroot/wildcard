# Story 01.2: AI Criteria Extraction from Job Description

## User Story
**As a** recruiter  
**I want the** system to automatically extract screening criteria from my job description using AI  
**So that** I don't have to manually identify and list every requirement

## BRD Requirements Covered
- FR-JD-02: System automatically extracts screening criteria from JD (skills, experience, qualifications) using AI
- BRD Section 8.1: LLM with structured output for entity extraction

## Acceptance Criteria
1. **Given** I have saved a job description (draft or active)  
   **When** I click "Extract Criteria" or save the job for the first time  
   **Then** AI analyzes the description and returns structured criteria within 5 seconds

2. **Given** extraction completes  
   **When** I view the results  
   **Then** criteria are categorized as: Skills, Experience, Education, Certifications — each with name, required/preferred flag, suggested weight (high/medium/low), and confidence score

3. **Given** a criterion has confidence < 0.7  
   **When** displayed  
   **Then** it shows a "Review Needed" badge in amber

4. **Given** the LLM API is unavailable  
   **When** extraction is triggered  
   **Then** the system retries up to 3 times with exponential backoff, then shows an error with option to retry manually

5. **Given** the job description is updated  
   **When** I save the changes  
   **Then** I am prompted: "Job description changed — re-extract criteria?" with Yes/No options

6. **Given** extraction succeeds  
   **When** the job embedding is generated  
   **Then** the embedding is stored in pgvector for downstream scoring

## Priority
**P0 — Must Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **Extraction Latency SLA:** ≤5 seconds (P95) — referenced in NFR-P-02 context
- **Accuracy Target:** ≥90% precision validated against recruiter edits
- **LLM:** Claude Sonnet 4 / GPT-4o with structured JSON output (schema enforcement)
- **Retry:** 3 retries, exponential backoff (1s, 2s, 4s)
- **Caching:** Cache extraction result per (job_id, description_hash); invalidate on description change
- **Embedding:** Generate JD embedding immediately after extraction; store in pgvector
- **Cost Control:** Skip re-extraction if description hash unchanged

### SLA Requirements
- **Extraction Latency:** ≤5 seconds (P95)
- **Embedding Generation:** ≤2 seconds
- **LLM API Availability Fallback:** Allow manual criteria entry if LLM unavailable

## Technical Design

### Extraction Pipeline
```
Job Description Text
       ↓
[Hash check — skip if unchanged]
       ↓
[LLM API: Structured JSON extraction]
       ↓
[Validate JSON schema]
       ↓
[Normalize skill names via ontology]
       ↓
[Store criteria in job_criteria table]
       ↓
[Generate JD embedding → pgvector]
       ↓
[Invalidate downstream score cache]
```

### LLM Prompt
```python
EXTRACTION_PROMPT = """
Analyze this job description and extract structured screening criteria.

Job Description:
{job_description}

Return JSON matching this exact schema:
{
  "skills": [{"name": str, "required": bool, "weight": "high|medium|low", "confidence": float}],
  "experience": [{"description": str, "years_min": int|null, "required": bool, "weight": "high|medium|low", "confidence": float}],
  "education": [{"level": str, "field": str|null, "required": bool, "weight": "high|medium|low", "confidence": float}],
  "certifications": [{"name": str, "required": bool, "weight": "high|medium|low", "confidence": float}]
}

Rules:
- confidence: 0.0–1.0 based on how explicitly stated the requirement is
- required: true only if explicitly stated as "must have", "required", or "essential"
- Normalize skill names to canonical forms (e.g., "React.js" → "React")
- Extract ALL skills mentioned including tools, languages, frameworks, methodologies
"""
```

### Database Schema
```sql
CREATE TABLE job_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  criterion_name VARCHAR(200) NOT NULL,
  criterion_type VARCHAR(50) NOT NULL CHECK (criterion_type IN ('skill','experience','education','certification')),
  weight VARCHAR(20) DEFAULT 'medium' CHECK (weight IN ('high','medium','low')),
  required BOOLEAN DEFAULT false,
  confidence_score DECIMAL(3,2),
  ai_extracted BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_job_criteria_job_id ON job_criteria(job_id);
CREATE INDEX idx_job_criteria_type ON job_criteria(criterion_type);
```

### API Endpoints
```
POST /api/jobs/:id/extract-criteria   — Trigger AI extraction
GET  /api/jobs/:id/criteria           — Get current criteria
```

## Sub-Tasks
- [ ] 01.2.a — Implement LLM extraction service with structured output
- [ ] 01.2.b — Implement description hash-based cache invalidation
- [ ] 01.2.c — Implement retry logic with exponential backoff
- [ ] 01.2.d — Implement JD embedding generation and pgvector storage
- [ ] 01.2.e — Add "re-extract on description change" prompt in UI
- [ ] 01.2.f — Write accuracy tests against 100 labeled JDs

## Testing Strategy
- Unit: Prompt formatting, JSON parsing, confidence scoring
- Integration: Full extraction pipeline with mock LLM
- Accuracy: Validate against 100 manually labeled JDs (≥90% precision)
- Performance: Verify ≤5 second SLA under load
- Fallback: Test behavior when LLM API is down

## Dependencies
- Story 01.1 (Job creation)
- LLM API access (Anthropic/OpenAI)
- pgvector setup (Epic 14)
