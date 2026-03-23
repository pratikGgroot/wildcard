# Story 12.7: Session Management

## User Story
**As a** user  
**I want to** manage my active sessions  
**So that** I can see where I'm logged in and revoke sessions I don't recognize

## BRD Requirements Covered
- BRD Section 7.4: Security — session management
- BRD Section 11.1: JWT-based authentication with refresh tokens

## Acceptance Criteria
1. **Given** I am logged in  
   **When** I navigate to "Active Sessions" in my profile  
   **Then** I see a list of active sessions with: device type, browser, IP address, location, and last active time

2. **Given** I see a session I don't recognize  
   **When** I click "Revoke"  
   **Then** that session's refresh token is invalidated and the user is logged out on that device

3. **Given** I click "Sign Out All Devices"  
   **When** I confirm  
   **Then** all refresh tokens are revoked and I am logged out everywhere

4. **Given** a session has been inactive for 30 days  
   **When** the cleanup job runs  
   **Then** the session is automatically expired

## Priority
**P0 — Must Have**

## Estimated Effort
**3 story points**

## NFR / Tech Notes
- **Session Tracking:** Each refresh token represents one session
- **Device Detection:** User-Agent parsing for device/browser info
- **Geo-IP:** IP-to-location lookup for session display (approximate city/country)
- **Auto-Expiry:** Sessions inactive for 30 days are automatically cleaned up

## Technical Design

### Session Schema (extends refresh_tokens)
```sql
ALTER TABLE refresh_tokens ADD COLUMN device_info JSONB;
ALTER TABLE refresh_tokens ADD COLUMN ip_address INET;
ALTER TABLE refresh_tokens ADD COLUMN last_used_at TIMESTAMP;
```

### API Endpoints
```
GET    /api/auth/sessions              — List active sessions
DELETE /api/auth/sessions/:id          — Revoke specific session
DELETE /api/auth/sessions              — Revoke all sessions
```

## Sub-Tasks
- [ ] 12.7.a — Implement session tracking with device/IP info
- [ ] 12.7.b — Build active sessions UI
- [ ] 12.7.c — Implement session revocation (single and all)
- [ ] 12.7.d — Implement 30-day auto-expiry cleanup job

## Testing Strategy
- Unit: Session expiry, revocation
- Integration: Revoke session → subsequent requests return 401

## Dependencies
- Story 12.4 (JWT token management — refresh tokens)
