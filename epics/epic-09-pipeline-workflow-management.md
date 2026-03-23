# Epic 09: Pipeline & Workflow Management

## Overview
Implement configurable hiring pipelines with stage management, bulk actions, automations, and role-based access control.

## Business Value
- Streamlines candidate progression through hiring stages
- Enables efficient bulk operations on candidates
- Automates repetitive workflow tasks

## BRD Requirements Covered
- FR-PL-01: Configurable hiring stages per job
- FR-PL-02: Drag-and-drop kanban board
- FR-PL-03: Bulk actions (move, reject, email)
- FR-PL-04: Stage-level automations
- FR-PL-05: Role-based access control

## Priority
**CRITICAL**

## NFR / Tech Notes
- **Performance:** Pipeline view loads ≤2 seconds (NFR-P-04)
- **Real-time Updates:** WebSocket for live pipeline changes
- **RBAC:** Enforce permissions at API and UI layer
- **Audit Trail:** Log all stage transitions

## Technical Design

### Pipeline Stages (Default)
```
Applied → Screened → Phone Screen → Technical Interview → 
Final Interview → Offer → Hired/Rejected
```

### Database Schema
```sql
CREATE TABLE pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  stage_name VARCHAR(100) NOT NULL,
  stage_order INTEGER NOT NULL,
  auto_actions JSONB, -- Automation rules
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE stage_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  from_stage VARCHAR(100),
  to_stage VARCHAR(100) NOT NULL,
  moved_by UUID REFERENCES users(id),
  moved_at TIMESTAMP DEFAULT NOW(),
  reason TEXT
);

CREATE INDEX idx_stage_transitions_application ON stage_transitions(application_id);
```

## Stories
- Story 09.1: Configure Pipeline Stages
- Story 09.2: Kanban Board View
- Story 09.3: Drag-and-Drop Stage Movement
- Story 09.4: Bulk Actions Interface
- Story 09.5: Stage Automations
- Story 09.6: RBAC Implementation
- Story 09.7: Stage Transition Audit Log

## Estimated Effort
**18-21 story points** (3 sprints)

## Success Metrics
- Pipeline view load time ≤2 seconds
- 95% of stage transitions complete within 1 second
- Zero unauthorized access incidents
