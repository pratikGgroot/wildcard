# Story 04.2: Fit Score Calculation

## User Story
**As a** system  
**I want to** calculate a fit score (0–100) for each candidate against a specific job  
**So that** recruiters can quickly rank and compare candidates by relevance

## BRD Requirements Covered
- FR-SC-01: Generate a fit score (0–100) for each candidate against a specific job
- FR-SC-02: Score is derived from semantic similarity between candidate profile embedding and JD embedding
- BRD Section 8.2: Weighted scoring across Technical Skills, Experience, Education, Projects dimensions

## Acceptance Criteria
1. **Given** a candidate has an embedding and a job has a JD embedding  
   **When** the scoring job runs  
   **Then** a fit score between 0 and 100 is computed and stored

2. **Given** the scoring formula uses weighted dimensions  
   **When** the score is computed  
   **Then** it reflects: Technical Skills (40%), Experience Relevance (30%), Education Fit (15%), Projects/Certs (15%) — using job-level configurable weights

3. **Given** a fit score is computed  
   **When** the score is stored  
   **Then** it is versioned with the model name, model version, and JD criteria version

4. **Given** 200 candidates apply to a job  
   **When** batch scoring runs  
   **Then** all scores are computed within 10 minutes (NFR-P-05)

5. **Given** a single candidate is scored  
   **When** the scoring pipeline runs end-to-end  
   **Then** the score is available within 10 seconds (NFR-P-02)

## Priority
**P0 — Must Have**

## Estimated Effort
**8 story points**

## NFR / Tech Notes
- **Scoring Latency:** ≤ 10 seconds end-to-end per candidate (BRD NFR-P-02)
- **Batch Throughput:** ≥ 100 resumes/minute (BRD NFR-P-01)
- **Score Versioning:** Scores are versioned; old scores retained for audit
- **Weights:** Default weights configurable per job (BRD FR-JD-06)

### SLA Requirements
- **Single Score:** ≤ 10 seconds end-to-end (NFR-P-02)
- **Batch (500 resumes):** ≤ 10 minutes (NFR-P-05)

## Technical Design

### Scoring Formula
```python
def compute_fit_score(
    candidate_embeddings: dict,  # {"skills": vec, "experience": vec, "education": vec, "projects": vec}
    jd_embeddings: dict,
    weights: dict  # {"skills": 0.40, "experience": 0.30, "education": 0.15, "projects": 0.15}
) -> tuple[float, dict]:
    breakdown = {}
    weighted_sum = 0.0
    
    for dimension, weight in weights.items():
        sim = cosine_similarity(candidate_embeddings[dimension], jd_embeddings[dimension])
        contribution = weight * sim * 100
        breakdown[dimension] = {
            "raw_similarity": sim,
            "weight": weight,
            "contribution": round(contribution, 2)
        }
        weighted_sum += contribution
    
    fit_score = round(min(max(weighted_sum, 0), 100), 1)
    return fit_score, breakdown
```

### Database Schema
```sql
CREATE TABLE fit_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES candidates(id),
  job_id UUID REFERENCES jobs(id),
  fit_score FLOAT NOT NULL CHECK (fit_score >= 0 AND fit_score <= 100),
  score_breakdown JSONB NOT NULL,
  weights_used JSONB NOT NULL,
  model_name VARCHAR(100),
  model_version VARCHAR(20),
  jd_criteria_version INT,
  computed_at TIMESTAMP DEFAULT NOW(),
  is_current BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_fit_scores_application ON fit_scores(application_id) WHERE is_current = TRUE;
CREATE INDEX idx_fit_scores_job_score ON fit_scores(job_id, fit_score DESC) WHERE is_current = TRUE;
```

### API Endpoints
```
POST /api/applications/:id/score      — Trigger scoring for one application
GET  /api/applications/:id/score      — Get current fit score + breakdown
POST /api/jobs/:id/score-all          — Trigger batch scoring for all applicants
GET  /api/jobs/:id/rankings           — Get ranked candidate list for a job
```

## Sub-Tasks
- [ ] 04.2.a — Implement weighted cosine similarity scoring formula
- [ ] 04.2.b — Implement per-dimension embedding extraction
- [ ] 04.2.c — Implement score versioning and is_current flag management
- [ ] 04.2.d — Implement batch scoring job with queue (SQS/BullMQ)
- [ ] 04.2.e — Write unit tests for scoring formula edge cases
- [ ] 04.2.f — Benchmark batch scoring throughput (target ≥ 100/min)

## Testing Strategy
- Unit: Scoring formula, weight normalization, boundary values (0, 100)
- Integration: Full pipeline from embedding to score storage
- Performance: Batch 500 candidates ≤ 10 minutes

## Dependencies
- Story 04.1 (Embedding generation)
- Epic 01 (Job criteria weights — FR-JD-06)
