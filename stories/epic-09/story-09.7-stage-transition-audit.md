# Story 09.7: Stage Transition Audit Trail

## User Story
**As a** recruiter or compliance officer  
**I want to** see a complete history of every stage transition for a candidate  
**So that** I can understand the hiring timeline and audit decisions

## BRD Requirements Covered
- FR-BD-05: Audit log of every AI decision with explainability data (extends to manual decisions)
- BRD Section 9.1: Application entity includes stage_history[]

## Acceptance Criteria
1. **Given** a candidate is moved to a new stage  
   **When** the move is saved  
   **Then** a stage history record is created with: from_stage, to_stage, moved_by (user or "Automated"), reason, and timestamp

2. **Given** I view a candidate's application  
   **When** I open the "Activity" tab  
   **Then** I see a chronological timeline of all stage transitions

3. **Given** a stage transition was automated  
   **When** it appears in the history  
   **Then** it shows "Automated — [Rule Name]" instead of a user name

4. **Given** a stage transition was made via the chat assistant  
   **When** it appears in the history  
   **Then** it shows "Via Chat Assistant — [Recruiter Name]"

5. **Given** the audit trail is viewed  
   **When** a compliance officer exports it  
   **Then** the full history is included in the compliance report

## Priority
**P0 — Must Have**

## Estimated Effort
**3 story points**

## NFR / Tech Notes
- **Immutability:** Stage history records are append-only
- **Attribution:** Every transition attributed to a user, automation rule, or system
- **Retention:** Retained for 5 years (BRD Section 9.2)

## Technical Design

### Stage History Schema (extends Story 03.4)
```sql
ALTER TABLE stage_history ADD COLUMN source VARCHAR(20) 
  CHECK (source IN ('manual','automation','chat_assistant','system'));
ALTER TABLE stage_history ADD COLUMN automation_id UUID REFERENCES stage_automations(id);
ALTER TABLE stage_history ADD COLUMN session_id UUID REFERENCES conversation_sessions(id);
```

### API Endpoints
```
GET /api/applications/:id/stage-history   — Get full stage history
```

## Sub-Tasks
- [ ] 09.7.a — Implement stage history recording with source attribution
- [ ] 09.7.b — Build Activity timeline UI component
- [ ] 09.7.c — Implement automation and chat assistant attribution

## Testing Strategy
- Unit: Source attribution for all transition types
- Integration: History populated from manual, automated, and chat-triggered moves

## Dependencies
- Story 09.3 (Drag-and-drop — manual transitions)
- Story 09.5 (Automations — automated transitions)
- Story 06.6 (Chat action tool — chat-triggered transitions)
