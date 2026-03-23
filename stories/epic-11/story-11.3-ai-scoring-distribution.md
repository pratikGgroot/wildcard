# Story 11.3: AI Scoring Distribution Chart

## User Story
**As a** recruiter  
**I want to** see the distribution of AI fit scores for a job  
**So that** I can understand the quality of the applicant pool and calibrate my shortlist threshold

## BRD Requirements Covered
- FR-DA-03: AI scoring distribution chart (spread of candidate scores per role)

## Acceptance Criteria
1. **Given** I view the analytics for a job  
   **When** the scoring distribution chart loads  
   **Then** I see a histogram showing the distribution of fit scores (0–100) across all candidates

2. **Given** the histogram is displayed  
   **When** I view it  
   **Then** I can see: the shortlist threshold line, the number of candidates above/below threshold, and the mean/median score

3. **Given** I hover over a histogram bar  
   **When** the tooltip appears  
   **Then** I see the score range and number of candidates in that range

4. **Given** I click a histogram bar  
   **When** I drill down  
   **Then** I see the list of candidates in that score range

5. **Given** the score distribution shows a bimodal pattern  
   **When** it is displayed  
   **Then** no special treatment is needed — the chart simply shows the data accurately

## Priority
**P0 — Must Have**

## Estimated Effort
**3 story points**

## NFR / Tech Notes
- **Bin Size:** 10-point bins (0–9, 10–19, ..., 90–100)
- **Chart Library:** Recharts BarChart
- **Threshold Line:** Vertical reference line at current shortlist threshold

## Technical Design

### Distribution Query
```sql
SELECT
  FLOOR(fit_score / 10) * 10 AS score_bucket,
  COUNT(*) AS candidate_count
FROM fit_scores
WHERE job_id = $1 AND is_current = TRUE
GROUP BY score_bucket
ORDER BY score_bucket;
```

### API Endpoints
```
GET /api/analytics/jobs/:id/score-distribution   — Get score distribution data
```

## Sub-Tasks
- [ ] 11.3.a — Implement score distribution query
- [ ] 11.3.b — Build histogram chart with threshold line
- [ ] 11.3.c — Implement drill-down to candidate list per score bucket

## Testing Strategy
- Unit: Bucket calculation, threshold line positioning
- Integration: Distribution query with real score data

## Dependencies
- Story 04.2 (Fit score calculation — data source)
- Story 05.1 (Shortlist generation — threshold value)
