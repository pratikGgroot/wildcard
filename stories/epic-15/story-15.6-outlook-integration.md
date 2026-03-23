# Story 15.6: Outlook / Microsoft 365 Integration

## User Story
**As a** recruiter  
**I want to** connect my Outlook account to the platform  
**So that** I can send candidate emails from my Outlook address

## BRD Requirements Covered
- BRD Section 10: Outlook / Microsoft 365 — OAuth, email sending (Good to Have)

## Acceptance Criteria
1. **Given** I click "Connect Outlook"  
   **When** I complete the Microsoft OAuth flow  
   **Then** my Outlook account is connected and shown as active in settings

2. **Given** my Outlook is connected  
   **When** I send an email to a candidate  
   **Then** it is sent via Microsoft Graph API from my Outlook address

3. **Given** my Outlook token expires  
   **When** I try to send an email  
   **Then** the token is refreshed automatically; if refresh fails, I am prompted to reconnect

4. **Given** I disconnect Outlook  
   **When** disconnection is confirmed  
   **Then** the token is revoked and future emails use platform SES

## Priority
**P3 — Good to Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **OAuth:** Microsoft Identity Platform (MSAL)
- **Scopes:** `Mail.Send`
- **API:** Microsoft Graph API v1.0
- **Rate Limits:** 10,000 emails/day per user
- **Token Storage:** Encrypted at rest (AES-256)

## Technical Design

### Microsoft Graph Email Send
```python
async def send_via_outlook(access_token: str, to: str, subject: str, body_html: str):
    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
    payload = {
        "message": {
            "subject": subject,
            "body": {"contentType": "HTML", "content": body_html},
            "toRecipients": [{"emailAddress": {"address": to}}]
        }
    }
    async with httpx.AsyncClient() as client:
        await client.post(
            "https://graph.microsoft.com/v1.0/me/sendMail",
            headers=headers,
            json=payload
        )
```

### API Endpoints
```
POST /api/integrations/outlook/connect    — Initiate Microsoft OAuth
GET  /api/integrations/outlook/callback   — OAuth callback
DELETE /api/integrations/outlook          — Disconnect Outlook
GET  /api/integrations/outlook/status     — Connection status
```

## Sub-Tasks
- [ ] 15.6.a — Implement Microsoft OAuth (MSAL) flow
- [ ] 15.6.b — Implement Microsoft Graph API email sending
- [ ] 15.6.c — Implement token refresh and reconnect flow
- [ ] 15.6.d — Build Outlook connection UI in settings

## Testing Strategy
- Unit: Token refresh, fallback behavior
- Integration: OAuth flow and email sending with test Microsoft 365 account
- Security: Verify tokens encrypted at rest

## Dependencies
- Story 10.2 (Candidate emails — uses Outlook when connected)
- Story 10.5 (Gmail/Outlook integration — shared OAuth infrastructure)
