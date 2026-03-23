# Story 07.7: Interview Kit PDF Export & Sharing

## User Story
**As a** recruiter  
**I want to** export the interview kit as a PDF or share it via a link  
**So that** interviewers can access it during the interview without needing platform access

## BRD Requirements Covered
- FR-IK-06: Kit is exportable as PDF or shareable via link

## Acceptance Criteria
1. **Given** an approved interview kit  
   **When** I click "Export PDF"  
   **Then** a PDF is generated and downloaded within 5 seconds

2. **Given** the PDF is generated  
   **When** I open it  
   **Then** it includes: candidate name, job title, all questions organized by type, rubrics, and a scoring sheet

3. **Given** I click "Share Link"  
   **When** the link is generated  
   **Then** a unique URL is created that allows read-only access to the kit (no platform login required)

4. **Given** a share link is created  
   **When** it is accessed  
   **Then** it expires after 30 days or when the job is closed

5. **Given** a kit is not yet approved  
   **When** I try to export or share  
   **Then** I see a warning: "Please approve the kit before sharing" with an option to approve now

## Priority
**P1 — Should Have**

## Estimated Effort
**3 story points**

## NFR / Tech Notes
- **PDF Generation:** Server-side using Puppeteer (headless Chrome) or WeasyPrint
- **PDF Generation Time:** ≤ 5 seconds
- **Share Link:** Signed URL with 30-day expiry; stored in DB
- **Security:** Share links are read-only; no candidate PII in shared view (configurable)

## Technical Design

### Share Link Schema
```sql
CREATE TABLE kit_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id UUID REFERENCES interview_kits(id) ON DELETE CASCADE,
  token VARCHAR(64) UNIQUE NOT NULL,
  created_by UUID REFERENCES users(id),
  expires_at TIMESTAMP NOT NULL,
  is_revoked BOOLEAN DEFAULT FALSE,
  accessed_count INT DEFAULT 0
);
```

### API Endpoints
```
POST /api/interview-kits/:id/export-pdf    — Generate and return PDF
POST /api/interview-kits/:id/share-link    — Create share link
GET  /api/interview-kits/shared/:token     — Public read-only kit view
DELETE /api/interview-kits/:id/share-link  — Revoke share link
```

## Sub-Tasks
- [ ] 07.7.a — Implement PDF generation with Puppeteer
- [ ] 07.7.b — Build PDF template (questions, rubrics, scoring sheet)
- [ ] 07.7.c — Implement share link generation with expiry
- [ ] 07.7.d — Build public read-only kit view (no auth required)
- [ ] 07.7.e — Implement share link revocation

## Testing Strategy
- Unit: Share link expiry, revocation logic
- Integration: PDF generation with real kit data
- Security: Verify share links don't expose PII beyond configured settings

## Dependencies
- Story 07.6 (Kit review/edit — kit must be approved before export)
