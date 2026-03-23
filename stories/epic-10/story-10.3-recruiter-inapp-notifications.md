# Story 10.3: Recruiter In-App Notifications

## User Story
**As a** recruiter  
**I want to** receive in-app notifications for important events  
**So that** I can stay on top of new applications and AI shortlist readiness without checking manually

## BRD Requirements Covered
- FR-NC-02: Recruiter receives in-app alerts for new applications and AI shortlist readiness

## Acceptance Criteria
1. **Given** a new application is submitted for a job I own  
   **When** the application is created  
   **Then** I receive an in-app notification: "New application: [Candidate Name] for [Job Title]"

2. **Given** the AI shortlist for a job is ready  
   **When** shortlist generation completes  
   **Then** I receive an in-app notification: "AI Shortlist ready for [Job Title] — X candidates recommended"

3. **Given** I have unread notifications  
   **When** I view the notification bell icon  
   **Then** I see a badge with the unread count

4. **Given** I click the notification bell  
   **When** the notification panel opens  
   **Then** I see a list of notifications with: message, timestamp, and a link to the relevant item

5. **Given** I click a notification  
   **When** I am navigated to the relevant item  
   **Then** the notification is marked as read

6. **Given** I have many notifications  
   **When** I click "Mark All as Read"  
   **Then** all notifications are marked read

## Priority
**P0 — Must Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **Delivery:** Real-time via WebSocket; fallback to polling every 30 seconds
- **Retention:** Notifications retained for 30 days
- **Max Unread:** Badge shows "99+" if more than 99 unread
- **Types:** new_application, shortlist_ready, bias_flag, parsing_error, automation_fired

## Technical Design

### Notification Schema
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT,
  link VARCHAR(500),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC)
  WHERE is_read = FALSE;
```

### WebSocket Event
```typescript
// Server pushes to client
{ type: "notification", payload: { id, title, message, link, created_at } }
```

### API Endpoints
```
GET  /api/notifications              — List notifications (filter: unread)
PATCH /api/notifications/:id/read   — Mark as read
POST /api/notifications/mark-all-read — Mark all as read
DELETE /api/notifications/:id        — Delete notification
```

## Sub-Tasks
- [ ] 10.3.a — Implement notification schema and creation service
- [ ] 10.3.b — Implement WebSocket push for real-time delivery
- [ ] 10.3.c — Build notification bell UI with unread badge
- [ ] 10.3.d — Build notification panel with list and mark-read actions
- [ ] 10.3.e — Implement notification triggers for all event types

## Testing Strategy
- Unit: Notification creation, unread count
- Integration: Event → notification → WebSocket push
- Real-time: Verify notification appears within 1 second of event

## Dependencies
- Epic 02 (Resume upload — new_application trigger)
- Epic 05 (Shortlist generation — shortlist_ready trigger)
