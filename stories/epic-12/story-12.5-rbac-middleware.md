# Story 12.5: RBAC Middleware

## User Story
**As a** system  
**I want to** enforce role-based access control at the API layer  
**So that** users can only access resources and perform actions permitted by their role

## BRD Requirements Covered
- BRD Section 11.1: RBAC — Admin > Recruiter > Hiring Manager > Read-Only Viewer
- BRD Section 7.4: Role-Based Access Control enforced at API and UI layer

## Acceptance Criteria
1. **Given** a recruiter tries to access an admin-only endpoint  
   **When** the request is made  
   **Then** a 403 Forbidden response is returned

2. **Given** a hiring manager tries to move a candidate  
   **When** the request is made  
   **Then** a 403 Forbidden response is returned

3. **Given** a user's role is changed  
   **When** they make their next API request  
   **Then** the new role permissions are enforced (JWT re-issued on next login)

4. **Given** an admin makes a request  
   **When** the request is processed  
   **Then** they have access to all resources in their organization

5. **Given** a user accesses a resource in another organization  
   **When** the request is made  
   **Then** a 403 Forbidden response is returned (org isolation)

## Priority
**P0 — Must Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **Role Hierarchy:** Admin > Recruiter > Hiring Manager > Read-Only Viewer
- **Org Isolation:** All resources scoped to org_id from JWT claims
- **Performance:** RBAC check ≤ 5ms (in-memory role definitions)
- **Granularity:** Resource-level permissions (not just role-level)

## Technical Design

### Permission Definitions
```python
PERMISSIONS = {
    "Admin": ["*"],  # All permissions
    "Recruiter": [
        "jobs:read", "jobs:write", "jobs:assign",
        "candidates:read", "candidates:write",
        "pipeline:read", "pipeline:write",
        "analytics:read", "interview_kit:write"
    ],
    "Hiring Manager": [
        "jobs:read",
        "candidates:read",
        "pipeline:read",
        "notes:write",
        "interview_kit:read"
    ],
    "Read-Only Viewer": [
        "jobs:read", "candidates:read", "pipeline:read"
    ]
}

def require_permission(permission: str):
    def decorator(func):
        async def wrapper(*args, user: User, **kwargs):
            if not has_permission(user.role, permission):
                raise HTTPException(403, "Insufficient permissions")
            return await func(*args, user=user, **kwargs)
        return wrapper
    return decorator
```

### API Endpoints
```
GET /api/auth/permissions   — Get current user's permissions (for UI rendering)
```

## Sub-Tasks
- [ ] 12.5.a — Define permission matrix for all roles and resources
- [ ] 12.5.b — Implement RBAC middleware decorator
- [ ] 12.5.c — Apply middleware to all protected endpoints
- [ ] 12.5.d — Implement org isolation check
- [ ] 12.5.e — Write unit tests for all role/permission combinations

## Testing Strategy
- Unit: Permission matrix — all role/action combinations
- Integration: 403 responses for unauthorized access
- Security: Org isolation — user cannot access another org's data

## Dependencies
- Story 12.4 (JWT — role claims in token)
