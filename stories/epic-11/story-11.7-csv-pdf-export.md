# Story 11.7: CSV / PDF Report Export

## User Story
**As a** recruiter or HR admin  
**I want to** export analytics reports as CSV or PDF  
**So that** I can share data with stakeholders who don't have platform access

## BRD Requirements Covered
- FR-DA-07: Export reports as CSV / PDF

## Acceptance Criteria
1. **Given** I am viewing any analytics report  
   **When** I click "Export CSV"  
   **Then** a CSV file is downloaded with the current report data

2. **Given** I click "Export PDF"  
   **When** the PDF is generated  
   **Then** it includes the report title, date range, charts (as images), and data tables

3. **Given** a large report is being exported  
   **When** generation takes more than 5 seconds  
   **Then** the export runs in the background and I receive a notification when it's ready

4. **Given** an export is generated  
   **When** it contains candidate data  
   **Then** PII fields are included only if the user has the appropriate role (recruiter+)

## Priority
**P0 — Must Have**

## Estimated Effort
**3 story points**

## NFR / Tech Notes
- **CSV:** Streamed directly for small reports (< 10,000 rows); async for larger
- **PDF:** Generated server-side with Puppeteer; charts rendered as PNG
- **PII in Exports:** Controlled by RBAC — read-only viewers get anonymized exports

## Technical Design

### API Endpoints
```
POST /api/analytics/export/csv    — Export current report as CSV
POST /api/analytics/export/pdf    — Export current report as PDF
GET  /api/analytics/exports       — List generated exports
GET  /api/analytics/exports/:id/download — Download export file
```

## Sub-Tasks
- [ ] 11.7.a — Implement CSV export for all report types
- [ ] 11.7.b — Implement PDF export with chart rendering
- [ ] 11.7.c — Implement async export with notification on completion
- [ ] 11.7.d — Implement PII filtering based on user role

## Testing Strategy
- Unit: PII filtering, CSV column mapping
- Integration: Export generation for each report type
- Security: Verify read-only users get anonymized exports

## Dependencies
- Stories 11.1–11.6 (Report data sources)
- Epic 12 (RBAC — PII access control)
