# Epic 12: Authentication & Authorization

## Overview
Implement secure authentication with SSO support, MFA, and comprehensive role-based access control (RBAC) system.

## Business Value
- Ensures secure access to sensitive candidate data
- Supports enterprise SSO requirements
- Enables granular permission management

## BRD Requirements Covered
- NFR 11.1: SSO via SAML 2.0 / OIDC
- NFR 11.1: MFA for admin accounts
- NFR 11.1: JWT-based API authentication
- NFR 11.1: RBAC (Admin > Recruiter > Hiring Manager > Viewer)
- FR-PL-05: Role-based access control

## Priority
**CRITICAL** - Security foundation

## NFR / Tech Notes
- **SSO Providers:** Okta, Google Workspace, Azure AD
- **MFA:** TOTP (Google Authenticator) or SMS
- **Token Expiry:** 15-minute access tokens, 7-day refresh tokens
- **Session Management:** Redis for session storage
- **Password Policy:** Min 12 chars, complexity requirements

### SLA Requirements
- **Login Response:** ≤2 seconds
- **SSO Redirect:** ≤3 seconds
- **Token Refresh:** ≤500ms
- **Availability:** 99.99% uptime

## Technical Design

### RBAC Model
```typescript
enum Role {
  ADMIN = 'admin',
  RECRUITER = 'recruiter',
  HIRING_MANAGER = 'hiring_manager',
  VIEWER = 'viewer'
}

interface Permission {
  resource: string; // jobs, candidates, analytics, settings
  actions: ('create' | 'read' | 'update' | 'delete')[];
}

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    { resource: '*', actions: ['create', 'read', 'update', 'delete'] }
  ],
  recruiter: [
    { resource: 'jobs', actions: ['create', 'read', 'update'] },
    { resource: 'candidates', actions: ['create', 'read', 'update'] },
    { resource: 'analytics', actions: ['read'] }
  ],
  hiring_manager: [
    { resource: 'jobs', actions: ['read'] },
    { resource: 'candidates', actions: ['read', 'update'] },
    { resource: 'analytics', actions: ['read'] }
  ],
  viewer: [
    { resource: 'jobs', actions: ['read'] },
    { resource: 'candidates', actions: ['read'] },
    { resource: 'analytics', actions: ['read'] }
  ]
};
```

### Database Schema
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(200) UNIQUE NOT NULL,
  password_hash VARCHAR(255), -- Null for SSO-only users
  role VARCHAR(50) NOT NULL,
  
  -- SSO
  sso_provider VARCHAR(50),
  sso_id VARCHAR(200),
  
  -- MFA
  mfa_enabled BOOLEAN DEFAULT false,
  mfa_secret VARCHAR(100),
  
  -- Status
  active BOOLEAN DEFAULT true,
  email_verified BOOLEAN DEFAULT false,
  last_login TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  access_token_hash VARCHAR(255) NOT NULL,
  refresh_token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  ip_address VARCHAR(50),
  user_agent TEXT,
  success BOOLEAN,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
```

### JWT Token Structure
```json
{
  "sub": "user_id",
  "email": "user@example.com",
  "role": "recruiter",
  "permissions": ["jobs:read", "jobs:create", "candidates:read"],
  "iat": 1234567890,
  "exp": 1234568790
}
```

## Stories
- Story 12.1: Email/Password Authentication
- Story 12.2: SSO Integration (SAML/OIDC)
- Story 12.3: MFA Implementation
- Story 12.4: JWT Token Management
- Story 12.5: RBAC Middleware
- Story 12.6: Permission Checking
- Story 12.7: Session Management
- Story 12.8: Audit Logging

## Estimated Effort
**21-26 story points** (3-4 sprints)

## Success Metrics
- Login success rate ≥99.5%
- Zero unauthorized access incidents
- SSO integration success rate ≥95%
- MFA adoption ≥80% for admins
