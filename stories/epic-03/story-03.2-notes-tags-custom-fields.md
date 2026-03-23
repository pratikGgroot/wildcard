# Story 03.2: Notes, Tags & Custom Fields

## User Story
**As a** recruiter  
**I want to** add notes, tags, and custom fields to a candidate profile  
**So that** I can capture context and collaborate with my team during the hiring process

## BRD Requirements Covered
- FR-CP-02: Recruiter can add notes, tags, and custom fields to profiles

## Acceptance Criteria
1. **Given** I am viewing a candidate profile  
   **When** I click "Add Note"  
   **Then** a text editor opens where I can write a note (supports plain text and basic formatting)

2. **Given** I save a note  
   **When** the note is stored  
   **Then** it appears in the Notes section with my name, timestamp, and is visible to all team members with access to this job

3. **Given** I want to tag a candidate  
   **When** I type in the tag field  
   **Then** I see autocomplete suggestions from existing tags; I can also create a new tag

4. **Given** I add a tag  
   **When** the tag is saved  
   **Then** it appears on the candidate card in the pipeline view and is searchable

5. **Given** an admin has configured custom fields for a job  
   **When** I view a candidate profile for that job  
   **Then** I see the custom fields section with the configured field types (text, number, dropdown, date)

6. **Given** I fill in a custom field  
   **When** I save  
   **Then** the value is stored per (candidate, job) pair and visible to all team members

7. **Given** I want to edit or delete a note I wrote  
   **When** I click the edit/delete icon on my note  
   **Then** I can modify or remove it; other users' notes cannot be edited by me

## Priority
**P1 — Must Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **Note Visibility:** Notes are scoped to the job pipeline (not globally visible across all jobs)
- **Tag Scope:** Tags are org-wide and reusable across candidates and jobs
- **Custom Fields:** Defined per job by admin; stored as JSONB for flexibility
- **Audit:** Note edits and deletions are soft-deleted and logged
- **Performance:** Note save ≤ 500ms

## Technical Design

### Database Schema
```sql
CREATE TABLE candidate_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  author_id UUID REFERENCES users(id),
  content TEXT NOT NULL,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  name VARCHAR(50) UNIQUE NOT NULL,
  color VARCHAR(7),  -- hex color
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE candidate_tags (
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id),
  added_by UUID REFERENCES users(id),
  added_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (candidate_id, tag_id, job_id)
);

CREATE TABLE custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  field_name VARCHAR(100) NOT NULL,
  field_type VARCHAR(20) CHECK (field_type IN ('text','number','dropdown','date','boolean')),
  options JSONB,  -- for dropdown type
  required BOOLEAN DEFAULT FALSE,
  display_order INT
);

CREATE TABLE custom_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  field_definition_id UUID REFERENCES custom_field_definitions(id),
  value JSONB,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### API Endpoints
```
POST   /api/candidates/:id/notes           — Add note
PUT    /api/candidates/:id/notes/:noteId   — Edit note (author only)
DELETE /api/candidates/:id/notes/:noteId   — Soft-delete note (author only)
GET    /api/candidates/:id/notes           — List notes for candidate+job

GET    /api/tags                           — List org tags (with autocomplete)
POST   /api/tags                           — Create new tag
POST   /api/candidates/:id/tags            — Add tag to candidate
DELETE /api/candidates/:id/tags/:tagId     — Remove tag

GET    /api/jobs/:id/custom-fields         — Get custom field definitions
POST   /api/candidates/:id/custom-fields   — Save custom field values
```

## Sub-Tasks
- [ ] 03.2.a — Build Notes component with add/edit/delete and author attribution
- [ ] 03.2.b — Build tag autocomplete input with create-new support
- [ ] 03.2.c — Build custom fields renderer (supports text, number, dropdown, date)
- [ ] 03.2.d — Implement custom field definition management in admin (Epic 16)
- [ ] 03.2.e — Write unit tests for permission checks (edit own notes only)

## Testing Strategy
- Unit: Permission checks, soft-delete logic
- Integration: Notes and tags CRUD APIs
- UI: Tag autocomplete, custom field rendering

## Dependencies
- Story 03.1 (Candidate profile view — host page)
- Epic 12 (RBAC — note edit permissions)
- Epic 16 (Admin — custom field definition)
