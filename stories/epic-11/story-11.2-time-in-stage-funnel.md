# Story 11.2: Time-in-Stage Funnel Chart

## User Story
**As a** recruiter  
**I want to** see how long candidates spend in each pipeline stage  
**So that** I can identify bottlenecks in the hiring process

## BRD Requirements Covered
- FR-DA-02: Time-in-stage funnel chart per role

## Acceptance Criteria
1. **Given** I select a job on the analytics page  
   **When** the funnel chart loads  
   **Then** I see a funnel visualization showing: stage name, candidate count, and average days in stage

2. **Given** the funnel is displayed  
   **When** I hover over a stage  
   **Then** I see: average days, median days, min/max days, and number of candidates who exited at this stage

3. **Given** a stage has an unusually high average time  
   **When** it is displayed  
   **Then** it is highlighted in amber/red to indicate a potential bottleneck

4. **Given** I want to compare across time periods  
   **When** I select a date range  
   **Then** the funnel updates to show data for that period

5. **Given** I want to drill down  
   **When** I click a stage in the funnel  
   **Then** I see a list of candidates currently in that stage with their days-in-stage

## Priority
**P0 — Must Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **Bottleneck Threshold:** Average days > 2x the org median for that stage = highlighted
- **Chart Library:** Recharts or Nivo funnel chart
- **Data Source:** Computed from stage_history timestamps
- **Performance:** Chart data query ≤ 1 second

## Technical Design

### Funnel Data Query
```sql
SELECT
  to_stage AS stage,
  COUNT(*) AS candidate_count,
  AVG(EXTRACT(EPOCH FROM (next_move_at - moved_at)) / 86400) AS avg_days,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (next_move_at - moved_at)) / 86400) AS median_days
FROM stage_history
WHERE job_id = $1
  AND moved_at BETWEEN $2 AND $3
GROUP BY to_stage
ORDER BY MIN(display_order);
```

### API Endpoints
```
GET /api/analytics/jobs/:id/funnel   — Get funnel data (filter: date range)
GET /api/analytics/jobs/:id/funnel/:stage/candidates — Candidates in stage
```

## Sub-Tasks
- [ ] 11.2.a — Implement funnel data query with time calculations
- [ ] 11.2.b — Build funnel chart component with hover tooltips
- [ ] 11.2.c — Implement bottleneck highlighting logic
- [ ] 11.2.d — Implement drill-down to candidate list per stage

## Testing Strategy
- Unit: Average/median calculation, bottleneck threshold
- Integration: Funnel query with real stage history data
- Visual: Funnel chart renders correctly with varied data

## Dependencies
- Story 09.7 (Stage transition audit — data source)
