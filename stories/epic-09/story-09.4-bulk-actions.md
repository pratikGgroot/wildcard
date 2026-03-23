# Story 09.4: Bulk Actions

## User Story
**As a** recruiter  
**I want to** perform actions on multiple candidates at once  
**So that** I can process large batches of applicants efficiently

## BRD Requirements Covered
- FR-PL-03: Bulk actions: move, reject, email candidates

## Acceptance Criteria
1. **Given** I am on the kanban board or candidate list  
   **When** I select multiple candidates using checkboxes  
   **Then** a bulk action toolbar appears at the bottom of the screen

2. **Given** the bulk action toolbar is visible  
   **When** I click "Move to Stage"  
   **Then** I can select a target stage and all selected candidates are moved

3. **Given** I select "Bulk Reject"  
   **When** I confirm  
   **Then** all selected candidates are moved to Rejected and rejection emails are queued

4. **Given** I select "Send Email"  
   **When** I choose a template  
   **Then** emails are queued for all selected candidates

5. **Given** I select all candidates in a stage  
   **When** I use "Select All in Stage"  
   **Then** all candidates in that stage are selected (not just visible ones)

6. **Given** a bulk action is performed  
   **When** it completes  
   **Then** a summary is shown: "X candidates moved, Y failed" with details on failures

## Priority
**P0 — Must Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **Max Bulk Size:** 200 candidates per bulk action
- **Processing:** Bulk actions processed asynchronously via queue; progress shown in UI
- **Audit:** Each individual move/reject in a bulk action is logged separately
- **Undo:** Bulk actions cannot be undone (confirmation required before execution)

## Technical Design

### Bulk Action API
```python
@router.post("/api/jobs/{job_id}/bulk-actions")
async def bulk_action(job_id: UUID, action: BulkActionRequest):
    # action.type: "move_stage" | "reject" | "send_email"
    # action.candidate_ids: list[UUID] (max 200)
    
    job = await queue.enqueue("bulk_action", {
        "job_id": job_id,
        "action": action.dict(),
        "initiated_by": current_user.id
    })
    return {"job_id": job.id, "status": "queued"}
```

### API Endpoints
```
POST /api/jobs/:id/bulk-actions          — Initiate bulk action
GET  /api/jobs/:id/bulk-actions/:jobId   — Get bulk action progress
```

## Sub-Tasks
- [ ] 09.4.a — Build multi-select UI with bulk action toolbar
- [ ] 09.4.b — Implement "Select All in Stage" functionality
- [ ] 09.4.c — Implement bulk move, reject, and email actions
- [ ] 09.4.d — Implement async processing with progress display
- [ ] 09.4.e — Implement per-action audit logging

## Testing Strategy
- Unit: Max size enforcement, action validation
- Integration: Bulk move with 100 candidates
- Performance: 200-candidate bulk action completes within 30 seconds

## Dependencies
- Story 09.2 (Kanban board — host UI)
- Epic 10 (Notifications — bulk email queuing)
