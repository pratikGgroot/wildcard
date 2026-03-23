# Story 16.5: AI Ethics & Governance Settings

## User Story
**As an** admin or compliance officer  
**I want to** configure AI ethics and governance policies  
**So that** the platform operates within our organization's ethical AI standards

## BRD Requirements Covered
- BRD Section 11.3: AI Ethics & Governance — model version control, human-in-the-loop, no fully automated rejection, regular bias audits, candidate transparency

## Acceptance Criteria
1. **Given** I navigate to AI Ethics & Governance  
   **When** the page loads  
   **Then** I see configurable policies: human-in-the-loop enforcement, blind review defaults, candidate AI disclosure, bias audit schedule

2. **Given** I enable "Candidate AI Disclosure"  
   **When** a candidate applies  
   **Then** they see a notice: "This organization uses AI to assist in screening. [Learn more]"

3. **Given** I configure the bias audit schedule  
   **When** the scheduled date arrives  
   **Then** a bias audit report is automatically generated and sent to the compliance officer

4. **Given** I view the AI model change log  
   **When** the page loads  
   **Then** I see a history of all AI model changes with: model name, version, changed by, and date

5. **Given** "No Automated Rejection" is enforced  
   **When** any automation tries to reject a candidate  
   **Then** it is blocked and the recruiter is notified to take manual action

## Priority
**P0 — Must Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **Human-in-the-Loop:** Enforced at system level — cannot be disabled by non-admin
- **Bias Audit Schedule:** Configurable: monthly, quarterly, or on-demand
- **Model Change Log:** Immutable audit trail of all AI model changes
- **Candidate Disclosure:** Configurable per org; default: off

## Technical Design

### Ethics Configuration Schema
```sql
CREATE TABLE ai_ethics_config (
  org_id UUID REFERENCES organizations(id) PRIMARY KEY,
  human_in_loop_enforced BOOLEAN DEFAULT TRUE,
  no_automated_rejection BOOLEAN DEFAULT TRUE,
  candidate_ai_disclosure BOOLEAN DEFAULT FALSE,
  disclosure_text TEXT,
  blind_review_default BOOLEAN DEFAULT FALSE,
  bias_audit_schedule VARCHAR(20) DEFAULT 'quarterly' CHECK (bias_audit_schedule IN ('monthly','quarterly','manual')),
  bias_audit_recipients TEXT[],
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE ai_model_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  task VARCHAR(50),
  old_model VARCHAR(100),
  new_model VARCHAR(100),
  changed_by UUID REFERENCES users(id),
  changed_at TIMESTAMP DEFAULT NOW(),
  reason TEXT
);
```

### API Endpoints
```
GET  /api/admin/ai-ethics              — Get ethics configuration
PUT  /api/admin/ai-ethics              — Update ethics configuration
GET  /api/admin/ai-ethics/model-log    — Get AI model change log
POST /api/admin/ai-ethics/bias-audit   — Trigger manual bias audit
```

## Sub-Tasks
- [ ] 16.5.a — Build AI ethics configuration UI
- [ ] 16.5.b — Implement candidate AI disclosure notice
- [ ] 16.5.c — Implement bias audit scheduling and auto-generation
- [ ] 16.5.d — Implement AI model change log (immutable)
- [ ] 16.5.e — Implement no-automated-rejection enforcement

## Testing Strategy
- Unit: No-automated-rejection enforcement, disclosure trigger
- Integration: Bias audit schedule → auto-generation
- Audit: Model change log is immutable

## Dependencies
- Story 08.6 (Fairness metrics — bias audit data source)
- Story 08.7 (Compliance report — bias audit output)
