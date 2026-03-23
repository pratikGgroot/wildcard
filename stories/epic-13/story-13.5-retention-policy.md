# Story 13.5: Data Retention Policy Enforcement

## User Story
**As a** system  
**I want to** automatically enforce data retention policies  
**So that** candidate data is not kept longer than legally required

## BRD Requirements Covered
- BRD Section 9.2: Candidate data retained for 2 years after last application activity; audit logs 5 years; soft-delete with 30-day recovery window

## Acceptance Criteria
1. **Given** a candidate's last application activity was 2 years ago  
   **When** the retention cleanup job runs  
   **Then** the candidate's PII is anonymized and their profile is marked as expired

2. **Given** a candidate is soft-deleted  
   **When** 30 days pass  
   **Then** the record is permanently deleted (hard delete)

3. **Given** audit logs are older than 5 years  
   **When** the retention job runs  
   **Then** they are archived to cold storage (S3 Glacier) and removed from the active database

4. **Given** a retention policy is about to expire a candidate  
   **When** 30 days before expiry  
   **Then** the assigned recruiter is notified

5. **Given** a candidate has an active application  
   **When** the retention job runs  
   **Then** the 2-year clock does not start until the application is closed

## Priority
**P0 — Must Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **Candidate Data:** 2 years after last activity (BRD Section 9.2)
- **Audit Logs:** 5 years (BRD Section 9.2)
- **Soft Delete:** 30-day recovery window
- **Job Frequency:** Daily cron job
- **Cold Storage:** S3 Glacier for archived audit logs

## Technical Design

### Retention Job
```python
@cron("0 2 * * *")  # Daily at 2 AM
async def enforce_retention_policy():
    # 1. Expire candidates inactive for 2 years
    expired = await db.find_candidates_past_retention()
    for candidate in expired:
        await anonymize_candidate(candidate.id)
    
    # 2. Hard delete soft-deleted candidates after 30 days
    to_delete = await db.find_soft_deleted_past_window()
    for candidate in to_delete:
        await hard_delete_candidate(candidate.id)
    
    # 3. Archive old audit logs
    old_logs = await db.find_audit_logs_past_retention()
    await archive_to_glacier(old_logs)
```

### API Endpoints
```
GET  /api/admin/retention/stats          — Retention policy stats
POST /api/admin/retention/preview        — Preview what would be deleted
POST /api/admin/retention/run            — Manually trigger retention job (admin)
```

## Sub-Tasks
- [ ] 13.5.a — Implement retention job with 2-year candidate expiry
- [ ] 13.5.b — Implement 30-day soft-delete hard deletion
- [ ] 13.5.c — Implement audit log archival to S3 Glacier
- [ ] 13.5.d — Implement pre-expiry recruiter notification
- [ ] 13.5.e — Write unit tests for retention date calculations

## Testing Strategy
- Unit: Retention date calculation, active application hold
- Integration: Full retention cycle with test data
- Compliance: Verify no PII remains after retention expiry

## Dependencies
- Story 13.1 (PII encryption — anonymization)
- Story 13.3 (Right to erasure — shares anonymization logic)
