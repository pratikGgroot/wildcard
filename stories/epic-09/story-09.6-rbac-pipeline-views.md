# Story 09.6: RBAC Pipeline Views

## User Story
**As a** platform admin  
**I want to** enforce role-based access to pipeline views  
**So that** recruiters, hiring managers, and read-only viewers see only what they're permitted to

## BRD Requirements Covered
- FR-PL-05: Role-based access control (recruiter vs hiring manager vs admin views)
- BRD Section 11.1: RBAC — Admin > Recruiter > Hiring Manager > Read-Only Viewer

## Acceptance Criteria
1. **Given** a recruiter is assigned to a job  
   **When** they view the pipeline  
   **Then** they can see all candidates, move stages, add notes, and perform bulk actions

2. **Given** a hiring manager is assigned to a job  
   **When** they view the pipeline  
   **Then** they can see candidates in Interviewing and later stages; they can add notes but cannot move candidates

3. **Given** a read-only viewer accesses a job  
   **When** they view the pipeline  
   **Then** they can see candidate cards and scores but cannot perform any actions

4. **Given** a user tries to access a job they are not assigned to  
   **When** they navigate to the pipeline  
   **Then** they receive a 403 Forbidden response

5. **Given** an admin views any pipeline  
   **When** they access it  
   **Then** they have full access regardless of assignment

## Priority
**P0 — Must Have**

## Estimated Effort
**3 story points**

## NFR / Tech Notes
- **Enforcement:** RBAC enforced at both API and UI layer
- **Roles:** Admin > Recruiter > Hiring Manager > Read-Only Viewer
- **Stage Visibility:** Hiring managers see only stages from Interviewing onward (configurable)

## Technical Design

### Permission Matrix
```
Action                    | Admin | Recruiter | Hiring Manager | Read-Only
--------------------------|-------|-----------|----------------|----------
View pipeline             |  ✓    |    ✓      |      ✓         |    ✓
Move candidates           |  ✓    |    ✓      |      ✗         |    ✗
Add notes                 |  ✓    |    ✓      |      ✓         |    ✗
Bulk actions              |  ✓    |    ✓      |      ✗         |    ✗
Configure stages          |  ✓    |    ✓      |      ✗         |    ✗
Configure automations     |  ✓    |    ✓      |      ✗         |    ✗
View all stages           |  ✓    |    ✓      |   From Interview|    ✓
```

### API Middleware
```python
@require_job_permission("view_pipeline")
async def get_pipeline(job_id: UUID, user: User):
    stages = await get_visible_stages(job_id, user.role)
    return pipeline_data
```

## Sub-Tasks
- [ ] 09.6.a — Implement job-level permission middleware
- [ ] 09.6.b — Implement stage visibility filtering by role
- [ ] 09.6.c — Implement UI action hiding based on role
- [ ] 09.6.d — Write unit tests for all permission combinations

## Testing Strategy
- Unit: Permission matrix for all role/action combinations
- Integration: API returns 403 for unauthorized access
- UI: Action buttons hidden for insufficient roles

## Dependencies
- Epic 12 (Auth/RBAC — role definitions and JWT claims)
