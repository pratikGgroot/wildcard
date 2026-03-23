# Story 01.3: Review and Edit AI-Extracted Criteria

## User Story
**As a** recruiter  
**I want to** review, edit, add, and delete AI-extracted screening criteria  
**So that** I can ensure the criteria accurately reflect the role before activating the job

## BRD Requirements Covered
- FR-JD-03: Recruiter can review and edit AI-extracted criteria before activating the job

## Acceptance Criteria
1. **Given** AI has extracted criteria  
   **When** I view the job criteria page  
   **Then** I see all criteria grouped by category (Skills, Experience, Education, Certifications) with confidence badges

2. **Given** I click "Edit" on a criterion  
   **When** the inline editor opens  
   **Then** I can modify: name, type, weight (high/medium/low), required/preferred toggle

3. **Given** I click "Add Criterion"  
   **When** I fill in the form  
   **Then** a new criterion is added with `ai_extracted = false` flag

4. **Given** I click "Delete" on a criterion  
   **When** I confirm the deletion  
   **Then** the criterion is removed and a toast notification confirms the action with an "Undo" option (5-second window)

5. **Given** I have made changes  
   **When** I click "Save Changes"  
   **Then** all modifications are persisted, `updated_at` is refreshed, and downstream scores are flagged for recalculation

6. **Given** I have unsaved changes  
   **When** I try to navigate away  
   **Then** I see a "You have unsaved changes — leave anyway?" confirmation dialog

## Priority
**P0 — Must Have**

## Estimated Effort
**3 story points**

## NFR / Tech Notes
- **UX:** Inline editing — no full page reload required
- **Auto-save:** Changes auto-saved after 2 seconds of inactivity
- **Undo:** Session-based undo for deletions (5-second toast window)
- **Audit:** All manual edits logged with user ID and timestamp
- **Validation:** Criterion name: 2–200 chars; weight must be enum value

## Technical Design

### API Endpoints
```
GET    /api/jobs/:id/criteria              — List all criteria
POST   /api/jobs/:id/criteria              — Add new criterion
PUT    /api/jobs/:id/criteria/:criterionId — Update criterion
DELETE /api/jobs/:id/criteria/:criterionId — Delete criterion
PUT    /api/jobs/:id/criteria/bulk         — Bulk save all criteria
```

### Audit Log
```sql
CREATE TABLE criteria_edit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id),
  criterion_id UUID,
  action VARCHAR(20) CHECK (action IN ('created','updated','deleted')),
  old_value JSONB,
  new_value JSONB,
  edited_by UUID REFERENCES users(id),
  edited_at TIMESTAMP DEFAULT NOW()
);
```

## Sub-Tasks
- [ ] 01.3.a — Build inline criteria editor component
- [ ] 01.3.b — Implement add/delete with undo toast
- [ ] 01.3.c — Implement unsaved-changes navigation guard
- [ ] 01.3.d — Implement audit logging for all edits
- [ ] 01.3.e — Trigger score recalculation flag on criteria save

## Testing Strategy
- Unit: Validation rules, undo logic
- Integration: CRUD API operations
- E2E: Edit, add, delete, save, undo flow
- Accessibility: Keyboard navigation, screen reader support

## Dependencies
- Story 01.2 (AI extraction)
- Epic 04 (Score recalculation trigger)
