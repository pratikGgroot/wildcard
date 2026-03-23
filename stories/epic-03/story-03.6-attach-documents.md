# Story 03.6: Attach Documents to Candidate Profile

## User Story
**As a** recruiter  
**I want to** attach additional documents to a candidate profile  
**So that** cover letters, portfolios, and certificates are stored alongside the resume

## BRD Requirements Covered
- FR-CP-05: Support attaching documents (cover letter, portfolio, certificates)

## Acceptance Criteria
1. **Given** I am on a candidate profile  
   **When** I click "Attach Document"  
   **Then** I can upload a file (PDF, DOCX, PNG, JPG) up to 10MB

2. **Given** I upload a document  
   **When** the upload completes  
   **Then** the document appears in the "Documents" section with: file name, type label, upload date, and uploader name

3. **Given** documents are listed  
   **When** I click a document  
   **Then** it opens in a preview panel (PDF inline, images inline, DOCX as download)

4. **Given** I uploaded a document  
   **When** I click "Delete"  
   **Then** I am prompted to confirm; on confirmation the document is removed and the action is logged

5. **Given** a document type is selected (cover letter, portfolio, certificate, other)  
   **When** the document is saved  
   **Then** it is labeled with the selected type for easy identification

6. **Given** a file exceeds 10MB  
   **When** upload is attempted  
   **Then** an error message is shown: "File size exceeds 10MB limit"

## Priority
**P1 — Should Have**

## Estimated Effort
**3 story points**

## NFR / Tech Notes
- **Storage:** AWS S3 with pre-signed URLs for access (1-hour expiry)
- **File Types:** PDF, DOCX, PNG, JPG, JPEG
- **Max File Size:** 10MB per file
- **Max Documents:** 20 documents per candidate profile
- **Virus Scan:** Files scanned via ClamAV or AWS Macie before storage

## Technical Design

### Database Schema
```sql
CREATE TABLE candidate_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(20) CHECK (file_type IN ('cover_letter','portfolio','certificate','other')),
  s3_key VARCHAR(500) NOT NULL,
  file_size_bytes INT,
  mime_type VARCHAR(100),
  uploaded_by UUID REFERENCES users(id),
  uploaded_at TIMESTAMP DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_candidate_documents_candidate ON candidate_documents(candidate_id)
  WHERE is_deleted = FALSE;
```

### API Endpoints
```
POST   /api/candidates/:id/documents          — Upload document (multipart)
GET    /api/candidates/:id/documents          — List documents
GET    /api/candidates/:id/documents/:docId/url — Get pre-signed download URL
DELETE /api/candidates/:id/documents/:docId   — Soft-delete document
```

## Sub-Tasks
- [ ] 03.6.a — Implement S3 upload with virus scan pre-check
- [ ] 03.6.b — Build document list UI with type labels and preview
- [ ] 03.6.c — Implement pre-signed URL generation for secure access
- [ ] 03.6.d — Implement file size and type validation

## Testing Strategy
- Unit: File validation, pre-signed URL expiry
- Integration: S3 upload and retrieval
- Security: Verify files are not publicly accessible without signed URL

## Dependencies
- Story 03.1 (Candidate profile view)
- Epic 15 (S3 file storage integration)
