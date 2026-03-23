# Story 03.4: Application History

## User Story
**As a** recruiter  
**I want to** see a candidate's full application history across all jobs  
**So that** I can understand their engagement with our company and avoid redundant outreach

## BRD Requirements Covered
- FR-CP-04: Maintain full application history (which jobs applied to, stages reached)

## Acceptance Criteria
1. **Given** a candidate has applied to multiple jobs  
   **When** a recruiter views the candidate profile  
   **Then** they see an "Application History" section listing all jobs applied to, with status and current/final stage

2. **Given** the application history is displayed  
   **When** the recruiter clicks on a past application  
   **Then** they are taken to that application's detail view (score, notes, stage history for that job)

3. **Given** a candidate has stage history for an application  
   **When** the recruiter views that application  
   **Then** they see a timeline of stage transitions with dates and the user who made each move

4. **Given** a candidate was previously rejected for a role  
   **When** the recruiter views the history  
   **Then** the rejection reason (if recorded) is visible

5. **Given** a candidate is currently active in another pipeline  
   **When** a recruiter views the history  
   **Then** an indicator shows "Currently Active" for that application

## Priority
**P0 — Must Have**

## Estimated Effort
**3 story points**

## NFR / Tech Notes
- **Cross-Job Visibility:** Recruiters can see history across all jobs (subject to RBAC — read-only for jobs they don't own)
- **Performance:** History loads within 1 second
- **Data Retention:** History retained per BRD Section 9.2 (2 years after last activity)

## Technical Design

### Database Schema
```sql
CREATE TABLE stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  from_stage VARCHAR(50),
  to_stage VARCHAR(50) NOT NULL,
  moved_by UUID REFERENCES users(id),
  reason TEXT,
  moved_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_stage_history_application ON stage_history(application_id);
CREATE INDEX idx_applications_candidate ON applications(candidate_id);
```

### API Endpoints
```
GET /api/candidates/:id/applications              — All applications for candidate
GET /api/candidates/:id/applications/:appId/history — Stage history for one application
```

## Sub-Tasks
- [ ] 03.4.a — Build ApplicationHistory component with job list and status badges
- [ ] 03.4.b — Build StageTimeline component for per-application history
- [ ] 03.4.c — Implement cross-job read access with RBAC checks

## Testing Strategy
- Unit: RBAC access checks for cross-job history
- Integration: History API with multi-job candidate data

## Dependencies
- Story 03.1 (Candidate profile view)
- Epic 09 (Pipeline stage management — stage_history table)
- Epic 12 (RBAC)
