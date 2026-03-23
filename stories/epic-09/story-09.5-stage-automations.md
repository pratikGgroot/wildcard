# Story 09.5: Stage Automations

## User Story
**As a** recruiter  
**I want to** configure automatic actions that trigger when candidates reach certain stages or time thresholds  
**So that** routine pipeline tasks happen without manual intervention

## BRD Requirements Covered
- FR-PL-04: Stage-level automations (e.g., auto-send rejection email after 30 days in Applied stage)

## Acceptance Criteria
1. **Given** I am configuring a job's pipeline  
   **When** I navigate to "Automations"  
   **Then** I can create rules with: trigger (stage entered, time in stage), condition, and action

2. **Given** I create an automation "Send rejection email after 30 days in Applied"  
   **When** a candidate has been in Applied for 30 days  
   **Then** a rejection email is automatically sent and the candidate is moved to Rejected

3. **Given** I create an automation "Send interview invite when moved to Interviewing"  
   **When** a candidate is moved to Interviewing  
   **Then** an email is automatically sent using the configured template

4. **Given** an automation fires  
   **When** the action executes  
   **Then** the action is logged in the candidate's activity history with "Automated action" label

5. **Given** I want to disable an automation  
   **When** I toggle it off  
   **Then** it stops firing immediately without deleting the configuration

## Priority
**P1 — Should Have**

## Estimated Effort
**8 story points**

## NFR / Tech Notes
- **Trigger Types:** Stage entered, time in stage (days), score threshold crossed
- **Action Types:** Send email, move stage, add tag, notify recruiter
- **Execution:** Time-based automations checked by daily cron job
- **Audit:** All automated actions logged with automation rule ID

## Technical Design

### Automation Schema
```sql
CREATE TABLE stage_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  trigger_type VARCHAR(30) CHECK (trigger_type IN ('stage_entered','time_in_stage','score_threshold')),
  trigger_stage VARCHAR(50),
  trigger_days INT,
  trigger_score FLOAT,
  action_type VARCHAR(30) CHECK (action_type IN ('send_email','move_stage','add_tag','notify_recruiter')),
  action_config JSONB NOT NULL,
  is_enabled BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### API Endpoints
```
GET  /api/jobs/:id/automations          — List automations
POST /api/jobs/:id/automations          — Create automation
PUT  /api/jobs/:id/automations/:id      — Update automation
PATCH /api/jobs/:id/automations/:id/toggle — Enable/disable
DELETE /api/jobs/:id/automations/:id    — Delete automation
```

## Sub-Tasks
- [ ] 09.5.a — Implement automation schema and CRUD API
- [ ] 09.5.b — Implement stage-entered trigger (event-driven)
- [ ] 09.5.c — Implement time-in-stage trigger (daily cron job)
- [ ] 09.5.d — Build automation configuration UI
- [ ] 09.5.e — Implement automation execution logging

## Testing Strategy
- Unit: Trigger evaluation, action execution
- Integration: Full automation cycle (trigger → action → log)
- Time-based: Simulate 30-day trigger with time manipulation

## Dependencies
- Story 09.1 (Pipeline stages — trigger stages)
- Epic 10 (Notifications — email action)
