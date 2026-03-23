# Story 05.1: Generate AI Shortlist

## User Story
**As a** recruiter  
**I want to** receive an AI-generated shortlist of top candidates for a role  
**So that** I can focus my review on the most promising applicants without manually ranking everyone

## BRD Requirements Covered
- FR-SL-01: AI recommends a shortlist of top N candidates (configurable) with reasoning
- BRD Section 8.4: Rank candidates by composite fit score; apply configurable threshold

## Acceptance Criteria
1. **Given** all candidates for a job have been scored  
   **When** the recruiter clicks "Generate Shortlist"  
   **Then** the system returns the top N candidates (default: top 15% or top 20, whichever is smaller) ranked by fit score

2. **Given** a shortlist is generated  
   **When** the recruiter views the AI Shortlist view  
   **Then** each candidate shows: rank, fit score, confidence level (High/Medium/Low), and a one-line reasoning summary

3. **Given** the shortlist is displayed  
   **When** the recruiter wants to adjust the threshold  
   **Then** they can change N (e.g., top 10, top 30) and the shortlist regenerates

4. **Given** fewer candidates than N have been scored  
   **When** shortlist is generated  
   **Then** all scored candidates are included with a notice: "Showing all X scored candidates"

5. **Given** a shortlist has been generated  
   **When** new candidates are added and scored  
   **Then** the shortlist is marked "Outdated" with a "Refresh" button

## Priority
**P0 — Must Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **Default Threshold:** Top 15% of applicants or top 20 candidates (configurable per job)
- **Confidence Levels:** High (score ≥ 80), Medium (60–79), Low (< 60)
- **Shortlist Generation Time:** ≤ 5 seconds (scores already computed)
- **Caching:** Shortlist cached until new candidates are scored or JD changes

## Technical Design

### Shortlist Algorithm
```python
def generate_shortlist(job_id: UUID, n: int = None) -> Shortlist:
    scores = db.get_ranked_scores(job_id)  # sorted desc
    total = len(scores)
    
    if n is None:
        n = min(20, max(1, int(total * 0.15)))
    
    shortlisted = scores[:n]
    return Shortlist(
        job_id=job_id,
        candidates=shortlisted,
        threshold_score=shortlisted[-1].fit_score if shortlisted else 0,
        generated_at=now()
    )
```

### API Endpoints
```
POST /api/jobs/:id/shortlist/generate   — Generate or refresh shortlist
GET  /api/jobs/:id/shortlist            — Get current shortlist
PATCH /api/jobs/:id/shortlist/config    — Update N threshold
```

## Sub-Tasks
- [ ] 05.1.a — Implement shortlist generation algorithm
- [ ] 05.1.b — Build AI Shortlist view UI with ranked candidate cards
- [ ] 05.1.c — Implement configurable N threshold UI
- [ ] 05.1.d — Implement "Outdated" detection and Refresh flow

## Testing Strategy
- Unit: Threshold calculation (15% vs top 20), edge cases (0 candidates, 1 candidate)
- Integration: Shortlist generation with real score data
- UI: Ranked list rendering, confidence badge display

## Dependencies
- Story 04.2 (Fit score calculation)
- Story 05.2 (Reasoning generation — provides reasoning text per candidate)
