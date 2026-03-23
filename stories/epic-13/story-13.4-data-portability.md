# Story 13.4: Data Portability

## User Story
**As a** candidate  
**I want to** download all my personal data in a portable format  
**So that** I can exercise my right to data portability under GDPR

## BRD Requirements Covered
- BRD Section 11.2: GDPR — data portability

## Acceptance Criteria
1. **Given** a candidate requests their data  
   **When** the request is submitted  
   **Then** a data export is generated within 72 hours

2. **Given** the export is ready  
   **When** the candidate downloads it  
   **Then** it contains: personal info, application history, AI scores, notes about them, and consent records — in JSON format

3. **Given** the export is generated  
   **When** it is delivered  
   **Then** it is sent via a secure download link (expires in 7 days) to the candidate's email

4. **Given** a candidate requests their data multiple times  
   **When** each request is made  
   **Then** each generates a fresh export with current data

## Priority
**P0 — Must Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **Format:** JSON (machine-readable, GDPR requirement)
- **Delivery:** Secure download link via email (7-day expiry)
- **Deadline:** 72 hours from request (GDPR Article 20)
- **Scope:** All data held about the candidate, including AI-generated scores and summaries

## Technical Design

### Export Contents
```json
{
  "personal_info": { "name": "...", "email": "...", "phone": "..." },
  "applications": [
    {
      "job_title": "...",
      "applied_at": "...",
      "stages_reached": [...],
      "ai_fit_score": 78,
      "ai_summary": "..."
    }
  ],
  "consent_records": [...],
  "notes_about_you": [...],
  "data_export_generated_at": "..."
}
```

### API Endpoints
```
POST /api/candidates/:id/data-export-request   — Request data export
GET  /api/data-export/:token                   — Download export (no auth, token-based)
GET  /api/admin/data-export-requests           — List pending requests (admin)
```

## Sub-Tasks
- [ ] 13.4.a — Implement data export aggregation job
- [ ] 13.4.b — Implement secure download link generation
- [ ] 13.4.c — Build candidate data request portal (Story 13.8)
- [ ] 13.4.d — Write unit tests for export completeness

## Testing Strategy
- Unit: Export completeness, link expiry
- Integration: Full request → export → download flow
- Compliance: Verify export contains all required data categories

## Dependencies
- Story 13.1 (PII encryption — decrypts for export)
- Epic 10 (Notifications — delivery email)
