# Story 16.1: User Management

## User Story
**As an** HR admin  
**I want to** manage users in my organization  
**So that** I can invite new team members, assign roles, and deactivate users who leave

## BRD Requirements Covered
- BRD Section 12.1: Admin Panel — User management, RBAC
- BRD Section 11.1: RBAC — Admin > Recruiter > Hiring Manager > Read-Only Viewer

## Acceptance Criteria
1. **Given** I am an admin  
   **When** I navigate to User Management  
   **Then** I see a list of all users with: name, email, role, status (active/inactive), and last login

2. **Given** I want to invite a new user  
   **When** I click "Invite User" and enter their email and role  
   **Then** an invitation email is sent with a signup link (expires in 7 days)

3. **Given** a user accepts the invitation  
   **When** they complete signup  
   **Then** their account is created with the assigned role

4. **Given** I want to change a user's role  
   **When** I select a new role and save  
   **Then** the role is updated and takes effect on their next login

5. **Given** a user leaves the organization  
   **When** I deactivate their account  
   **Then** all their active sessions are revoked and they can no longer log in

6. **Given** I want to see a user's activity  
   **When** I click on a user  
   **Then** I see their last login, jobs assigned, and recent actions

## Priority
**P0 — Must Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **Invitation Expiry:** 7 days
- **Deactivation:** Immediate session revocation (all refresh tokens revoked)
- **Audit:** All user management actions logged

## Technical Design

### Database Schema
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(200),
  role VARCHAR(30) CHECK (role IN ('Admin','Recruiter','Hiring Manager','Read-Only Viewer')),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','inactive','invited')),
  invited_by UUID REFERENCES users(id),
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  org_id UUID REFERENCES organizations(id),
  role VARCHAR(30) NOT NULL,
  token VARCHAR(64) UNIQUE NOT NULL,
  invited_by UUID REFERENCES users(id),
  expires_at TIMESTAMP NOT NULL,
  accepted_at TIMESTAMP
);
```

### API Endpoints
```
GET  /api/admin/users              — List users
POST /api/admin/users/invite       — Invite new user
PUT  /api/admin/users/:id/role     — Change user role
POST /api/admin/users/:id/deactivate — Deactivate user
POST /api/admin/users/:id/reactivate — Reactivate user
GET  /api/invitations/:token       — Get invitation details (public)
POST /api/invitations/:token/accept — Accept invitation
```

## Sub-Tasks
- [ ] 16.1.a — Build user management list UI with filters
- [ ] 16.1.b — Implement user invitation flow with email
- [ ] 16.1.c — Implement role change with session invalidation
- [ ] 16.1.d — Implement user deactivation with session revocation
- [ ] 16.1.e — Build invitation acceptance flow

## Testing Strategy
- Unit: Invitation expiry, deactivation session revocation
- Integration: Full invite → accept → login flow
- Security: Deactivated user cannot log in

## Dependencies
- Epic 12 (Auth — session revocation on deactivation)
- Epic 10 (Notifications — invitation email)
