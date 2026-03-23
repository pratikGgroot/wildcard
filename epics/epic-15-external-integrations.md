# Epic 15: External Integrations

## Overview
Implement integrations with external platforms including LinkedIn, job boards (Indeed, Naukri, LinkedIn Jobs), file storage (AWS S3/GCS), and communication tools (Slack). These integrations enable seamless data flow between the platform and the broader hiring ecosystem.

## Business Value
- Eliminates manual data entry from LinkedIn profiles
- Enables inbound applications from major job boards automatically
- Centralizes recruiter notifications across communication channels

## BRD Requirements Covered
- Section 10: LinkedIn Import (OAuth + Profile API) — Should Have
- Section 10: AWS S3 / GCS file storage — Must Have
- Section 10: Job Boards (Indeed, Naukri, LinkedIn Jobs) inbound webhook — Should Have
- Section 10: Slack recruiter notifications — Good to Have
- Section 10: Gmail / Google Workspace email sending — Good to Have
- Section 10: Outlook / Microsoft 365 email sending — Good to Have

## Priority
**HIGH** — File storage is critical; LinkedIn and job boards are Phase 1 should-haves

## Dependencies
- Epic 02 (Resume Ingestion — file storage underpins parsing)
- Epic 10 (Notifications — email integrations)
- Epic 12 (Auth — OAuth flows)

## NFR / Tech Notes
- **File Storage SLA:** S3/GCS upload must complete within 5 seconds for files ≤10MB
- **Webhook Latency:** Inbound job board applications processed within 30 seconds of receipt
- **OAuth Security:** All OAuth tokens stored encrypted; refresh tokens rotated every 30 days
- **Rate Limits:** LinkedIn API: 500 calls/day; respect per-integration rate limits with backoff
- **Availability:** File storage 99.99% availability (S3 SLA)
- **Retry Logic:** Failed webhook deliveries retried up to 5 times with exponential backoff

### SLA Requirements
- **S3/GCS Upload:** ≤5 seconds for files ≤10MB
- **Webhook Processing:** ≤30 seconds end-to-end
- **LinkedIn Profile Import:** ≤10 seconds per profile
- **Slack Notification Delivery:** ≤5 seconds

## Technical Design

### Integration Architecture
```
┌─────────────────────────────────────────────────────┐
│              Integration Service                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ LinkedIn │ │Job Board │ │  Slack   │            │
│  │ Adapter  │ │ Webhook  │ │ Adapter  │            │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘            │
└───────┼────────────┼────────────┼────────────────────┘
        │            │            │
┌───────▼────────────▼────────────▼────────────────────┐
│              Message Queue (SQS/Kafka)                │
└──────────────────────────────────────────────────────┘
        │
┌───────▼──────────────────────────────────────────────┐
│         Core Platform Services                        │
│  (Candidate Svc, Job Svc, Notification Svc)          │
└──────────────────────────────────────────────────────┘
```

### OAuth Token Storage
```sql
CREATE TABLE oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,  -- linkedin, google, microsoft, slack
  access_token TEXT NOT NULL,     -- encrypted
  refresh_token TEXT,             -- encrypted
  token_expiry TIMESTAMP,
  scopes TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_oauth_tokens_user_provider ON oauth_tokens(user_id, provider);
```

### Webhook Ingestion Schema
```sql
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR(50) NOT NULL,    -- indeed, naukri, linkedin_jobs
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',  -- pending, processed, failed
  retry_count INTEGER DEFAULT 0,
  processed_at TIMESTAMP,
  error TEXT,
  received_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_webhook_events_status ON webhook_events(status, received_at);
```

## Stories
- [Story 15.1: AWS S3 / GCS File Storage](stories/epic-15/story-15.1-file-storage.md)
- [Story 15.2: LinkedIn Profile Import](stories/epic-15/story-15.2-linkedin-import.md)
- [Story 15.3: Job Board Webhook Ingestion](stories/epic-15/story-15.3-job-board-webhooks.md)
- [Story 15.4: Slack Notifications Integration](stories/epic-15/story-15.4-slack-integration.md)
- [Story 15.5: Gmail / Google Workspace Integration](stories/epic-15/story-15.5-gmail-integration.md)
- [Story 15.6: Outlook / Microsoft 365 Integration](stories/epic-15/story-15.6-outlook-integration.md)

## Estimated Effort
**18-22 story points** (3 sprints)

## Success Metrics
- S3 upload success rate ≥ 99.9%
- LinkedIn import success rate ≥ 95%
- Job board webhook processing within 30 seconds
- Zero OAuth token leaks
