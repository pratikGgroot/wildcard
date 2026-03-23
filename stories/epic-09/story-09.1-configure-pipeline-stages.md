# Story 09.1: Configure Pipeline Stages

## User Story
**As a** recruiter or admin  
**I want to** configure the hiring stages for each job  
**So that** the pipeline reflects our actual hiring process

## BRD Requirements Covered
- FR-PL-01: Support configurable hiring stages per job role

## Acceptance Criteria
1. **Given** I am creating or editing a job  
   **When** I navigate to the Pipeline Configuration section  
   **Then** I see the default stages: Applied → Screened → Interviewing → Offer → Hired / Rejected

2. **Given** I want to customize stages  
   **When** I add a new stage  
   **Then** I can name it, set its position in the sequence, and choose a color

3. **Given** I want to remove a stage  
   **When** I click "Remove Stage"  
   **Then** I am warned if candidates are currently in that stage; I must move them before deletion

4. **Given** I want to reorder stages  
   **When** I drag a stage  
   **Then** the order updates and is saved

5. **Given** stages are configured  
   **When** the job is activated  
   **Then** the pipeline uses the configured stages and all candidates start in "Applied"

6. **Given** a stage is marked as "terminal" (Hired, Rejected)  
   **When** a candidate reaches it  
   **Then** no further stage transitions are allowed

## Priority
**P0 — Must Have**

## Estimated Effort
**3 story points**

## NFR / Tech Notes
- **Default Stages:** Applied, Screened, Interviewing, Offer, Hired, Rejected (always present)
- **Custom Stages:** Up to 10 total stages per job
- **Terminal Stages:** Hired and Rejected are always terminal and cannot be removed
- **Stage Colors:** Configurable for visual differentiation in kanban view

## Technical Design

### Database Schema
```sql
CREATE TABLE pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  display_order INT NOT NULL,
  color VARCHAR(7),
  is_terminal BOOLEAN DEFAULT FALSE,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_pipeline_stages_job_order ON pipeline_stages(job_id, display_order);
```

### API Endpoints
```
GET  /api/jobs/:id/stages          — Get pipeline stages
POST /api/jobs/:id/stages          — Add custom stage
PUT  /api/jobs/:id/stages/:stageId — Update stage (name, color, order)
DELETE /api/jobs/:id/stages/:stageId — Remove stage (with candidate check)
PATCH /api/jobs/:id/stages/reorder — Update stage order
```

## Sub-Tasks
- [ ] 09.1.a — Implement pipeline stage schema and default stage seeding
- [ ] 09.1.b — Build stage configuration UI with drag-and-drop reordering
- [ ] 09.1.c — Implement stage deletion with candidate-in-stage check
- [ ] 09.1.d — Write unit tests for terminal stage protection

## Testing Strategy
- Unit: Terminal stage protection, deletion with candidates present
- Integration: Stage configuration → pipeline view rendering

## Dependencies
- Epic 01 (Job creation — pipeline config is part of job setup)
