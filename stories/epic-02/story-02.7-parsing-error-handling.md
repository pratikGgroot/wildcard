# Story 02.7: Parsing Error Handling & Manual Correction

## User Story
**As a** recruiter  
**I want to** see which resumes failed to parse and be able to correct them manually  
**So that** no candidate is lost due to a parsing failure

## BRD Requirements Covered
- FR-RP-06: Flag parsing errors and allow manual correction

## Acceptance Criteria
1. **Given** a resume fails at any parsing stage (text extraction, OCR, LLM extraction)  
   **When** the failure is detected  
   **Then** the resume is added to the "Parsing Errors" queue with an error type and message

2. **Given** a resume is in the error queue  
   **When** a recruiter views the queue  
   **Then** they see: file name, upload date, error type, error message, and a "Review" action

3. **Given** a recruiter opens a failed resume  
   **When** the review screen loads  
   **Then** they see the raw extracted text (if available) alongside an editable profile form

4. **Given** a recruiter manually fills in the profile fields  
   **When** they click "Save & Process"  
   **Then** the profile is saved, the error flag is cleared, and the candidate enters the normal scoring pipeline

5. **Given** a recruiter decides a file is unrecoverable (corrupted, wrong file type)  
   **When** they click "Discard"  
   **Then** the file is removed from the queue and marked as discarded with a reason

6. **Given** a parsing error is resolved (manually or via retry)  
   **When** resolution occurs  
   **Then** the resolution is logged with user ID, timestamp, and method (manual / retry / discard)

7. **Given** more than 10% of resumes in a batch fail parsing  
   **When** this threshold is crossed  
   **Then** an alert is sent to the platform admin

## Priority
**P0 — Must Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **Error Categories:** `text_extraction_failed`, `ocr_failed`, `llm_extraction_failed`, `schema_validation_failed`, `unsupported_format`
- **Retry:** Recruiter can trigger a one-click retry for transient failures
- **Alert Threshold:** Admin alert if batch error rate > 10%
- **Audit:** All manual corrections logged with before/after diff
- **Retention:** Error queue items retained for 30 days before auto-archival

## Technical Design

### Error State Machine
```
uploaded → parsing_failed → [manual_review] → resolved | discarded
                          → [retry]         → parsed | parsing_failed
```

### Database Schema
```sql
CREATE TABLE parsing_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_file_id UUID REFERENCES resume_files(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id),
  error_type VARCHAR(50) NOT NULL,
  error_message TEXT,
  stage VARCHAR(30) CHECK (stage IN ('text_extraction','ocr','llm_extraction','schema_validation')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','in_review','resolved','discarded','retrying')),
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMP,
  resolution_method VARCHAR(20) CHECK (resolution_method IN ('manual','retry','discard')),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE parsing_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parsing_error_id UUID REFERENCES parsing_errors(id),
  corrected_by UUID REFERENCES users(id),
  field_name VARCHAR(100),
  old_value TEXT,
  new_value TEXT,
  corrected_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_parsing_errors_status ON parsing_errors(status) WHERE status = 'pending';
```

### API Endpoints
```
GET  /api/parsing-errors              — List error queue (filter: status, job_id, date)
GET  /api/parsing-errors/:id          — Get error detail with raw text
POST /api/parsing-errors/:id/retry    — Trigger retry
POST /api/parsing-errors/:id/resolve  — Save manual corrections and resolve
POST /api/parsing-errors/:id/discard  — Discard with reason
GET  /api/parsing-errors/stats        — Error rate stats for admin alerting
```

### Alert Logic
```python
async def check_batch_error_rate(batch_id: UUID):
    stats = await db.get_batch_stats(batch_id)
    error_rate = stats.failed / stats.total
    if error_rate > 0.10:
        await notify_admin(
            f"Batch {batch_id}: {error_rate:.0%} parsing failure rate ({stats.failed}/{stats.total})"
        )
```

## Sub-Tasks
- [ ] 02.7.a — Implement error capture and categorization at each pipeline stage
- [ ] 02.7.b — Build parsing error queue UI with filter and sort
- [ ] 02.7.c — Build manual correction form with raw text preview
- [ ] 02.7.d — Implement retry logic for transient errors
- [ ] 02.7.e — Implement admin alert for high error rates
- [ ] 02.7.f — Write unit tests for error state machine

## Testing Strategy
- Unit: Error state transitions, alert threshold logic
- Integration: Inject failures at each pipeline stage; verify queue population
- UI: Manual correction flow end-to-end

## Dependencies
- Story 02.2 (Text extraction)
- Story 02.3 (OCR)
- Story 02.4 (LLM extraction)
- Epic 10 (Notifications — admin alert)
