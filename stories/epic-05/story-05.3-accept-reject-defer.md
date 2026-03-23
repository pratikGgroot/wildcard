# Story 05.3: Accept, Reject, or Defer Shortlist Recommendations

## User Story
**As a** recruiter  
**I want to** accept, reject, or defer each shortlist recommendation  
**So that** I can act on the AI's suggestions and move candidates through the pipeline

## BRD Requirements Covered
- FR-SL-03: Recruiter can accept, reject, or defer each shortlist recommendation
- BRD Section 11.3: Human-in-the-loop — all AI recommendations require explicit recruiter action before stage transitions

## Acceptance Criteria
1. **Given** I am viewing the AI Shortlist  
   **When** I click "Accept" on a candidate  
   **Then** the candidate is moved to the "Screened" stage and removed from the shortlist pending queue

2. **Given** I click "Reject" on a candidate  
   **When** I confirm the rejection  
   **Then** the candidate is moved to "Rejected" stage and a rejection email is queued (per Epic 10)

3. **Given** I click "Defer" on a candidate  
   **When** the action is saved  
   **Then** the candidate remains in the shortlist with a "Deferred" badge and a reminder is set for 7 days

4. **Given** I want to act on multiple candidates at once  
   **When** I select multiple candidates and choose a bulk action  
   **Then** all selected candidates are updated simultaneously

5. **Given** I accept a candidate  
   **When** the action is logged  
   **Then** the audit log records: user, action (accept/reject/defer), timestamp, and candidate ID

6. **Given** all shortlist candidates have been actioned  
   **When** the last action is taken  
   **Then** the shortlist is marked "Complete" and the recruiter sees a summary

## Priority
**P0 — Must Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **Human-in-the-Loop:** No automated stage transitions — all require explicit recruiter action (BRD 11.3)
- **Bulk Actions:** Support selecting up to 50 candidates for bulk accept/reject
- **Audit:** Every action logged (BRD FR-BD-05)
- **Keyboard Shortcuts:** A = Accept, R = Reject, D = Defer (BRD Section 12.2 — speed)

## Technical Design

### Action State Machine
```
shortlisted → accepted → [Screened stage]
           → rejected → [Rejected stage]
           → deferred → shortlisted (after reminder)
```

### API Endpoints
```
POST /api/applications/:id/shortlist/accept   — Accept recommendation
POST /api/applications/:id/shortlist/reject   — Reject with optional reason
POST /api/applications/:id/shortlist/defer    — Defer with reminder date
POST /api/jobs/:id/shortlist/bulk-action      — Bulk accept/reject/defer
```

## Sub-Tasks
- [ ] 05.3.a — Build Accept/Reject/Defer action buttons with keyboard shortcuts
- [ ] 05.3.b — Implement stage transition on accept/reject
- [ ] 05.3.c — Implement defer with reminder scheduling
- [ ] 05.3.d — Implement bulk action UI and API
- [ ] 05.3.e — Implement audit logging for all actions

## Testing Strategy
- Unit: State machine transitions, bulk action logic
- Integration: Stage transition on accept, rejection email queue
- UI: Keyboard shortcut functionality

## Dependencies
- Story 05.1 (Generate shortlist)
- Epic 09 (Pipeline stage management — stage transitions)
- Epic 10 (Notifications — rejection email)
