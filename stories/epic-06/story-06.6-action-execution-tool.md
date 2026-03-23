# Story 06.6: Action Execution Tool (Move Candidate)

## User Story
**As a** recruiter  
**I want to** trigger pipeline actions through the chat assistant  
**So that** I can move candidates between stages without leaving the chat context

## BRD Requirements Covered
- FR-CA-05: Assistant can trigger actions (e.g., "Move candidate X to interview stage")
- BRD Section 8.5: `move_candidate(candidate_id, stage)` tool
- BRD Section 11.3: Human-in-the-loop — write actions require confirmation

## Acceptance Criteria
1. **Given** I say "Move John Smith to interview stage"  
   **When** the agent processes the request  
   **Then** it asks for confirmation: "Move John Smith (Backend Engineer role) to Interview stage. Confirm?"

2. **Given** I confirm the action  
   **When** the move is executed  
   **Then** the candidate's stage is updated and the assistant confirms: "Done — John Smith moved to Interview stage"

3. **Given** I decline the confirmation  
   **When** I say "No" or "Cancel"  
   **Then** the action is not executed and the assistant acknowledges: "Action cancelled"

4. **Given** the candidate name is ambiguous (multiple matches)  
   **When** the agent processes the request  
   **Then** it asks: "I found 2 candidates named John Smith — which one did you mean?" with options

5. **Given** I request an invalid stage transition  
   **When** the agent processes it  
   **Then** it responds with the valid stages and asks which one I meant

6. **Given** an action is executed  
   **When** the move completes  
   **Then** the audit log records: user, action, candidate, from_stage, to_stage, timestamp

## Priority
**P1 — Should Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **Confirmation Required:** All write actions require explicit confirmation (BRD 11.3)
- **Audit:** Every executed action logged (BRD FR-BD-05)
- **Guardrails:** Assistant cannot reject candidates without human confirmation
- **Ambiguity Resolution:** Name disambiguation before action execution

## Technical Design

### Action Tool
```python
async def move_candidate(candidate_id: UUID, job_id: UUID, target_stage: str) -> ActionResult:
    # Validate stage transition
    current = await db.get_application_stage(candidate_id, job_id)
    if not is_valid_transition(current, target_stage):
        raise InvalidTransitionError(f"Cannot move from {current} to {target_stage}")
    
    # Execute move
    await pipeline_service.move_candidate(candidate_id, job_id, target_stage)
    await audit_log.record(action="move_candidate", ...)
    
    return ActionResult(success=True, message=f"Moved to {target_stage}")
```

### API Endpoints
```
POST /api/chat/tools/move-candidate   — Execute move action (requires prior confirmation)
```

## Sub-Tasks
- [ ] 06.6.a — Implement move_candidate tool with stage validation
- [ ] 06.6.b — Implement confirmation flow in agent loop
- [ ] 06.6.c — Implement name disambiguation for ambiguous candidate references
- [ ] 06.6.d — Implement audit logging for chat-triggered actions

## Testing Strategy
- Unit: Stage validation, disambiguation logic, confirmation flow
- Integration: Full move action with audit log verification
- Security: Verify actions respect RBAC (recruiter can only move in their jobs)

## Dependencies
- Story 06.2 (Intent routing — calls this tool)
- Epic 09 (Pipeline stage management — stage transitions)
- Epic 12 (RBAC — action permissions)
