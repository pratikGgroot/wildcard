# Story 11.1: Overview Dashboard

## User Story
**As a** recruiter or HR admin  
**I want to** see a high-level overview of all active roles and key hiring metrics  
**So that** I can quickly assess the health of the hiring pipeline

## BRD Requirements Covered
- FR-DA-01: Dashboard showing: open roles, total applicants, shortlisted, in-interview, offers made
- BRD Section 12.1: Dashboard — overview of all active roles, key metrics, recent activity

## Acceptance Criteria
1. **Given** I navigate to the Dashboard  
   **When** the page loads  
   **Then** I see summary cards: Open Roles, Total Applicants, Shortlisted, In Interview, Offers Made

2. **Given** the dashboard is displayed  
   **When** I view the active roles section  
   **Then** I see a list of active jobs with: title, applicant count, shortlisted count, days open, and a link to the pipeline

3. **Given** the dashboard is displayed  
   **When** I view recent activity  
   **Then** I see the last 10 actions taken across all my jobs (new applications, stage moves, shortlists generated)

4. **Given** the dashboard loads  
   **When** data is fetched  
   **Then** the page renders within 2 seconds (P95)

5. **Given** I am an admin  
   **When** I view the dashboard  
   **Then** I see org-wide metrics; recruiters see only their assigned jobs

## Priority
**P0 — Must Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **Page Load:** ≤ 2 seconds (P95) — BRD NFR-P-04
- **Data Freshness:** Metrics updated every 5 minutes via background job; real-time counts via WebSocket
- **RBAC:** Recruiters see their jobs only; admins see all

## Technical Design

### Dashboard Metrics Query
```sql
-- Summary metrics (cached, refreshed every 5 min)
SELECT
  COUNT(*) FILTER (WHERE status = 'active') AS open_roles,
  SUM(applicant_count) AS total_applicants,
  SUM(shortlisted_count) AS shortlisted,
  SUM(interviewing_count) AS in_interview,
  SUM(offer_count) AS offers_made
FROM job_metrics_cache
WHERE recruiter_id = $1 OR $1 IS NULL;  -- NULL = admin (all jobs)
```

### API Endpoints
```
GET /api/dashboard/summary      — Summary metric cards
GET /api/dashboard/active-jobs  — Active jobs list with metrics
GET /api/dashboard/activity     — Recent activity feed
```

## Sub-Tasks
- [ ] 11.1.a — Build summary metric cards UI
- [ ] 11.1.b — Build active jobs list with per-job metrics
- [ ] 11.1.c — Build recent activity feed
- [ ] 11.1.d — Implement metrics cache refresh job
- [ ] 11.1.e — Implement RBAC scoping for recruiter vs admin view

## Testing Strategy
- Unit: RBAC scoping, metric calculation
- Integration: Dashboard API with real job data
- Performance: Page load ≤ 2s with 100 active jobs

## Dependencies
- Epic 09 (Pipeline stages — stage counts)
- Epic 12 (RBAC — view scoping)
