# Story 02.4: LLM-Based Entity Extraction

## User Story
**As a** system  
**I want to** use an LLM to extract structured entities from resume text  
**So that** each candidate has a rich, structured profile ready for scoring and display

## BRD Requirements Covered
- FR-RP-02: Parse resumes using AI to extract: name, contact, education, work history, skills, certifications, projects
- FR-RP-03: Handle unstructured / free-text resume formats with ≥ 95% field extraction accuracy
- FR-RP-07: Extract implicit skills (e.g., infer "distributed systems" from listed job titles)
- BRD Section 8.1: Fine-tuned LLM with structured output (JSON schema enforcement) for entity extraction

## Acceptance Criteria
1. **Given** raw resume text is available (from Story 02.2 or 02.3)  
   **When** the LLM extraction job runs  
   **Then** it returns a structured JSON profile matching the canonical schema

2. **Given** the LLM returns a structured profile  
   **When** the profile is validated  
   **Then** all required fields (name, email, experience array, skills) are present or marked as `null` with a confidence score

3. **Given** a resume with implicit skills (e.g., "Led Kubernetes cluster migrations")  
   **When** extraction runs  
   **Then** `inferred_skills` includes "Kubernetes", "DevOps", "Container Orchestration"

4. **Given** the LLM extraction completes  
   **When** field-level confidence scores are computed  
   **Then** any field with confidence < 0.7 is flagged for manual review

5. **Given** the LLM API is unavailable  
   **When** extraction is attempted  
   **Then** the job is retried up to 3 times with exponential backoff; on final failure it is queued for manual review

6. **Given** extraction succeeds  
   **When** the profile is stored  
   **Then** `total_years_experience` and `highest_degree` are computed and stored as top-level fields

## Priority
**P0 — Must Have**

## Estimated Effort
**8 story points**

## NFR / Tech Notes
- **LLM Provider:** Anthropic Claude (claude-sonnet-4) or OpenAI GPT-4o with JSON mode / structured output
- **Schema Enforcement:** Use JSON schema with `response_format: { type: "json_object" }` or tool-calling
- **Parsing Accuracy SLA:** ≥ 95% field extraction accuracy on structured and unstructured resumes (BRD NFR)
- **Latency:** LLM extraction ≤ 8 seconds per resume (P95)
- **Retry Policy:** 3 retries with exponential backoff (1s, 2s, 4s)
- **Caching:** Cache extraction output per (file_hash) to avoid re-processing identical resumes
- **Cost Control:** Use token-efficient prompts; truncate resumes > 8,000 tokens with smart chunking

### SLA Requirements
- **Extraction Latency:** ≤ 8 seconds per resume (P95)
- **Throughput:** ≥ 100 resumes/minute in batch mode (NFR-P-01)

## Technical Design

### Canonical Output Schema
```json
{
  "personal": {
    "name": "string",
    "email": "string",
    "phone": "string",
    "location": "string",
    "linkedin_url": "string"
  },
  "education": [
    {
      "institution": "string",
      "degree": "string",
      "field": "string",
      "start_date": "YYYY-MM",
      "end_date": "YYYY-MM",
      "gpa": "number | null"
    }
  ],
  "experience": [
    {
      "company": "string",
      "title": "string",
      "start_date": "YYYY-MM",
      "end_date": "YYYY-MM | null",
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
    { "name": "string", "issuer": "string", "date": "YYYY-MM" }
  ],
  "projects": [
    { "name": "string", "description": "string", "technologies": ["string"] }
  ],
  "total_years_experience": "number",
  "highest_degree": "string",
  "_confidence": {
    "name": 0.98,
    "email": 0.99,
    "experience": 0.91
  }
}
```

### LLM Prompt Template
```python
EXTRACTION_PROMPT = """
You are a resume parsing assistant. Extract all information from the resume text below 
into the provided JSON schema. 

Rules:
- Use null for missing fields, never guess
- For inferred_skills, extract skills implied by job titles and responsibilities
- Compute total_years_experience from experience dates
- Return confidence scores (0.0–1.0) per top-level field in _confidence

Resume Text:
{resume_text}
"""
```

### Service Architecture
```python
class LLMExtractionService:
    async def extract(self, resume_text: str, file_hash: str) -> ParsedProfile:
        # Check cache
        cached = await self.cache.get(f"extraction:{file_hash}")
        if cached:
            return ParsedProfile(**cached)
        
        # Call LLM with retry
        for attempt in range(3):
            try:
                response = await self.llm_client.complete(
                    prompt=EXTRACTION_PROMPT.format(resume_text=resume_text),
                    response_format={"type": "json_object"},
                    schema=CANDIDATE_SCHEMA
                )
                profile = ParsedProfile(**response.json())
                await self.cache.set(f"extraction:{file_hash}", profile.dict(), ttl=86400)
                return profile
            except Exception as e:
                if attempt == 2:
                    raise ExtractionFailedError(str(e))
                await asyncio.sleep(2 ** attempt)
```

### Database Schema
```sql
CREATE TABLE parsed_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  resume_file_id UUID REFERENCES resume_files(id),
  raw_text TEXT,
  structured_profile JSONB NOT NULL,
  confidence_scores JSONB,
  extraction_model VARCHAR(50),
  extraction_version VARCHAR(20),
  needs_review BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_parsed_profiles_candidate ON parsed_profiles(candidate_id);
CREATE INDEX idx_parsed_profiles_needs_review ON parsed_profiles(needs_review) WHERE needs_review = TRUE;
```

### API Endpoints
```
POST /api/resumes/:id/extract        — Trigger extraction for a resume
GET  /api/resumes/:id/profile        — Get extracted profile
PUT  /api/resumes/:id/profile        — Manual correction of extracted fields
GET  /api/resumes/review-queue       — List resumes flagged for manual review
```

## Sub-Tasks
- [ ] 02.4.a — Define and version canonical JSON schema for candidate profiles
- [ ] 02.4.b — Implement LLM extraction service with retry and backoff
- [ ] 02.4.c — Implement confidence scoring and low-confidence flagging
- [ ] 02.4.d — Implement caching layer (Redis) keyed on file hash
- [ ] 02.4.e — Implement `total_years_experience` and `highest_degree` computation
- [ ] 02.4.f — Write unit tests for schema validation and confidence logic
- [ ] 02.4.g — Benchmark extraction accuracy against 100-resume test set (target ≥ 95%)

## Testing Strategy
- Unit: Schema validation, confidence scoring, retry logic
- Integration: LLM API with real resume samples (structured + unstructured)
- Accuracy: Evaluate against labeled test set; assert ≥ 95% field accuracy
- Performance: Batch 100 resumes; assert ≤ 10 min total (NFR-P-05)

## Dependencies
- Story 02.2 (Text extraction output)
- Story 02.3 (OCR output for scanned PDFs)
- LLM API credentials (Epic 16 — AI model settings)
