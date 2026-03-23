# Story 16.2: RBAC Configuration

## User Story
**As an** admin  
**I want to** configure role permissions for my organization  
**So that** I can customize what each role can do beyond the defaults

## BRD Requirements Covered
- BRD Section 11.1: RBAC — Admin > Recruiter > Hiring Manager > Read-Only Viewer
- BRD Section 12.1: Admin Panel — RBAC configuration

## Acceptance Criteria
1. **Given** I navigate to RBAC Configuration  
   **When** the page loads  
   **Then** I see the 4 default roles with their current permission sets

2. **Given** I want to customize a role  
   **When** I toggle a permission for a role  
   **Then** the change is saved and takes effect on the next login for users with that role

3. **Given** I want to create a custom role  
   **When** I click "Create Role"  
   **Then** I can name it and select permissions from the full permission list

4. **Given** a custom role is created  
   **When** I invite a user  
   **Then** the custom role appears in the role selection dropdown

5. **Given** I delete a custom role  
   **When** users are assigned to it  
   **Then** I am prompted to reassign them before deletion

## Priority
**P0 — Must Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **Default Roles:** Cannot be deleted; permissions can be adjusted within bounds
- **Custom Roles:** Up to 10 custom roles per org
- **Permission Granularity:** Resource-level (jobs:read, candidates:write, etc.)
- **Audit:** All RBAC changes logged

## Technical Design

### Custom Role Schema
```sql
CREATE TABLE custom_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  name VARCHAR(50) NOT NULL,
  permissions TEXT[] NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### API Endpoints
```
GET  /api/admin/roles              — List all roles (default + custom)
POST /api/admin/roles              — Create custom role
PUT  /api/admin/roles/:id          — Update role permissions
DELETE /api/admin/roles/:id        — Delete custom role (with user reassignment check)
```

## Sub-Tasks
- [ ] 16.2.a — Build RBAC configuration UI with permission toggles
- [ ] 16.2.b — Implement custom role creation and management
- [ ] 16.2.c — Implement permission change propagation
- [ ] 16.2.d — Implement role deletion with user reassignment flow

## Testing Strategy
- Unit: Permission change propagation, deletion guard
- Integration: Custom role → assign to user → verify permissions

## Dependencies
- Story 16.1 (User management — role assignment)
- Epic 12 (RBAC middleware — uses role permissions)
