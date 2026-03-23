# Story 01.4: Configure Criteria Weights

## User Story
**As a** recruiter  
**I want to** assign importance weights to screening criteria  
**So that** the AI scoring algorithm prioritizes the most critical requirements for this role

## BRD Requirements Covered
- FR-JD-06: Ability to weight criteria (e.g., "Python skills" = High, "AWS certification" = Medium)
- BRD Section 8.2: Weights configurable per job role by recruiter

## Acceptance Criteria
1. **Given** I am viewing job criteria  
   **When** I see each criterion  
   **Then** it shows a weight selector: High / Medium / Low with visual indicator

2. **Given** I change a criterion weight  
   **When** I save  
   **Then** the change persists and all candidate scores for this job are flagged for recalculation

3. **Given** I want to set category-level weights (Skills 40%, Experience 30%, Education 15%, Certs 15%)  
   **When** I open "Advanced Weight Settings"  
   **Then** I see sliders for each category that must sum to 100%

4. **Given** category weights don't sum to 100%  
   **When** I try to save  
   **Then** I see a validation error: "Weights must sum to 100%"

5. **Given** I want to reset to defaults  
   **When** I click "Reset to Defaults"  
   **Then** all weights return to: Skills 40%, Experience 30%, Education 15%, Certifications 15%

## Priority
**P1 — Should Have** *(deferred — per-criterion weight editing already available inline via Story 01.3; category-level sliders and score recalculation trigger depend on Epic 04)*

## Estimated Effort
**2 story points**

## NFR / Tech Notes
- **Default Weights:** Skills 40%, Experience 30%, Education 15%, Certifications 15% (BRD Section 8.2)
- **Validation:** Category weights must sum to 100% (±1% tolerance for rounding)
- **Real-time Preview:** Show estimated score impact when weights change
- **Persistence:** Weights stored per job, not globally

### SLA Requirements
- **Weight Save:** ≤500ms
- **Score Recalculation Trigger:** Queued within 1 second of weight save

## Technical Design

### Database Schema
```sql
-- Category-level weights stored on jobs table
ALTER TABLE jobs ADD COLUMN weight_config JSONB DEFAULT '{
  "skills": 40, "experience": 30, "education": 15, "certifications": 15
}'::jsonb;

-- Individual criterion weight multiplier
ALTER TABLE job_criteria ADD COLUMN weight_multiplier DECIMAL(3,2) DEFAULT 1.0;
-- high=1.5, medium=1.0, low=0.5
```

### Weight Mapping
```typescript
const WEIGHT_MULTIPLIERS = { high: 1.5, medium: 1.0, low: 0.5 };
const DEFAULT_CATEGORY_WEIGHTS = { skills: 40, experience: 30, education: 15, certifications: 15 };
```

## Sub-Tasks
- [ ] 01.4.a — Build weight selector UI (per-criterion dropdown + category sliders)
- [ ] 01.4.b — Implement category weight validation (sum = 100%)
- [ ] 01.4.c — Implement reset-to-defaults action
- [ ] 01.4.d — Trigger score recalculation on weight save

## Testing Strategy
- Unit: Weight validation, multiplier calculation
- Integration: Weight persistence and score recalculation trigger
- E2E: Configure weights, verify scoring impact

## Dependencies
- Story 01.3 (Criteria editing)
- Epic 04 (Scoring service)
