# Story 15.5: Gmail Integration

## User Story
**As a** recruiter  
**I want to** connect my Gmail account to the platform  
**So that** I can send candidate emails from my own Gmail address

## BRD Requirements Covered
- BRD Section 10: Gmail / Google Workspace — OAuth, email sending (Good to Have)

## Acceptance Criteria
1. **Given** I click "Connect Gmail"  
   **When** I complete the Google OAuth flow  
   **Then** my Gmail account is connected and shown as active in settings

2. **Given** my Gmail is connected  
   **When** I send an email to a candidate  
   **Then** it is sent via Gmail API from my address (not platform SES)

3. **Given** my Gmail token expires  
   **When** I try to send an email  
   **Then** the token is refreshed automatically; if refresh fails, I am prompted to reconnect

4. **Given** I disconnect Gmail  
   **When** disconnection is confirmed  
   **Then** the token is revoked and future emails use platform SES

## Priority
**P3 — Good to Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **OAuth Scopes:** `https://www.googleapis.com/auth/gmail.send`
- **Token Storage:** Encrypted at rest (AES-256)
- **Rate Limits:** Gmail API: 500 emails/day per user
- **Fallback:** Platform SES if Gmail not connected or token invalid

## Technical Design

### Gmail Send
```python
async def send_via_gmail(access_token: str, to: str, subject: str, body_html: str):
    service = build('gmail', 'v1', credentials=Credentials(token=access_token))
    message = MIMEMultipart('alternative')
    message['to'] = to
    message['subject'] = subject
    message.attach(MIMEText(body_html, 'html'))
    
    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
    service.users().messages().send(userId='me', body={'raw': raw}).execute()
```

### API Endpoints
```
POST /api/integrations/gmail/connect    — Initiate Gmail OAuth
GET  /api/integrations/gmail/callback   — OAuth callback
DELETE /api/integrations/gmail          — Disconnect Gmail
GET  /api/integrations/gmail/status     — Connection status
```

## Sub-Tasks
- [ ] 15.5.a — Implement Google OAuth flow for Gmail
- [ ] 15.5.b — Implement Gmail API email sending
- [ ] 15.5.c — Implement token refresh and reconnect flow
- [ ] 15.5.d — Build Gmail connection UI in settings

## Testing Strategy
- Unit: Token refresh logic, fallback behavior
- Integration: OAuth flow and email sending with test Gmail account
- Security: Verify tokens encrypted at rest

## Dependencies
- Story 10.2 (Candidate emails — uses Gmail when connected)
- Story 10.5 (Gmail/Outlook integration — shared OAuth infrastructure)
