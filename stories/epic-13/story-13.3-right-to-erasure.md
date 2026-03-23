# Story 13.3: Right to Erasure (GDPR Article 17)

## User Story
**As a** candidate  
**I want to** request deletion of all my personal data  
**So that** I can exercise my right to be forgotten under GDPR

## BRD Requirements Covered
- BRD Section 9.3: Candidate right-to-erasure (GDPR Article 17) supported via API
- BRD Section 11.2: GDPR — right to erasure; DPDP Act 2023 — data principal rights

## Acceptance Criteria
1. **Given** a candidate submits an erasure request  
   **When** the request is received  
   **Then** it is logged and a confirmation email is sent within 24 hours

2. **Given** an erasure request is approved  
   **When** the deletion job runs  
   **Then** all PII fields are permanently deleted or anonymized within 30 days

3. **Given** erasure is performed  
   **When** it completes  
   **Then** the candidate's name, email, phone, address, and resume file are deleted; anonymized records are retained for audit purposes

4. **Given** a candidate has an active application in a live pipeline  
   **When** an erasure request is received  
   **Then** the recruiter is notified and the request is held until the pipeline closes (or 30 days, whichever is sooner)

5. **Given** erasure is complete  
   **When** the candidate queries their data  
   **Then** no PII is returned; only anonymized records exist

## Priority
**P0 — Must Have**

## Estimated Effort
**8 story points**

## NFR / Tech Notes
- **Deadline:** GDPR requires erasure within 30 days of request
- **Anonymization:** PII deleted; non-PII records (scores, stage history) anonymized with a random ID
- **Audit:** Erasure event logged with timestamp and scope
- **Soft Delete:** 30-day recovery window before permanent deletion (BRD Section 9.2)

## Technical Design

### Erasure Process
```python
async def process_erasure(candidate_id: UUID):
    # 1. Delete PII fields
    await db.execute("""
        UPDATE candidates SET
            name_encrypted = NULL, email_encrypted = NULL, email_hash = NULL,
            phone_encrypted = NULL, address_encrypted = NULL,
            raw_resume_text = NULL
        WHERE id = $1
    """, candidate_id)
    
    # 2. Delete resume files from S3
    files = await db.get_resume_files(candidate_id)
    for f in files:
        await s3.delete_object(f.s3_key)
    
    # 3. Anonymize remaining records (replace candidate_id with anonymous_id)
    anon_id = uuid4()
    await db.anonymize_candidate_records(candidate_id, anon_id)
    
    # 4. Log erasure
    await db.log_erasure(candidate_id, completed_at=now())
```

### API Endpoints
```
POST /api/candidates/:id/erasure-request   — Submit erasure request
GET  /api/candidates/:id/erasure-status    — Check erasure status
POST /api/admin/erasure-requests/:id/approve — Approve erasure (admin)
GET  /api/admin/erasure-requests           — List pending erasure requests
```

## Sub-Tasks
- [ ] 13.3.a — Implement erasure request submission and logging
- [ ] 13.3.b — Implement PII deletion and anonymization job
- [ ] 13.3.c — Implement S3 file deletion
- [ ] 13.3.d — Implement active pipeline hold logic
- [ ] 13.3.e — Build erasure request management UI for admins
- [ ] 13.3.f — Write unit tests for anonymization completeness

## Testing Strategy
- Unit: Anonymization completeness, hold logic
- Integration: Full erasure flow — request → approval → deletion
- Compliance: Verify no PII remains after erasure

## Dependencies
- Story 13.1 (PII encryption — knows which fields to delete)
- Epic 15 (S3 — file deletion)
