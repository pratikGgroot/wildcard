# Story 15.1: File Storage (AWS S3 / GCS)

## User Story
**As a** system  
**I want to** store resume files and documents in cloud object storage  
**So that** files are durable, scalable, and securely accessible

## BRD Requirements Covered
- BRD Section 10: AWS S3 / GCS — File storage for resumes (Must Have)

## Acceptance Criteria
1. **Given** a resume is uploaded  
   **When** the upload completes  
   **Then** the file is stored in S3 with a unique key and the URL is stored in the database

2. **Given** a file is stored  
   **When** a user requests access  
   **Then** a pre-signed URL is generated with a 1-hour expiry

3. **Given** a file is deleted (erasure request)  
   **When** deletion is triggered  
   **Then** the file is permanently removed from S3

4. **Given** a file is uploaded  
   **When** it is stored  
   **Then** it is encrypted at rest using S3 SSE-KMS

5. **Given** S3 is unavailable  
   **When** an upload is attempted  
   **Then** the upload is retried 3 times; on failure the user sees an error message

## Priority
**P0 — Must Have**

## Estimated Effort
**3 story points**

## NFR / Tech Notes
- **Storage:** AWS S3 (primary); GCS as alternative
- **Encryption:** SSE-KMS (server-side encryption with KMS-managed keys)
- **Access:** Pre-signed URLs only (no public access)
- **Bucket Policy:** Block all public access
- **Versioning:** Enabled for resume files (30-day version retention)
- **Max File Size:** 10MB per file

## Technical Design

### S3 Service
```python
class S3StorageService:
    def __init__(self):
        self.client = boto3.client('s3')
        self.bucket = settings.S3_BUCKET
    
    async def upload(self, file_bytes: bytes, key: str, content_type: str) -> str:
        self.client.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=file_bytes,
            ContentType=content_type,
            ServerSideEncryption='aws:kms'
        )
        return key
    
    def get_presigned_url(self, key: str, expiry_seconds: int = 3600) -> str:
        return self.client.generate_presigned_url(
            'get_object',
            Params={'Bucket': self.bucket, 'Key': key},
            ExpiresIn=expiry_seconds
        )
    
    async def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=key)
```

### File Key Structure
```
resumes/{org_id}/{job_id}/{candidate_id}/{filename}_{timestamp}.pdf
documents/{org_id}/{candidate_id}/{doc_type}/{filename}_{timestamp}.pdf
exports/{org_id}/{report_type}/{timestamp}.pdf
```

### API Endpoints
```
POST /api/files/upload-url    — Get pre-signed upload URL (client uploads directly to S3)
GET  /api/files/:key/download — Get pre-signed download URL
DELETE /api/files/:key        — Delete file
```

## Sub-Tasks
- [ ] 15.1.a — Set up S3 bucket with SSE-KMS and versioning
- [ ] 15.1.b — Implement S3 service with upload, download, delete
- [ ] 15.1.c — Implement pre-signed URL generation
- [ ] 15.1.d — Implement direct-to-S3 upload flow (client → S3, not via API)
- [ ] 15.1.e — Configure bucket policy (block public access)

## Testing Strategy
- Unit: Pre-signed URL generation, key structure
- Integration: Upload → store → retrieve → delete cycle
- Security: Verify files not publicly accessible

## Dependencies
- Story 14.7 (Secrets management — AWS credentials)
