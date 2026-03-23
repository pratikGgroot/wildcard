# Story 12.1: Email & Password Authentication

## User Story
**As a** user  
**I want to** log in with my email and password  
**So that** I can access the platform securely

## BRD Requirements Covered
- BRD Section 11.1: JWT-based API authentication with short expiry (15 min access token)

## Acceptance Criteria
1. **Given** I navigate to the login page  
   **When** I enter valid credentials and click "Sign In"  
   **Then** I receive a JWT access token (15 min expiry) and refresh token (7 days) and am redirected to the dashboard

2. **Given** I enter invalid credentials  
   **When** I click "Sign In"  
   **Then** I see: "Invalid email or password" (no indication of which is wrong)

3. **Given** I fail login 5 times in 10 minutes  
   **When** the 5th failure occurs  
   **Then** my account is temporarily locked for 15 minutes and I receive an email notification

4. **Given** my access token expires  
   **When** I make an API request  
   **Then** the client automatically uses the refresh token to get a new access token

5. **Given** I click "Sign Out"  
   **When** the action completes  
   **Then** my refresh token is revoked and I am redirected to the login page

## Priority
**P0 — Must Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **Access Token Expiry:** 15 minutes (BRD Section 11.1)
- **Refresh Token Expiry:** 7 days; rotated on each use
- **Password Hashing:** bcrypt with cost factor 12
- **Rate Limiting:** 5 failed attempts → 15-minute lockout
- **HTTPS Only:** All auth endpoints require TLS 1.3

### SLA Requirements
- **Login Response:** ≤ 500ms

## Technical Design

### JWT Claims
```json
{
  "sub": "user_uuid",
  "email": "user@example.com",
  "role": "recruiter",
  "org_id": "org_uuid",
  "iat": 1234567890,
  "exp": 1234568790
}
```

### Database Schema
```sql
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  ip_address INET,
  success BOOLEAN NOT NULL,
  attempted_at TIMESTAMP DEFAULT NOW()
);
```

### API Endpoints
```
POST /api/auth/login          — Email/password login
POST /api/auth/refresh        — Refresh access token
POST /api/auth/logout         — Revoke refresh token
POST /api/auth/forgot-password — Send password reset email
POST /api/auth/reset-password  — Reset password with token
```

## Sub-Tasks
- [ ] 12.1.a — Implement login endpoint with bcrypt verification
- [ ] 12.1.b — Implement JWT access + refresh token generation
- [ ] 12.1.c — Implement token refresh endpoint with rotation
- [ ] 12.1.d — Implement rate limiting and account lockout
- [ ] 12.1.e — Implement password reset flow
- [ ] 12.1.f — Build login UI with error handling

## Testing Strategy
- Unit: Password hashing, JWT generation, lockout logic
- Integration: Full login → token → refresh → logout flow
- Security: Brute force protection, token revocation

## Dependencies
- Epic 16 (User management — user records)
