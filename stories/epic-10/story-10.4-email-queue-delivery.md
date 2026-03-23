# Story 10.4: Email Queue & Delivery Infrastructure

## User Story
**As a** system  
**I want to** reliably queue and deliver emails at scale  
**So that** all candidate and recruiter emails are delivered without loss

## BRD Requirements Covered
- FR-NC-01: Send automated email notifications to candidates on status changes
- BRD Section 7.1: System must handle high throughput reliably

## Acceptance Criteria
1. **Given** an email is queued  
   **When** the queue worker picks it up  
   **Then** it is delivered within 5 minutes

2. **Given** the email provider (SES) is temporarily unavailable  
   **When** a send attempt fails  
   **Then** the email is retried with exponential backoff (3 retries: 5min, 15min, 60min)

3. **Given** all retries are exhausted  
   **When** the email still fails  
   **Then** it is marked as "failed" and the assigned recruiter is notified

4. **Given** 1,000 emails are queued simultaneously  
   **When** the queue processes them  
   **Then** all are delivered within 30 minutes

5. **Given** an email is delivered  
   **When** SES sends a delivery event  
   **Then** the email job status is updated to "delivered"

6. **Given** an email bounces  
   **When** SES sends a bounce event  
   **Then** the candidate's email is flagged as invalid and future emails are suppressed

## Priority
**P0 — Must Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **Queue:** AWS SQS (standard queue) or BullMQ (Redis-backed)
- **Email Provider:** AWS SES (primary)
- **Throughput:** ≥ 100 emails/minute
- **Bounce Handling:** SES SNS webhook for bounce/complaint events
- **Dead Letter Queue:** Failed emails after 3 retries moved to DLQ for manual review

### SLA Requirements
- **Email Delivery:** ≤ 5 minutes from queue to delivery (NFR)

## Technical Design

### Queue Architecture
```
Email Event → SQS Queue → Worker (Celery/BullMQ) → AWS SES → Candidate
                                                  ↓
                                            SNS Webhook
                                                  ↓
                                    Bounce/Complaint Handler
```

### Bounce Handler
```python
@webhook("/ses/events")
async def handle_ses_event(event: SESEvent):
    if event.type == "Bounce":
        await db.flag_email_invalid(event.destination)
        await unsubscribe_service.add(event.destination, reason="bounce")
    elif event.type == "Complaint":
        await unsubscribe_service.add(event.destination, reason="complaint")
    elif event.type == "Delivery":
        await db.mark_delivered(event.message_id)
```

### API Endpoints
```
GET /api/email-queue/stats    — Queue depth, delivery rate, failure rate
GET /api/email-queue/dlq      — Dead letter queue items
POST /api/email-queue/dlq/:id/retry — Retry DLQ item
```

## Sub-Tasks
- [ ] 10.4.a — Set up SQS queue and worker infrastructure
- [ ] 10.4.b — Implement retry logic with exponential backoff
- [ ] 10.4.c — Implement SES bounce/complaint webhook handler
- [ ] 10.4.d — Implement dead letter queue and manual retry
- [ ] 10.4.e — Build email queue monitoring dashboard

## Testing Strategy
- Unit: Retry logic, bounce handling
- Integration: Full queue → SES → delivery flow
- Load: 1,000 emails queued simultaneously; verify delivery within 30 minutes

## Dependencies
- Story 10.2 (Candidate status emails — primary queue producer)
- Epic 15 (AWS SES integration)
