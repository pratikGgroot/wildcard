# Story 01.1: Create Job Posting

## User Story
**As a** recruiter  
**I want to** create a new job posting with a free-text job description  
**So that** I can start accepting and evaluating applications for an open role

## BRD Requirements Covered
- FR-JD-01: Recruiter can create a job posting with free-text job description
- FR-JD-07: Jobs can be assigned to specific recruiter(s) and hiring manager(s)
- FR-JD-08: Job postings can be set as active, paused, or closed

## Acceptance Criteria
1. **Given** I am logged in as a recruiter  
   **When** I navigate to "Create Job"  
   **Then** I see a form with: Job Title (required), Department, Location, Job Type (full-time/contract/internship), Description (rich text, required), and assignment fields

2. **Given** I fill in all required fields  
   **When** I click "Save as Draft"  
   **Then** the job is saved with status `draft` and I see a success confirmation

3. **Given** I have a draft job  
   **When** I assign one or more recruiters and a hiring manager  
   **Then** assignments are saved and assigned users receive in-app + email notifications

4. **Given** I have a draft job with all required fields and at least one recruiter assigned  
   **When** I click "Activate Job"  
   **Then** status changes to `active`, the job appears on the job board, and assigned users are notified

5. **Given** I have an active job  
   **When** I change status to `paused`  
   **Then** new applications are disabled and existing pipeline is unaffected

6. **Given** I have an active or paused job  
   **When** I change status to `closed`  
   **Then** status updates, applications are disabled, I am prompted for a close reason, and all assigned users are notified

7. **Given** I try to activate a job without assigning a recruiter  
   **When** I click "Activate"  
   **Then** I see a validation error: "At least one recruiter must be assigned before activating"

## Priority
**P0 — Must Have**

## Estimated Effort
**3 story points**

## NFR / Tech Notes
- **Performance:** Form submission completes within 1 second
- **Auto-save:** Draft auto-saves every 30 seconds to prevent data loss
- **Validation:** Title: 5–200 chars; Description: 50–10,000 chars
- **Rich Text:** Support bold, italic, bullet lists, numbered lists, hyperlinks
- **Audit Trail:** All status changes logged with user ID, timestamp, and reason
- **State Machine:** Enforce valid transitions: `draft → active`, `active → paused/closed`, `paused → active/closed`, `closed` is terminal

### SLA Requirements
- **Form Submission:** ≤1 second response
- **Status Change:** ≤500ms to persist and return

## Technical Design

### Status State Machine
```
draft ──▶ active ──▶ paused ──▶ active
                 └──▶ closed ◀── paused
```

### Database Schema
```sql
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  department VARCHAR(100),
  location VARCHAR(100),
  type VARCHAR(20) NOT NULL CHECK (type IN ('full-time','contract','internship')),
  description TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','active','paused','closed')),
  close_reason TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE job_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  role VARCHAR(20) NOT NULL CHECK (role IN ('recruiter','hiring_manager')),
  assigned_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE job_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  from_status VARCHAR(20),
  to_status VARCHAR(20) NOT NULL,
  reason TEXT,
  changed_by UUID REFERENCES users(id),
  changed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_created_at ON jobs(created_at DESC);
CREATE INDEX idx_job_assignments_job ON job_assignments(job_id);
```

### API Endpoints
```
POST   /api/jobs                    — Create job (draft)
GET    /api/jobs                    — List jobs (filter: status, department, recruiter)
GET    /api/jobs/:id                — Get job detail
PUT    /api/jobs/:id                — Update job fields
PATCH  /api/jobs/:id/status         — Change status
POST   /api/jobs/:id/assignments    — Assign recruiter(s) / hiring manager
DELETE /api/jobs/:id/assignments/:userId — Remove assignment
GET    /api/jobs/:id/status-history — Get status change log
```

### Validation Rules
```typescript
const jobSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(50).max(10000),
  department: z.string().max(100).optional(),
  location: z.string().max(100).optional(),
  type: z.enum(['full-time', 'contract', 'internship']),
});
```

## Sub-Tasks
- [ ] 01.1.a — Build job creation form UI (rich text editor, field validation)
- [ ] 01.1.b — Implement auto-save draft logic (30-second debounce)
- [ ] 01.1.c — Implement job assignment UI (user search + multi-select)
- [ ] 01.1.d — Implement status state machine with transition validation
- [ ] 01.1.e — Implement status change notifications (in-app + email)
- [ ] 01.1.f — Write unit tests for state machine and validation
- [ ] 01.1.g — Write E2E test for full job creation flow

## Testing Strategy
- Unit: State machine transitions, validation rules
- Integration: API CRUD, assignment notifications
- E2E: Full create → assign → activate flow
- Permission: Verify only recruiters/admins can create jobs

## Dependencies
- Epic 12 (Auth/RBAC)
- Epic 10 (Notification service)
