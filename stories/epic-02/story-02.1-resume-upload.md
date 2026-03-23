# Story 02.1: Resume Upload Interface

## User Story
**As a** recruiter  
**I want to** upload candidate resumes individually or in bulk  
**So that** I can quickly add candidates to a job pipeline

## BRD Requirements Covered
- FR-RP-01: Support bulk resume upload (ZIP, individual PDF/DOCX files)

## Acceptance Criteria
1. **Given** I am on a job's pipeline page  
   **When** I click "Upload Resumes"  
   **Then** I see a drag-and-drop zone accepting PDF, DOCX, and ZIP files

2. **Given** I select multiple files or a ZIP  
   **When** files are validated  
   **Then** invalid files (wrong format, >10MB) are rejected with per-file error messages; valid files proceed

3. **Given** upload begins  
   **When** files are uploading  
   **Then** I see a progress indicator per file: queued → uploading → processing → completed/failed

4. **Given** I navigate away during upload  
   **When** uploads are in progress  
   **Then** uploads continue in the background; I receive an in-app notification when complete

5. **Given** bulk upload completes  
   **When** all files are processed  
   **Then** I see a summary: X successful, Y failed, with links to view new candidates and download error report

6. **Given** a file fails virus scan  
   **When** detected  
   **Then** the file is rejected with message "File rejected: security scan failed" and is not stored

## Priority
**P0 — Must Have**

## Estimated Effort
**3 story points**

## NFR / Tech Notes
- **File Size Limit:** 10MB per file; 500MB per bulk upload session
- **Supported Formats:** PDF, DOCX, ZIP (containing PDF/DOCX)
- **Concurrent Uploads:** Up to 20 parallel file uploads
- **Storage:** Upload to S3/GCS via signed URLs
- **Virus Scanning:** ClamAV or AWS GuardDuty on every uploaded file
- **Progress:** WebSocket or SSE for real-time progress updates

### SLA Requirements
- **Upload Speed:** ≥5MB/second throughput
- **Queue Entry:** Resume enters parsing queue within 1 second of upload completion
- **Bulk Processing:** 500 resumes processed within 10 minutes (NFR-P-05)

## Technical Design

### Upload Flow
```
Client → GET signed S3 URL → Upload to S3 → POST /parse trigger
                                                    ↓
                                          [Virus Scan]
                                                    ↓
                                          [Queue parse_resume_task]
                                                    ↓
                                          [WebSocket progress update]
```

### Database Schema
```sql
CREATE TABLE resume_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id),
  file_key VARCHAR(500) NOT NULL,
  file_name VARCHAR(200),
  file_size_bytes INTEGER,
  status VARCHAR(20) DEFAULT 'queued',
  -- queued, virus_scanning, parsing, completed, failed
  error_message TEXT,
  candidate_id UUID REFERENCES candidates(id),
  uploaded_by UUID REFERENCES users(id),
  uploaded_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);
CREATE INDEX idx_resume_uploads_job ON resume_uploads(job_id, status);
```

### API Endpoints
```
POST /api/jobs/:jobId/resumes/upload-url  — Get signed S3 URL
POST /api/jobs/:jobId/resumes/parse       — Trigger parsing after upload
GET  /api/jobs/:jobId/resumes/status      — Bulk status check
```

## Sub-Tasks
- [ ] 02.1.a — Build drag-and-drop upload UI with per-file progress
- [ ] 02.1.b — Implement signed S3 URL generation
- [ ] 02.1.c — Implement virus scanning integration
- [ ] 02.1.d — Implement WebSocket progress updates
- [ ] 02.1.e — Build upload summary report with error download

## Testing Strategy
- Unit: File validation (format, size), ZIP extraction
- Integration: S3 upload, virus scan, queue trigger
- E2E: Upload 10 files, verify all processed
- Performance: Upload 500 files, verify ≤10 minute processing

## Dependencies
- Epic 15 (S3/GCS file storage)
- Epic 14 (Message queue setup)
