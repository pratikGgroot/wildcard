# Story 08.5: AI Decision Audit Log

## User Story
**As a** compliance officer  
**I want to** access a complete audit log of every AI decision  
**So that** I can review AI behavior, investigate complaints, and demonstrate compliance

## BRD Requirements Covered
- FR-BD-05: Audit log of every AI decision with explainability data
- BRD Section 8.8: Full audit trail — every AI output logged with model version, input hash, and timestamp

## Acceptance Criteria
1. **Given** any AI decision is made (scoring, shortlisting, summary generation, bias analysis)  
   **When** the decision is produced  
   **Then** it is logged with: decision type, model name, model version, input hash, output, timestamp, and application ID

2. **Given** a compliance officer searches the audit log  
   **When** they filter by job, date range, or decision type  
   **Then** matching log entries are returned within 2 seconds

3. **Given** a log entry is viewed  
   **When** the compliance officer opens it  
   **Then** they see: full input context (anonymized), output, model details, and any bias flags associated

4. **Given** an audit log entry exists  
   **When** it is stored  
   **Then** it is immutable — no updates or deletes allowed (append-only)

5. **Given** audit logs are retained  
   **When** the retention period is checked  
   **Then** logs are retained for 5 years (BRD Section 9.2)

## Priority
**P0 — Must Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **Retention:** 5 years (BRD Section 9.2)
- **Immutability:** Append-only; no UPDATE or DELETE on audit records
- **Storage:** Separate audit log table with partitioning by month for query performance
- **PII:** Input context stored with PII fields hashed (not plaintext)
- **Search:** Full-text search on decision type, model name; range filter on timestamp

## Technical Design

### Audit Log Schema
```sql
CREATE TABLE ai_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES applications(id),
  job_id UUID REFERENCES jobs(id),
  decision_type VARCHAR(50) NOT NULL,  -- 'fit_score', 'shortlist', 'summary', 'bias_analysis', 'interview_kit'
  model_name VARCHAR(100) NOT NULL,
  model_version VARCHAR(20) NOT NULL,
  input_hash VARCHAR(64) NOT NULL,     -- SHA256 of input (for reproducibility)
  output JSONB NOT NULL,
  bias_flags JSONB,
  created_at TIMESTAMP DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Monthly partitions
CREATE TABLE ai_audit_logs_2026_01 PARTITION OF ai_audit_logs
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

-- Prevent updates and deletes
CREATE RULE no_update_audit AS ON UPDATE TO ai_audit_logs DO INSTEAD NOTHING;
CREATE RULE no_delete_audit AS ON DELETE TO ai_audit_logs DO INSTEAD NOTHING;

CREATE INDEX idx_audit_logs_application ON ai_audit_logs(application_id);
CREATE INDEX idx_audit_logs_job_date ON ai_audit_logs(job_id, created_at DESC);
CREATE INDEX idx_audit_logs_decision_type ON ai_audit_logs(decision_type);
```

### API Endpoints
```
GET /api/audit/ai-decisions              — List audit log (filter: job, date, type)
GET /api/audit/ai-decisions/:id          — Get single audit entry
GET /api/audit/ai-decisions/export       — Export audit log as CSV
```

## Sub-Tasks
- [ ] 08.5.a — Implement audit log schema with partitioning and immutability rules
- [ ] 08.5.b — Implement audit logging middleware for all AI services
- [ ] 08.5.c — Build audit log search UI for compliance officers
- [ ] 08.5.d — Implement CSV export for audit log
- [ ] 08.5.e — Write unit tests for immutability enforcement

## Testing Strategy
- Unit: Immutability rules, PII hashing
- Integration: Audit log population from all AI services
- Compliance: Verify 5-year retention policy is enforced

## Dependencies
- Epic 04 (Scoring — logs fit score decisions)
- Epic 05 (Shortlisting — logs shortlist decisions)
- Epic 07 (Interview kit — logs generation decisions)
- Epic 12 (RBAC — compliance officer access)
