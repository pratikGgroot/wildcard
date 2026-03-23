# Story 12.8: Authentication Audit Logging

## User Story
**As a** security admin  
**I want to** see a log of all authentication events  
**So that** I can detect suspicious activity and investigate security incidents

## BRD Requirements Covered
- BRD Section 7.4: Security — audit logging
- BRD Section 11.2: SOC 2 Type II — security controls audit

## Acceptance Criteria
1. **Given** any authentication event occurs (login, logout, MFA, SSO, token refresh, failed attempt)  
   **When** the event happens  
   **Then** it is logged with: event type, user ID, IP address, user agent, timestamp, and success/failure

2. **Given** an admin views the auth audit log  
   **When** they filter by user or date range  
   **Then** matching events are returned within 2 seconds

3. **Given** multiple failed login attempts occur from the same IP  
   **When** 10+ failures occur within 1 hour  
   **Then** an alert is sent to the security admin

4. **Given** a user logs in from a new country  
   **When** the login is detected  
   **Then** an email alert is sent to the user: "New login from [Country]"

## Priority
**P0 — Must Have**

## Estimated Effort
**3 story points**

## NFR / Tech Notes
- **Retention:** Auth logs retained for 5 years (SOC 2 requirement)
- **Immutability:** Append-only; no updates or deletes
- **Alert Threshold:** 10 failed attempts from same IP in 1 hour

## Technical Design

### Auth Audit Schema
```sql
CREATE TABLE auth_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  event_type VARCHAR(30) NOT NULL,  -- 'login', 'logout', 'mfa_verify', 'sso_login', 'token_refresh', 'login_failed', 'account_locked'
  success BOOLEAN NOT NULL,
  ip_address INET,
  user_agent TEXT,
  country_code VARCHAR(2),
  created_at TIMESTAMP DEFAULT NOW()
) PARTITION BY RANGE (created_at);
```

### API Endpoints
```
GET /api/admin/auth-audit-logs   — List auth events (filter: user, date, event_type)
```

## Sub-Tasks
- [ ] 12.8.a — Implement auth event logging for all auth flows
- [ ] 12.8.b — Implement suspicious activity detection (IP-based)
- [ ] 12.8.c — Implement new-country login alert
- [ ] 12.8.d — Build auth audit log UI for security admins

## Testing Strategy
- Unit: Event logging for all auth flows, alert threshold
- Integration: Auth events appear in log within 1 second
- Security: Verify log is append-only

## Dependencies
- Stories 12.1–12.3 (Auth flows — event sources)
- Epic 10 (Notifications — security alert emails)
