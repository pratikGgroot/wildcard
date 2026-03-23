# Epic 10: Notifications & Communication

## Overview
Build automated notification system for candidates and recruiters with configurable email templates and multi-channel delivery.

## Business Value
- Keeps candidates informed of application status
- Alerts recruiters to important events
- Reduces manual communication overhead

## BRD Requirements Covered
- FR-NC-01: Automated email notifications on status changes
- FR-NC-02: In-app alerts for recruiters
- FR-NC-03: Configurable email templates
- FR-NC-04: Gmail/Outlook integration

## Priority
**HIGH**

## NFR / Tech Notes
- **Delivery SLA:** Emails sent within 5 minutes of trigger event
- **Email Service:** SendGrid, AWS SES, or Postmark
- **Rate Limiting:** Max 100 emails/minute per sender
- **Template Engine:** Handlebars or Jinja2
- **Unsubscribe:** GDPR-compliant unsubscribe mechanism

### SLA Requirements
- **Email Delivery:** ≤5 minutes from trigger event
- **In-app Notification:** Real-time (≤1 second)
- **Delivery Success Rate:** ≥99%

## Technical Design

### Notification Types
```typescript
enum NotificationType {
  // Candidate notifications
  APPLICATION_RECEIVED = 'application_received',
  STATUS_CHANGED = 'status_changed',
  INTERVIEW_SCHEDULED = 'interview_scheduled',
  OFFER_EXTENDED = 'offer_extended',
  REJECTION = 'rejection',
  
  // Recruiter notifications
  NEW_APPLICATION = 'new_application',
  SHORTLIST_READY = 'shortlist_ready',
  INTERVIEW_FEEDBACK_PENDING = 'interview_feedback_pending',
  JOB_ASSIGNED = 'job_assigned'
}
```

### Database Schema
```sql
CREATE TABLE notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name VARCHAR(100) NOT NULL,
  notification_type VARCHAR(50) NOT NULL,
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  scope VARCHAR(20) DEFAULT 'organization', -- organization or job-specific
  job_id UUID REFERENCES jobs(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID REFERENCES users(id),
  notification_type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT,
  link VARCHAR(500),
  priority VARCHAR(20) DEFAULT 'normal',
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email VARCHAR(200) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  template_id UUID REFERENCES notification_templates(id),
  status VARCHAR(20) DEFAULT 'queued', -- queued, sent, failed
  sent_at TIMESTAMP,
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_id, created_at DESC);
CREATE INDEX idx_email_queue_status ON email_queue(status);
```

## Stories
- Story 10.1: Email Template Management
- Story 10.2: Candidate Status Change Emails
- Story 10.3: Recruiter In-App Notifications
- Story 10.4: Email Queue and Delivery Service
- Story 10.5: Gmail/Outlook Integration
- Story 10.6: Notification Preferences
- Story 10.7: Unsubscribe Management

## Estimated Effort
**15-18 story points** (2-3 sprints)

## Success Metrics
- Email delivery within 5 minutes (P95)
- Email delivery success rate ≥99%
- Unsubscribe rate <2%
- In-app notification delivery ≤1 second
