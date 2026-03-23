# Story 10.1: Email Template Management

## User Story
**As a** recruiter or admin  
**I want to** create and manage email templates for different pipeline stages  
**So that** candidate communications are consistent and on-brand

## BRD Requirements Covered
- FR-NC-03: Email templates configurable per stage and per role

## Acceptance Criteria
1. **Given** I am in the admin or job settings  
   **When** I navigate to "Email Templates"  
   **Then** I see a list of existing templates organized by stage and type

2. **Given** I create a new template  
   **When** I fill in the subject and body  
   **Then** I can use merge tags like {{candidate_name}}, {{job_title}}, {{company_name}}, {{recruiter_name}}

3. **Given** I save a template  
   **When** it is stored  
   **Then** it is available for selection when sending emails from the pipeline

4. **Given** a template uses merge tags  
   **When** an email is sent  
   **Then** the merge tags are replaced with the actual values for that candidate and job

5. **Given** I want to preview a template  
   **When** I click "Preview"  
   **Then** I see the rendered email with sample data substituted for merge tags

6. **Given** a template is set as default for a stage  
   **When** an automated email is triggered for that stage  
   **Then** the default template is used automatically

## Priority
**P1 — Should Have**

## Estimated Effort
**3 story points**

## NFR / Tech Notes
- **Template Engine:** Handlebars or Jinja2 for merge tag rendering
- **Scope:** Templates can be org-wide (default) or job-specific (override)
- **Rich Text:** Template body supports HTML with a WYSIWYG editor
- **Merge Tags:** {{candidate_name}}, {{job_title}}, {{company_name}}, {{recruiter_name}}, {{pipeline_stage}}, {{application_date}}

## Technical Design

### Database Schema
```sql
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  job_id UUID REFERENCES jobs(id),  -- NULL = org-wide template
  name VARCHAR(100) NOT NULL,
  stage VARCHAR(50),  -- NULL = not stage-specific
  subject VARCHAR(200) NOT NULL,
  body_html TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### API Endpoints
```
GET  /api/email-templates              — List templates (filter: stage, job)
POST /api/email-templates              — Create template
PUT  /api/email-templates/:id          — Update template
DELETE /api/email-templates/:id        — Delete template
POST /api/email-templates/:id/preview  — Preview with sample data
```

## Sub-Tasks
- [ ] 10.1.a — Build email template editor with WYSIWYG and merge tag support
- [ ] 10.1.b — Implement merge tag rendering engine
- [ ] 10.1.c — Implement template preview with sample data
- [ ] 10.1.d — Implement default template assignment per stage

## Testing Strategy
- Unit: Merge tag rendering, template validation
- Integration: Template creation and retrieval
- UI: WYSIWYG editor renders correctly

## Dependencies
- Epic 16 (Admin panel — template management UI location)
