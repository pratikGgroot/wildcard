# Story 15.4: Slack Integration for Recruiter Notifications

## User Story
**As a** recruiter  
**I want to** receive hiring platform notifications in Slack  
**So that** I can stay informed without switching to the platform constantly

## BRD Requirements Covered
- BRD Section 10: Slack — Recruiter notifications (Good to Have)

## Acceptance Criteria
1. **Given** I connect my Slack workspace  
   **When** I configure notification preferences  
   **Then** I can select which events trigger Slack messages (new application, shortlist ready, bias flag)

2. **Given** a new application arrives for my job  
   **When** the Slack notification fires  
   **Then** I receive a message in my configured channel with: candidate name, job title, fit score, and a link to the profile

3. **Given** the AI shortlist is ready  
   **When** the Slack notification fires  
   **Then** I receive a message: "AI Shortlist ready for [Job Title] — X candidates recommended" with a link

4. **Given** I disconnect Slack  
   **When** disconnection is confirmed  
   **Then** the OAuth token is revoked and no further Slack messages are sent

## Priority
**P3 — Good to Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **OAuth:** Slack OAuth 2.0 with `chat:write` scope
- **Message Format:** Slack Block Kit for rich formatting
- **Rate Limits:** Respect Slack API rate limits (1 message/second per channel)
- **Fallback:** If Slack is unavailable, in-app notification is still sent

## Technical Design

### Slack Message (Block Kit)
```json
{
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*New Application* — John Smith applied for *Senior Backend Engineer*\nFit Score: *78/100* | Stage: Applied"
      }
    },
    {
      "type": "actions",
      "elements": [
        { "type": "button", "text": { "type": "plain_text", "text": "View Profile" }, "url": "https://app.example.com/candidates/uuid" }
      ]
    }
  ]
}
```

### API Endpoints
```
GET  /api/integrations/slack/status      — Get Slack connection status
POST /api/integrations/slack/connect     — Initiate Slack OAuth
GET  /api/integrations/slack/callback    — OAuth callback
DELETE /api/integrations/slack           — Disconnect Slack
PUT  /api/integrations/slack/preferences — Configure notification preferences
```

## Sub-Tasks
- [ ] 15.4.a — Implement Slack OAuth flow
- [ ] 15.4.b — Implement Slack message sending with Block Kit
- [ ] 15.4.c — Implement notification preference configuration for Slack
- [ ] 15.4.d — Build Slack integration settings UI

## Testing Strategy
- Unit: Message formatting, preference filtering
- Integration: Full OAuth → notification flow with test Slack workspace

## Dependencies
- Story 10.3 (In-app notifications — same event triggers)
- Epic 16 (Admin settings — integration configuration)
