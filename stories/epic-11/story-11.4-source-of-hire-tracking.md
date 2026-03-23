# Story 11.4: Source-of-Hire Tracking

## User Story
**As a** recruiter  
**I want to** see where candidates are coming from  
**So that** I can optimize our sourcing strategy and budget

## BRD Requirements Covered
- FR-DA-04: Source-of-hire tracking (job boards, referrals, direct)

## Acceptance Criteria
1. **Given** a candidate applies  
   **When** their application is created  
   **Then** the source is captured: job board name, direct, referral, LinkedIn, or manual upload

2. **Given** I view the analytics dashboard  
   **When** I look at the source-of-hire section  
   **Then** I see a pie/donut chart showing the breakdown of candidates by source

3. **Given** the source chart is displayed  
   **When** I hover over a segment  
   **Then** I see: source name, candidate count, percentage, and shortlist conversion rate from that source

4. **Given** I want to see source quality  
   **When** I view the source table  
   **Then** I see: source, total applicants, shortlisted, hired, and cost-per-hire (if configured)

## Priority
**P1 — Should Have**

## Estimated Effort
**3 story points**

## NFR / Tech Notes
- **Source Capture:** UTM parameters for job board links; manual selection for uploads
- **Sources:** Indeed, LinkedIn, Naukri, Referral, Direct, Manual Upload, LinkedIn Import, Other

## Technical Design

### Source Tracking
```sql
ALTER TABLE applications ADD COLUMN source VARCHAR(50);
ALTER TABLE applications ADD COLUMN source_detail VARCHAR(100);  -- e.g., job board name, referrer name

-- UTM tracking for job board links
ALTER TABLE applications ADD COLUMN utm_source VARCHAR(100);
ALTER TABLE applications ADD COLUMN utm_medium VARCHAR(100);
ALTER TABLE applications ADD COLUMN utm_campaign VARCHAR(100);
```

### API Endpoints
```
GET /api/analytics/jobs/:id/source-of-hire   — Source breakdown for a job
GET /api/analytics/org/source-of-hire        — Org-wide source breakdown
```

## Sub-Tasks
- [ ] 11.4.a — Implement source capture on application creation (UTM + manual)
- [ ] 11.4.b — Build source-of-hire donut chart
- [ ] 11.4.c — Build source quality table with conversion rates

## Testing Strategy
- Unit: UTM parameter parsing, source attribution
- Integration: Source data in analytics query

## Dependencies
- Epic 02 (Resume upload — source captured at upload)
- Epic 15 (Job board webhooks — source from inbound webhooks)
