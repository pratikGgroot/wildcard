# Story 10.5: Gmail / Outlook Integration for Email Sending

## User Story
**As a** recruiter  
**I want to** send emails to candidates directly from my Gmail or Outlook account  
**So that** emails come from my personal work address rather than a platform no-reply address

## BRD Requirements Covered
- FR-NC-04: Integration with Gmail / Outlook for sending emails directly from the platform
- BRD Section 10: Gmail / Google Workspace — OAuth, email sending (Good to Have); Outlook / Microsoft 365 — OAuth, email sending (Good to Have)

## Acceptance Criteria
1. **Given** I want to connect my Gmail account  
   **When** I click "Connect Gmail" in settings  
   **Then** I am redirected to Google OAuth consent screen; on approval my account is connected

2. **Given** my Gmail is connected  
   **When** I send an email to a candidate  
   **Then** the email is sent from my Gmail address (not a platform no-reply)

3. **Given** my Outlook is connected  
   **When** I send an email  
   **Then** the email is sent via Microsoft Graph API from my Outlook address

4. **Given** my connected account token expires  
   **When** I try to send an email  
   **Then** the token is automatically refreshed; if refresh fails, I am prompted to reconnect

5. **Given** I disconnect my email account  
   **When** disconnection is confirmed  
   **Then** the OAuth tokens are revoked and deleted; future emails fall back to platform SES

## Priority
**P3 — Good to Have**

## Estimated Effort
**8 story points**

## NFR / Tech Notes
- **OAuth Scopes:** Gmail: `gmail.send`; Outlook: `Mail.Send`
- **Token Storage:** Encrypted at rest (AES-256); never exposed in API responses
- **Fallback:** If personal account not connected, use platform SES
- **Rate Limits:** Respect Gmail (500/day) and Outlook (10,000/day) sending limits

## Technical Design

### OAuth Token Storage
```sql
CREATE TABLE user_email_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(20) CHECK (provider IN ('gmail','outlook')),
  email_address VARCHAR(255) NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  token_expires_at TIMESTAMP,
  connected_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);
```

### API Endpoints
```
GET  /api/integrations/email/status        — Get connected email accounts
POST /api/integrations/gmail/connect       — Initiate Gmail OAuth
POST /api/integrations/outlook/connect     — Initiate Outlook OAuth
GET  /api/integrations/email/callback      — OAuth callback handler
DELETE /api/integrations/email/:provider   — Disconnect account
```

## Sub-Tasks
- [ ] 10.5.a — Implement Gmail OAuth flow and token storage
- [ ] 10.5.b — Implement Outlook OAuth flow and token storage
- [ ] 10.5.c — Implement email sending via Gmail API
- [ ] 10.5.d — Implement email sending via Microsoft Graph API
- [ ] 10.5.e — Implement token refresh and reconnect flow
- [ ] 10.5.f — Implement fallback to platform SES when not connected

## Testing Strategy
- Unit: Token refresh logic, fallback behavior
- Integration: OAuth flow with test Gmail/Outlook accounts
- Security: Verify tokens are encrypted at rest

## Dependencies
- Epic 15 (External integrations — OAuth infrastructure)
- Epic 16 (Admin settings — integration configuration)
