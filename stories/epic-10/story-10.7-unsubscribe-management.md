# Story 10.7: Candidate Unsubscribe Management

## User Story
**As a** candidate  
**I want to** unsubscribe from email notifications  
**So that** I stop receiving emails from the platform if I'm no longer interested

## BRD Requirements Covered
- BRD Section 11.2: GDPR compliance — consent management and right to opt out
- FR-NC-01: Automated emails must respect unsubscribe preferences

## Acceptance Criteria
1. **Given** a candidate receives an email  
   **When** they click the "Unsubscribe" link in the footer  
   **Then** they are taken to a confirmation page and their email is added to the suppression list

2. **Given** a candidate is on the suppression list  
   **When** an email would be sent to them  
   **Then** the email is suppressed and the suppression is logged

3. **Given** a candidate wants to re-subscribe  
   **When** they visit the unsubscribe management page  
   **Then** they can re-enable emails

4. **Given** an email bounces  
   **When** the bounce event is received  
   **Then** the email is automatically added to the suppression list

5. **Given** a compliance officer needs to audit suppression  
   **When** they access the suppression list  
   **Then** they see: email, reason (unsubscribe/bounce/complaint), and date

## Priority
**P0 — Must Have**

## Estimated Effort
**3 story points**

## NFR / Tech Notes
- **Unsubscribe Link:** One-click unsubscribe (no login required) — CAN-SPAM / GDPR requirement
- **Token:** Unsubscribe link uses a signed token (not email address in URL)
- **Suppression List:** Checked before every outbound email

## Technical Design

### Suppression Schema
```sql
CREATE TABLE email_suppressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  reason VARCHAR(20) CHECK (reason IN ('unsubscribe','bounce','complaint','manual')),
  added_at TIMESTAMP DEFAULT NOW(),
  removed_at TIMESTAMP
);

CREATE INDEX idx_suppressions_email ON email_suppressions(email) WHERE removed_at IS NULL;
```

### Unsubscribe Token
```python
def generate_unsubscribe_token(email: str) -> str:
    return jwt.encode({"email": email, "exp": now() + timedelta(days=365)}, SECRET_KEY)
```

### API Endpoints
```
GET  /api/unsubscribe/:token    — Unsubscribe page (no auth)
POST /api/unsubscribe/:token    — Confirm unsubscribe
POST /api/resubscribe/:token    — Re-subscribe
GET  /api/admin/suppressions    — List suppression list (admin only)
```

## Sub-Tasks
- [ ] 10.7.a — Implement suppression list schema and check
- [ ] 10.7.b — Implement unsubscribe token generation and validation
- [ ] 10.7.c — Build unsubscribe confirmation page (no auth required)
- [ ] 10.7.d — Implement re-subscribe flow
- [ ] 10.7.e — Add unsubscribe link to all outbound email templates

## Testing Strategy
- Unit: Token validation, suppression check
- Integration: Unsubscribe → suppression → email suppressed
- Compliance: Verify one-click unsubscribe works without login

## Dependencies
- Story 10.2 (Candidate emails — checks suppression list)
- Story 10.4 (Email queue — bounce events add to suppression)
