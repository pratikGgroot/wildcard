# Story 11.5: Bias Analytics Dashboard

## User Story
**As a** compliance officer  
**I want to** see demographic parity metrics across all job pipelines  
**So that** I can monitor for systemic bias at the org level

## BRD Requirements Covered
- FR-DA-05: Bias analytics overview — demographic parity metrics per role

## Acceptance Criteria
1. **Given** I navigate to the Bias Analytics section  
   **When** the page loads  
   **Then** I see a table of all active jobs with their bias risk level (Low/Medium/High) and DIR

2. **Given** I select a job  
   **When** the job-level view loads  
   **Then** I see: total flagged candidates, average score delta, DIR, and a trend chart

3. **Given** a job has DIR < 0.8  
   **When** it is displayed  
   **Then** it is highlighted in red with a "Review Required" badge

4. **Given** I want to see org-level trends  
   **When** I view the org overview  
   **Then** I see a time-series chart of average DIR across all jobs over the past 6 months

## Priority
**P0 — Must Have**

## Estimated Effort
**3 story points**

## NFR / Tech Notes
- **Access:** Compliance officer and HR admin roles only
- **Data Source:** bias_audit_logs (Story 08.5)
- **Refresh:** Daily background job

## Technical Design

### API Endpoints
```
GET /api/analytics/bias/overview        — Org-level bias metrics
GET /api/analytics/bias/jobs/:id        — Job-level bias metrics
GET /api/analytics/bias/trend           — Historical DIR trend
```

## Sub-Tasks
- [ ] 11.5.a — Build bias analytics table with risk levels
- [ ] 11.5.b — Build job-level bias detail view
- [ ] 11.5.c — Build org-level DIR trend chart

## Testing Strategy
- Unit: DIR calculation, risk level display
- RBAC: Verify compliance officer access only

## Dependencies
- Story 08.6 (Fairness metrics — data source)
- Epic 12 (RBAC — access control)
