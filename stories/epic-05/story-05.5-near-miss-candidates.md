# Story 05.5: Near-Miss Candidates

## User Story
**As a** recruiter  
**I want to** see candidates who narrowly missed the shortlist threshold  
**So that** I don't overlook strong candidates who were just below the cutoff

## BRD Requirements Covered
- FR-SL-05: Show "near miss" candidates who narrowly missed shortlist threshold
- BRD Section 8.4: Near-miss candidates (just below threshold) flagged with explanation

## Acceptance Criteria
1. **Given** a shortlist has been generated  
   **When** the recruiter views the AI Shortlist view  
   **Then** a "Near Misses" section shows candidates within 10 points below the shortlist threshold

2. **Given** near-miss candidates are displayed  
   **When** the recruiter views a near-miss card  
   **Then** they see: score, gap to threshold (e.g., "3 points below cutoff"), and a brief explanation of what's missing

3. **Given** a near-miss candidate is displayed  
   **When** the recruiter clicks "Add to Shortlist"  
   **Then** the candidate is added to the shortlist and the action is logged

4. **Given** the shortlist threshold is changed  
   **When** the threshold updates  
   **Then** the near-miss section recalculates automatically

5. **Given** there are no near-miss candidates  
   **When** the shortlist view loads  
   **Then** the near-miss section is hidden (not shown as empty)

## Priority
**P1 — Should Have**

## Estimated Effort
**3 story points**

## NFR / Tech Notes
- **Near-Miss Window:** Candidates within 10 points below the threshold score (configurable)
- **Max Near Misses Shown:** 10 candidates
- **Explanation:** Template-based (no LLM call needed): "Missing: {gap_skills}. Score gap: {delta} points."

## Technical Design

### Near-Miss Query
```python
def get_near_misses(job_id: UUID, threshold_score: float, window: float = 10.0) -> list:
    return db.query(
        "SELECT * FROM fit_scores WHERE job_id = %s AND is_current = TRUE "
        "AND fit_score BETWEEN %s AND %s ORDER BY fit_score DESC LIMIT 10",
        (job_id, threshold_score - window, threshold_score - 0.01)
    )
```

### API Endpoints
```
GET  /api/jobs/:id/shortlist/near-misses          — Get near-miss candidates
POST /api/applications/:id/shortlist/add-from-near-miss — Promote to shortlist
```

## Sub-Tasks
- [ ] 05.5.a — Implement near-miss query with configurable window
- [ ] 05.5.b — Build near-miss section UI with gap explanation
- [ ] 05.5.c — Implement "Add to Shortlist" promotion action

## Testing Strategy
- Unit: Near-miss window calculation, edge cases (no near misses, all near misses)
- Integration: Near-miss API with real score data

## Dependencies
- Story 05.1 (Generate shortlist — provides threshold score)
- Story 04.2 (Fit score calculation)
