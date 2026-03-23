# Story 15.3: Job Board Inbound Application Webhooks

## User Story
**As a** recruiter  
**I want to** receive applications from job boards (Indeed, Naukri, LinkedIn Jobs) automatically  
**So that** candidates who apply on external job boards appear in the platform without manual import

## BRD Requirements Covered
- BRD Section 10: Job Boards (Indeed, Naukri, LinkedIn Jobs) — Inbound application webhook (Should Have)

## Acceptance Criteria
1. **Given** a candidate applies on Indeed for a job posted there  
   **When** Indeed sends a webhook  
   **Then** the application is created in the platform with the candidate's resume and source set to "Indeed"

2. **Given** a webhook is received  
   **When** it is processed  
   **Then** the resume enters the normal parsing pipeline (text extraction → LLM extraction → scoring)

3. **Given** a webhook payload is malformed  
   **When** it is received  
   **Then** it is logged as an error and the job board is sent a 400 response

4. **Given** a webhook is received for a job that doesn't exist  
   **When** it is processed  
   **Then** it is logged and the job board is sent a 404 response

5. **Given** a webhook is received  
   **When** it is authenticated  
   **Then** the HMAC signature is verified before processing

## Priority
**P1 — Should Have**

## Estimated Effort
**8 story points**

## NFR / Tech Notes
- **Authentication:** HMAC-SHA256 signature verification per job board
- **Idempotency:** Duplicate webhooks (same application) are deduplicated
- **Supported Boards:** Indeed, Naukri, LinkedIn Jobs (each has different payload format)
- **Processing:** Async — webhook acknowledged immediately, processing queued

## Technical Design

### Webhook Handler
```python
@router.post("/api/webhooks/job-boards/{board_name}")
async def handle_job_board_webhook(board_name: str, request: Request):
    # Verify signature
    signature = request.headers.get("X-Webhook-Signature")
    body = await request.body()
    if not verify_hmac(body, signature, BOARD_SECRETS[board_name]):
        raise HTTPException(401, "Invalid signature")
    
    # Parse payload
    payload = BOARD_PARSERS[board_name].parse(json.loads(body))
    
    # Idempotency check
    if await db.application_exists(payload.external_id, board_name):
        return {"status": "duplicate"}
    
    # Queue for processing
    await queue.enqueue("process_job_board_application", payload.dict())
    return {"status": "accepted"}
```

### Board-Specific Parsers
```python
BOARD_PARSERS = {
    "indeed": IndeedWebhookParser(),
    "naukri": NaukriWebhookParser(),
    "linkedin_jobs": LinkedInJobsWebhookParser()
}
```

### API Endpoints
```
POST /api/webhooks/job-boards/:board   — Receive inbound application webhook
GET  /api/admin/webhooks/logs          — View webhook processing logs
POST /api/admin/webhooks/:board/test   — Send test webhook (admin)
```

## Sub-Tasks
- [ ] 15.3.a — Implement HMAC signature verification
- [ ] 15.3.b — Implement payload parsers for Indeed, Naukri, LinkedIn Jobs
- [ ] 15.3.c — Implement idempotency check for duplicate webhooks
- [ ] 15.3.d — Integrate with resume parsing pipeline
- [ ] 15.3.e — Build webhook log UI for admin

## Testing Strategy
- Unit: HMAC verification, payload parsing for each board
- Integration: Full webhook → parse → score flow
- Security: Reject webhooks with invalid signatures

## Dependencies
- Story 02.1 (Resume upload — parsing pipeline entry point)
- Story 11.4 (Source tracking — job board source)
