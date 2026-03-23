# Story 08.7: Compliance Report Export

## User Story
**As a** compliance officer  
**I want to** export a compliance report for HR legal review  
**So that** I can demonstrate due diligence in bias monitoring and regulatory compliance

## BRD Requirements Covered
- FR-BD-06: Compliance report exportable for HR legal review

## Acceptance Criteria
1. **Given** I am on the Fairness Dashboard  
   **When** I click "Export Compliance Report"  
   **Then** I can select a date range and job scope (single job or all jobs)

2. **Given** I configure the report  
   **When** I click "Generate"  
   **Then** a PDF report is generated within 30 seconds

3. **Given** the report is generated  
   **When** I open it  
   **Then** it includes: summary of bias flags, DIR metrics, flagged candidates (anonymized), resolution status, and audit log summary

4. **Given** the report is generated  
   **When** it is stored  
   **Then** a record is kept of who generated it, when, and for what scope

5. **Given** the report contains candidate data  
   **When** it is generated  
   **Then** all candidate names are anonymized (Candidate A, B, C) in the exported report

## Priority
**P1 — Should Have**

## Estimated Effort
**3 story points**

## NFR / Tech Notes
- **Generation Time:** ≤ 30 seconds for reports covering up to 12 months
- **Format:** PDF (primary), CSV (optional for raw data)
- **Anonymization:** All candidate PII anonymized in export
- **Retention:** Generated reports stored for 5 years

## Technical Design

### Report Contents
```
1. Executive Summary
   - Total candidates analyzed
   - Total bias flags raised
   - Overall DIR per job
   - Resolution rate

2. Per-Job Bias Analysis
   - Job title, date range
   - Flagged candidates (anonymized IDs)
   - Score deltas
   - Resolution status

3. Audit Log Summary
   - AI decisions made
   - Model versions used
   - Any model changes during period

4. Recommendations
   - Jobs with DIR < 0.8
   - Suggested criteria review
```

### API Endpoints
```
POST /api/compliance/reports/generate   — Generate compliance report
GET  /api/compliance/reports            — List generated reports
GET  /api/compliance/reports/:id/download — Download report PDF
```

## Sub-Tasks
- [ ] 08.7.a — Implement compliance report data aggregation
- [ ] 08.7.b — Build PDF report template with anonymization
- [ ] 08.7.c — Implement report generation job (async for large date ranges)
- [ ] 08.7.d — Build report history UI

## Testing Strategy
- Unit: Anonymization completeness, date range filtering
- Integration: Full report generation with real audit data
- Security: Verify no PII in exported report

## Dependencies
- Story 08.5 (Audit log — data source)
- Story 08.6 (Fairness metrics — data source)
