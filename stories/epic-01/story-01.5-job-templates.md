# Story 01.5: Job Templates

## User Story
**As a** recruiter  
**I want to** save job postings as templates and create new jobs from templates  
**So that** I can quickly post repetitive roles without rewriting common requirements

## BRD Requirements Covered
- FR-JD-04: Support for job templates to speed up repetitive role postings

## Acceptance Criteria
1. **Given** I have a job with criteria and weights  
   **When** I click "Save as Template"  
   **Then** I name the template, choose scope (Personal / Organization), and it is saved

2. **Given** I am creating a new job  
   **When** I click "Use Template"  
   **Then** I see a searchable list of templates filtered by department/role type

3. **Given** I select a template  
   **When** I apply it  
   **Then** the job form is pre-filled with the template's title, description, criteria, and weights

4. **Given** I edit the pre-filled content  
   **When** I save  
   **Then** changes apply only to this job — the original template is unchanged

5. **Given** I am an admin  
   **When** I create a template  
   **Then** I can mark it as "Organization-wide" so all recruiters can use it

6. **Given** I want to manage templates  
   **When** I navigate to "My Templates"  
   **Then** I can edit, duplicate, or delete templates I own

## Priority
**P1 — Should Have**

## Estimated Effort
**3 story points**

## NFR / Tech Notes
- **Scope:** Personal (creator only) vs Organization (all recruiters)
- **Search:** Templates searchable by name, department, role type
- **Usage Tracking:** Track usage count and last used date per template
- **Permissions:** Only creator or admin can edit/delete a template

## Technical Design

### Database Schema
```sql
CREATE TABLE job_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  department VARCHAR(100),
  role_type VARCHAR(100),
  template_data JSONB NOT NULL,  -- {title, description, criteria[], weight_config}
  scope VARCHAR(20) DEFAULT 'personal' CHECK (scope IN ('personal','organization')),
  created_by UUID REFERENCES users(id),
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_job_templates_scope ON job_templates(scope);
CREATE INDEX idx_job_templates_created_by ON job_templates(created_by);
```

### API Endpoints
```
POST /api/job-templates              — Create template
GET  /api/job-templates              — List templates (scope filter)
PUT  /api/job-templates/:id          — Update template
DELETE /api/job-templates/:id        — Delete template
POST /api/jobs/:id/save-as-template  — Save existing job as template
POST /api/job-templates/:id/apply    — Apply template to new job
```

## Sub-Tasks
- [ ] 01.5.a — Build template save modal (name, scope selection)
- [ ] 01.5.b — Build template browser UI (search, filter, preview)
- [ ] 01.5.c — Implement apply-template logic (deep copy, no reference)
- [ ] 01.5.d — Implement usage tracking

## Testing Strategy
- Unit: Template data deep copy (no reference sharing)
- Integration: CRUD operations, scope-based access
- E2E: Save template, apply to new job, edit without affecting template

## Dependencies
- Story 01.1 (Job creation)
- Story 01.3 (Criteria editing)
