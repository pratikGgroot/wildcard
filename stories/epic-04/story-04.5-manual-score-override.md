# Story 04.5: Manual Score Override

## User Story
**As a** recruiter  
**I want to** override or adjust a candidate's AI-generated fit score  
**So that** I can apply my domain judgment when the AI score doesn't reflect the full picture

## BRD Requirements Covered
- FR-SC-05: Recruiter can override or adjust scores with justification

## Acceptance Criteria
1. **Given** I am viewing a candidate's fit score  
   **When** I click "Override Score"  
   **Then** I see an input to enter a new score (0–100) and a required justification text field

2. **Given** I enter a new score and justification  
   **When** I click "Save Override"  
   **Then** the displayed score updates to my override value with a visual indicator ("Manually Adjusted")

3. **Given** a score has been manually overridden  
   **When** any user views the candidate card  
   **Then** they see the override indicator and can hover to see the original AI score and justification

4. **Given** a score has been manually overridden  
   **When** the JD criteria are updated and recalculation runs  
   **Then** the override is preserved (not overwritten by recalculation) unless the recruiter explicitly resets it

5. **Given** I want to revert to the AI score  
   **When** I click "Reset to AI Score"  
   **Then** the override is removed and the current AI score is displayed

6. **Given** a score override is saved  
   **When** the action is logged  
   **Then** the audit log records: user, original score, override score, justification, and timestamp

## Priority
**P1 — Should Have**

## Estimated Effort
**3 story points**

## NFR / Tech Notes
- **Justification:** Required field, minimum 10 characters
- **Audit:** All overrides logged and visible in audit trail
- **Override Persistence:** Overrides survive recalculation unless explicitly reset
- **Permissions:** Only recruiters and admins assigned to the job can override

## Technical Design

### Database Schema
```sql
ALTER TABLE fit_scores ADD COLUMN is_overridden BOOLEAN DEFAULT FALSE;
ALTER TABLE fit_scores ADD COLUMN override_score FLOAT;
ALTER TABLE fit_scores ADD COLUMN override_justification TEXT;
ALTER TABLE fit_scores ADD COLUMN overridden_by UUID REFERENCES users(id);
ALTER TABLE fit_scores ADD COLUMN overridden_at TIMESTAMP;
ALTER TABLE fit_scores ADD COLUMN original_ai_score FLOAT;
```

### API Endpoints
```
POST /api/applications/:id/score/override   — Set manual override
DELETE /api/applications/:id/score/override — Reset to AI score
GET  /api/applications/:id/score/history    — Full score history with overrides
```

## Sub-Tasks
- [ ] 04.5.a — Build override input UI with justification field
- [ ] 04.5.b — Implement override persistence and recalculation protection
- [ ] 04.5.c — Build override indicator on candidate card
- [ ] 04.5.d — Implement audit logging for overrides

## Testing Strategy
- Unit: Override persistence through recalculation, permission checks
- Integration: Override API with audit log verification

## Dependencies
- Story 04.2 (Fit score calculation)
- Story 04.4 (Score recalculation — must respect overrides)
- Epic 12 (RBAC — override permissions)
