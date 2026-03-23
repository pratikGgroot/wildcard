# Story 10.6: Notification Preferences

## User Story
**As a** recruiter  
**I want to** configure which notifications I receive and how  
**So that** I only get alerts that are relevant to me

## BRD Requirements Covered
- FR-NC-02: Recruiter receives in-app alerts (configurable)

## Acceptance Criteria
1. **Given** I navigate to my notification preferences  
   **When** the page loads  
   **Then** I see a list of notification types with toggles for in-app and email delivery

2. **Given** I disable a notification type  
   **When** that event occurs  
   **Then** I do not receive that notification

3. **Given** I configure email digest  
   **When** I select "Daily Digest"  
   **Then** instead of individual emails, I receive one daily summary email

4. **Given** I am on vacation  
   **When** I enable "Do Not Disturb" mode  
   **Then** all notifications are suppressed until I disable it

## Priority
**P1 — Should Have**

## Estimated Effort
**3 story points**

## NFR / Tech Notes
- **Preference Scope:** Per-user settings
- **Default:** All notifications enabled by default
- **Digest:** Daily digest sent at 8 AM in user's timezone

## Technical Design

### Preferences Schema
```sql
CREATE TABLE notification_preferences (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE PRIMARY KEY,
  new_application_inapp BOOLEAN DEFAULT TRUE,
  new_application_email BOOLEAN DEFAULT FALSE,
  shortlist_ready_inapp BOOLEAN DEFAULT TRUE,
  shortlist_ready_email BOOLEAN DEFAULT TRUE,
  bias_flag_inapp BOOLEAN DEFAULT TRUE,
  bias_flag_email BOOLEAN DEFAULT TRUE,
  email_digest_mode VARCHAR(20) DEFAULT 'immediate' CHECK (email_digest_mode IN ('immediate','daily','weekly','off')),
  do_not_disturb BOOLEAN DEFAULT FALSE,
  timezone VARCHAR(50) DEFAULT 'UTC'
);
```

### API Endpoints
```
GET  /api/users/me/notification-preferences   — Get preferences
PUT  /api/users/me/notification-preferences   — Update preferences
```

## Sub-Tasks
- [ ] 10.6.a — Build notification preferences UI
- [ ] 10.6.b — Implement preference checks in notification delivery
- [ ] 10.6.c — Implement daily digest aggregation and sending

## Testing Strategy
- Unit: Preference checks, digest aggregation
- Integration: Notification suppressed when preference disabled

## Dependencies
- Story 10.3 (In-app notifications — respects preferences)
- Story 10.2 (Candidate emails — respects preferences)
