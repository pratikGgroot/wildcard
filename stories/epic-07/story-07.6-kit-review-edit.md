# Story 07.6: Interview Kit Review & Edit

## User Story
**As a** recruiter or hiring manager  
**I want to** review and edit the AI-generated interview kit before using it  
**So that** I can customize questions to match my interview style and add any missing areas

## BRD Requirements Covered
- FR-IK-05: Interviewer can edit / approve the kit before use

## Acceptance Criteria
1. **Given** an interview kit has been generated  
   **When** the recruiter opens the kit  
   **Then** they see all questions organized by type (Technical, Behavioral, Gap-Probe) with edit controls

2. **Given** I want to edit a question  
   **When** I click "Edit"  
   **Then** the question text becomes editable inline; changes are saved on blur or "Save" click

3. **Given** I want to add a custom question  
   **When** I click "Add Question"  
   **Then** I can enter a question, select type, competency, and difficulty

4. **Given** I want to remove a question  
   **When** I click "Delete"  
   **Then** the question is removed after confirmation

5. **Given** I want to reorder questions  
   **When** I drag a question  
   **Then** the order updates and is persisted

6. **Given** I am satisfied with the kit  
   **When** I click "Approve Kit"  
   **Then** the kit status changes to "Approved" and the approved_by and approved_at fields are set

7. **Given** a kit has been approved  
   **When** the JD criteria change  
   **Then** the kit is marked "Outdated" and the recruiter is prompted to regenerate or re-approve

## Priority
**P0 — Must Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **Edit Tracking:** `is_edited` flag set on any manually modified question
- **Approval:** Required before kit can be exported or shared
- **Drag-and-Drop:** Reordering via react-beautiful-dnd or dnd-kit
- **Auto-save:** Changes auto-saved every 10 seconds

## Technical Design

### Kit Status State Machine
```
generated → approved → [exported/shared]
          → outdated → generated (after regeneration)
```

### API Endpoints
```
GET  /api/interview-kits/:id                    — Get full kit
PUT  /api/interview-kits/:id/questions/:qId     — Edit question
POST /api/interview-kits/:id/questions          — Add custom question
DELETE /api/interview-kits/:id/questions/:qId  — Remove question
PATCH /api/interview-kits/:id/questions/reorder — Update question order
POST /api/interview-kits/:id/approve            — Approve kit
POST /api/interview-kits/:id/regenerate         — Regenerate outdated kit
```

## Sub-Tasks
- [ ] 07.6.a — Build interview kit review UI with question list
- [ ] 07.6.b — Implement inline question editing with auto-save
- [ ] 07.6.c — Implement add/delete/reorder question functionality
- [ ] 07.6.d — Implement kit approval flow with status management
- [ ] 07.6.e — Implement "Outdated" detection on JD change

## Testing Strategy
- Unit: Kit status state machine, edit tracking
- Integration: Full edit → approve flow
- UI: Drag-and-drop reordering

## Dependencies
- Story 07.2, 07.3, 07.4, 07.5 (Question generation — provides initial kit content)
