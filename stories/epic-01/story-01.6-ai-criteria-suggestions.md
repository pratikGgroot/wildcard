# Story 01.6: AI Criteria Suggestions from Historical Jobs

## User Story
**As a** recruiter  
**I want** the system to suggest additional screening criteria based on similar historical job postings  
**So that** I don't miss important requirements that were effective in past roles

## BRD Requirements Covered
- FR-JD-05: AI suggests additional screening criteria based on similar historical job postings

## Acceptance Criteria
1. **Given** I have extracted criteria from a job description  
   **When** the system finds similar historical jobs (similarity ≥ 0.7)  
   **Then** I see a "Suggested Criteria" panel with up to 5 recommendations

2. **Given** a suggestion is shown  
   **When** I view it  
   **Then** I see: criterion name, context ("Used in 3 similar Backend Engineer roles — 80% shortlist success"), and similarity score

3. **Given** I click "Add" on a suggestion  
   **When** it is added  
   **Then** it appears in my criteria list with `ai_extracted = false` and default weight

4. **Given** I click "Dismiss" on a suggestion  
   **When** dismissed  
   **Then** it is removed from the suggestions panel for this session

5. **Given** no similar historical jobs exist (< 5 closed jobs)  
   **When** the system searches  
   **Then** the suggestions panel is hidden (not shown as empty)

## Priority
**P1 — Should Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **Suggestion Latency SLA:** ≤3 seconds (P95)
- **Relevance Threshold:** Only suggest from jobs with embedding similarity ≥ 0.7
- **Ranking:** Sort by: similarity_score × historical_success_rate
- **Privacy:** Never expose candidate-specific data in suggestions
- **Minimum Data:** Require ≥ 5 closed jobs before showing suggestions

### SLA Requirements
- **Suggestion Generation:** ≤3 seconds (P95)
- **Vector Search:** ≤1 second for similarity lookup

## Technical Design

### Similarity Search Query
```sql
-- pgvector cosine similarity search
SELECT j.id, j.title,
  1 - (j.embedding_vector <=> $1::vector) AS similarity
FROM jobs j
WHERE j.status = 'closed'
  AND 1 - (j.embedding_vector <=> $1::vector) >= 0.7
ORDER BY similarity DESC
LIMIT 10;
```

### Suggestion Ranking
```python
rank_score = similarity_score * historical_success_rate
# historical_success_rate = hired_count / total_applicants for that criterion
```

### API Endpoints
```
GET  /api/jobs/:id/criteria-suggestions   — Get suggestions
POST /api/jobs/:id/criteria/from-suggestion — Add suggested criterion
```

## Sub-Tasks
- [ ] 01.6.a — Implement vector similarity search for similar jobs
- [ ] 01.6.b — Implement criteria aggregation and ranking algorithm
- [ ] 01.6.c — Build suggestions panel UI with add/dismiss actions
- [ ] 01.6.d — Track criteria effectiveness for future suggestions

## Testing Strategy
- Unit: Ranking algorithm, similarity threshold filtering
- Integration: Vector search with pgvector
- Performance: ≤3 second SLA with 10K+ historical jobs
- Accuracy: Validate suggestion relevance with recruiter feedback

## Dependencies
- Story 01.2 (JD embedding generation)
- pgvector setup (Epic 14)
- Historical job data with effectiveness tracking
