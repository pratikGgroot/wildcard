# Story 09.3: Drag-and-Drop Candidate Movement

## User Story
**As a** recruiter  
**I want to** drag candidate cards between pipeline stages  
**So that** I can move candidates quickly without using menus

## BRD Requirements Covered
- FR-PL-02: Drag-and-drop kanban board for moving candidates across stages

## Acceptance Criteria
1. **Given** I am on the kanban board  
   **When** I drag a candidate card to a different stage column  
   **Then** the card moves to the new column and the stage transition is saved

2. **Given** I drag a candidate to a terminal stage (Hired/Rejected)  
   **When** I drop the card  
   **Then** I am prompted to confirm: "Move [Candidate] to [Stage]? This action cannot be undone."

3. **Given** I drag a candidate to an invalid stage (e.g., backward past a required stage)  
   **When** I attempt the drop  
   **Then** the drop is rejected and the card returns to its original position with an error message

4. **Given** a stage transition is saved  
   **When** the move completes  
   **Then** the stage history is updated and the recruiter sees a success toast notification

5. **Given** I accidentally move a candidate  
   **When** I click "Undo" within 5 seconds  
   **Then** the candidate is moved back to the previous stage

## Priority
**P1 — Should Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **Library:** dnd-kit (React) for accessible drag-and-drop
- **Optimistic Update:** Card moves immediately in UI; reverts if API call fails
- **Undo Window:** 5 seconds to undo a move
- **Accessibility:** Keyboard-accessible drag-and-drop (arrow keys + Enter)
- **Audit:** Every move logged in stage_history

## Technical Design

### Drag-and-Drop Handler
```typescript
const handleDragEnd = async (event: DragEndEvent) => {
  const { active, over } = event;
  if (!over || active.data.current?.stage === over.id) return;
  
  const candidateId = active.id;
  const targetStage = over.id as string;
  
  // Optimistic update
  updateCandidateStage(candidateId, targetStage);
  
  try {
    await api.moveCandidate(candidateId, jobId, targetStage);
    showUndoToast(candidateId, previousStage, targetStage);
  } catch (error) {
    // Revert optimistic update
    updateCandidateStage(candidateId, previousStage);
    showErrorToast(error.message);
  }
};
```

### API Endpoints
```
PATCH /api/applications/:id/stage   — Move candidate to new stage
POST  /api/applications/:id/stage/undo — Undo last stage move (within 5s window)
```

## Sub-Tasks
- [ ] 09.3.a — Integrate dnd-kit for drag-and-drop
- [ ] 09.3.b — Implement optimistic updates with revert on failure
- [ ] 09.3.c — Implement terminal stage confirmation dialog
- [ ] 09.3.d — Implement 5-second undo toast
- [ ] 09.3.e — Implement keyboard-accessible drag-and-drop

## Testing Strategy
- Unit: Stage validation, undo window logic
- Integration: Move API with stage history update
- Accessibility: Keyboard navigation for drag-and-drop

## Dependencies
- Story 09.2 (Kanban board — host component)
- Story 09.7 (Stage transition audit — logs moves)
