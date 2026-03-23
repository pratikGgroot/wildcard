# Story 13.7: Compliance Audit Reports

## User Story
**As a** compliance officer  
**I want to** generate compliance audit reports  
**So that** I can demonstrate GDPR, DPDP, and SOC 2 compliance to auditors

## BRD Requirements Covered
- BRD Section 11.2: GDPR, DPDP Act 2023, SOC 2 Type II, ISO 27001 compliance requirements

## Acceptance Criteria
1. **Given** I navigate to Compliance Reports  
   **When** the page loads  
   **Then** I see report types: GDPR Data Processing Report, Consent Audit, Erasure Request Log, AI Decision Audit

2. **Given** I generate a GDPR Data Processing Report  
   **When** it is generated  
   **Then** it includes: data categories processed, legal basis, retention periods, and data transfers

3. **Given** I generate a Consent Audit report  
   **When** it is generated  
   **Then** it shows: total consents given, withdrawn, pending re-consent, and consent text versions in use

4. **Given** I generate an Erasure Request Log  
   **When** it is generated  
   **Then** it shows: all erasure requests, their status, and completion dates

5. **Given** a report is generated  
   **When** it is exported  
   **Then** it is available as PDF and CSV

## Priority
**P1 — Should Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **Access:** Compliance officer role only
- **Report Types:** GDPR, DPDP, SOC 2 evidence, AI ethics
- **Generation Time:** ≤ 60 seconds for 12-month reports
- **Retention:** Generated reports stored for 5 years

## Technical Design

### API Endpoints
```
GET  /api/compliance/report-types              — List available report types
POST /api/compliance/reports/generate          — Generate a compliance report
GET  /api/compliance/reports                   — List generated reports
GET  /api/compliance/reports/:id/download      — Download report
```

## Sub-Tasks
- [ ] 13.7.a — Implement GDPR data processing report generation
- [ ] 13.7.b — Implement consent audit report
- [ ] 13.7.c — Implement erasure request log report
- [ ] 13.7.d — Build compliance reports UI

## Testing Strategy
- Unit: Report data aggregation, date range filtering
- Integration: Full report generation for each type
- Compliance: Verify reports contain all required GDPR/DPDP fields

## Dependencies
- Story 13.2 (Consent management — data source)
- Story 13.3 (Right to erasure — data source)
- Story 08.5 (AI audit log — data source)
