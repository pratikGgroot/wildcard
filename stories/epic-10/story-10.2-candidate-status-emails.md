# Story 10.2: Candidate Status Change Emails

## User Story
**As a** system  
**I want to** automatically send email notifications to candidates when their application status changes  
**So that** candidates are kept informed throughout the hiring process

## BRD Requirements Covered
- FR-NC-01: Send automated email notifications to candidates on status changes

## Acceptance Criteria
1. **Given** a candidate is moved to a new pipeline stage  
   **When** the stage change is saved  
   **Then** an email notification is queued for the candidate using the stage's default template

2. **Given** an email is queued  
   **When** it is sent  
   **Then** the candidate receives it within 5 minutes of the stage change

3. **Given** a stage has no email template configured  
   **When** a candidate is moved to that stage  
   **Then** no email is sent (no error; email is simply skipped)

4. **Given** a recruiter moves a candidate  
   **When** the stage change triggers an email  
   **Then** the recruiter sees a confirmation: "Email notification will be sent to [candidate email]" with an option to cancel

5. **Given** an email fails to deliver  
   **When** the delivery fails  
   **Then** it is retried up to 3 times; on final failure the recruiter is notified

6. **Given** a candidate has unsubscribed  
   **When** an email would be sent  
   **Then** the email is suppressed and the suppression is logged

## Priority
**P0 — Must Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **Delivery SLA:** ≤ 5 minutes from stage change to email delivery
- **Email Provider:** AWS SES or SendGrid
- **Retry:** 3 retries with exponential backoff (5min, 15min, 60min)
- **Unsubscribe:** Respect unsubscribe list (Story 10.7)
- **Tracking:** Track open and click events (optional, configurable)

### SLA Requirements
- **Email Delivery:** ≤ 5 minutes from trigger to delivery

## Technical Design

### Email Queue Worker
```python
@celery_task(max_retries=3, default_retry_delay=300)
async def send_candidate_email(email_job_id: UUID):
    job = await db.get_email_job(email_job_id)
    
    # Check unsubscribe
    if await unsubscribe_service.is_unsubscribed(job.candidate_email):
        await db.mark_suppressed(email_job_id)
        return
    
    # Render template
    body = template_engine.render(job.template, job.merge_data)
    
    # Send via SES
    await ses_client.send_email(
        to=job.candidate_email,
        subject=job.subject,
        body_html=body
    )
    await db.mark_sent(email_job_id)
```

### Database Schema
```sql
CREATE TABLE email_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES candidates(id),
  application_id UUID REFERENCES applications(id),
  template_id UUID REFERENCES email_templates(id),
  to_email VARCHAR(255) NOT NULL,
  subject VARCHAR(200),
  merge_data JSONB,
  status VARCHAR(20) DEFAULT 'queued' CHECK (status IN ('queued','sent','failed','suppressed')),
  attempts INT DEFAULT 0,
  sent_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### API Endpoints
```
GET /api/email-jobs                    — List email jobs (filter: status, candidate, job)
POST /api/email-jobs/:id/retry         — Manually retry failed email
GET /api/candidates/:id/email-history  — Email history for a candidate
```

## Sub-Tasks
- [ ] 10.2.a — Implement email queue worker with retry logic
- [ ] 10.2.b — Implement stage-change email trigger
- [ ] 10.2.c — Implement unsubscribe suppression check
- [ ] 10.2.d — Build email history view for candidate profile
- [ ] 10.2.e — Implement recruiter confirmation before send

## Testing Strategy
- Unit: Retry logic, suppression check, template rendering
- Integration: Stage change → email queue → delivery
- SLA: Verify delivery within 5 minutes

## Dependencies
- Story 10.1 (Email templates)
- Story 10.7 (Unsubscribe management)
- Epic 09 (Pipeline stage changes — trigger source)
