# Story 11.6: Recruiter Activity Report

## User Story
**As an** HR admin  
**I want to** see a report of recruiter activity  
**So that** I can understand workload distribution and identify inactive pipelines

## BRD Requirements Covered
- FR-DA-06: Recruiter activity report (actions taken per day/week)

## Acceptance Criteria
1. **Given** I navigate to the Recruiter Activity report  
   **When** the page loads  
   **Then** I see a table of recruiters with: actions taken this week, jobs managed, candidates reviewed, and last active date

2. **Given** I select a recruiter  
   **When** the detail view loads  
   **Then** I see a daily activity chart showing: stage moves, notes added, emails sent, and shortlists reviewed

3. **Given** a recruiter has been inactive for 7+ days on an active job  
   **When** the report is displayed  
   **Then** that job is flagged as "Inactive Pipeline"

4. **Given** I select a date range  
   **When** the report updates  
   **Then** activity data reflects the selected period

## Priority
**P1 — Should Have**

## Estimated Effort
**3 story points**

## NFR / Tech Notes
- **Access:** HR admin only
- **Activity Sources:** Stage moves, notes, emails sent, shortlist actions, chat queries
- **Inactive Threshold:** No recruiter action on active job for 7 days

## Technical Design

### Activity Aggregation
```sql
CREATE MATERIALIZED VIEW recruiter_activity_daily AS
SELECT
  user_id,
  DATE(created_at) AS activity_date,
  COUNT(*) FILTER (WHERE action_type = 'stage_move') AS stage_moves,
  COUNT(*) FILTER (WHERE action_type = 'note_added') AS notes_added,
  COUNT(*) FILTER (WHERE action_type = 'email_sent') AS emails_sent
FROM activity_log
GROUP BY user_id, DATE(created_at);
```

### API Endpoints
```
GET /api/analytics/recruiters/activity          — Recruiter activity summary
GET /api/analytics/recruiters/:id/activity      — Individual recruiter detail
GET /api/analytics/jobs/inactive-pipelines      — Jobs with no recent activity
```

## Sub-Tasks
- [ ] 11.6.a — Implement activity aggregation materialized view
- [ ] 11.6.b — Build recruiter activity table UI
- [ ] 11.6.c — Build individual recruiter activity chart
- [ ] 11.6.d — Implement inactive pipeline detection

## Testing Strategy
- Unit: Inactive threshold logic, activity aggregation
- Integration: Activity report with real action log data

## Dependencies
- Epic 12 (RBAC — admin access)
- Epic 09 (Stage moves — activity source)
