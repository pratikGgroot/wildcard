# Epic 13: Data Privacy & Compliance

## Overview
Implement comprehensive data privacy controls, consent management, and compliance features for GDPR, DPDP Act, and EEOC regulations.

## Business Value
- Ensures legal compliance and reduces regulatory risk
- Builds candidate trust through transparent data handling
- Enables operation in multiple jurisdictions

## BRD Requirements Covered
- NFR 11.2: GDPR compliance (consent, right to erasure, data portability)
- NFR 11.2: DPDP Act 2023 (India) compliance
- NFR 11.2: EEOC compliance (non-discriminatory AI)
- NFR 9.3: Data privacy (PII encryption, data residency)
- NFR 9.2: Data retention policy

## Priority
**CRITICAL** - Legal requirement

## NFR / Tech Notes
- **Encryption:** AES-256 for data at rest, TLS 1.3 in transit (NFR 7.4)
- **Data Residency:** Support EU, India, US regions
- **Retention:** Candidates (2 years), Audit logs (5 years) (NFR 9.2)
- **Right to Erasure:** Complete data deletion within 30 days
- **Data Portability:** Export candidate data in machine-readable format

### SLA Requirements
- **Data Deletion:** Complete erasure within 30 days of request
- **Data Export:** Generate within 24 hours of request
- **Consent Processing:** ≤1 second response time

## Technical Design

### Compliance Architecture
```
┌─────────────────────────────────────────┐
│      Candidate Data Request Portal      │
│  (Access, Deletion, Export requests)    │
└────────────┬────────────────────────────┘
             │
┌────────────▼────────────────────────────┐
│    Compliance Service                   │
│  - Consent Management                   │
│  - Data Deletion Orchestrator           │
│  - Export Generator                     │
│  - Retention Policy Enforcer            │
└────────────┬────────────────────────────┘
             │
┌────────────▼────────────────────────────┐
│    Encrypted Data Store                 │
│  - Field-level encryption (PII)         │
│  - Soft delete with recovery window     │
│  - Audit trail for all access           │
└─────────────────────────────────────────┘
```

### Database Schema
```sql
CREATE TABLE consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES candidates(id),
  consent_type VARCHAR(50) NOT NULL, -- data_processing, marketing, etc.
  granted BOOLEAN NOT NULL,
  granted_at TIMESTAMP,
  revoked_at TIMESTAMP,
  ip_address VARCHAR(50),
  user_agent TEXT
);

CREATE TABLE data_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES candidates(id),
  requested_by VARCHAR(200), -- Email of requester
  request_type VARCHAR(50), -- right_to_erasure, account_closure
  status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
  requested_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  verification_token VARCHAR(255)
);

CREATE TABLE data_export_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES candidates(id),
  requested_by VARCHAR(200),
  status VARCHAR(20) DEFAULT 'pending',
  export_url VARCHAR(1000),
  requested_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  expires_at TIMESTAMP
);

-- Soft delete support
ALTER TABLE candidates ADD COLUMN deleted_at TIMESTAMP;
ALTER TABLE candidate_profiles ADD COLUMN deleted_at TIMESTAMP;

CREATE INDEX idx_consent_records_candidate ON consent_records(candidate_id);
CREATE INDEX idx_deletion_requests_status ON data_deletion_requests(status);
```

### PII Encryption
```python
# services/encryption_service.py
from cryptography.fernet import Fernet
import base64

class PIIEncryptionService:
    """Field-level encryption for PII data."""
    
    def __init__(self):
        self.cipher = Fernet(settings.ENCRYPTION_KEY)
    
    def encrypt_field(self, value: str) -> str:
        """Encrypt a single field value."""
        if not value:
            return None
        encrypted = self.cipher.encrypt(value.encode())
        return base64.b64encode(encrypted).decode()
    
    def decrypt_field(self, encrypted_value: str) -> str:
        """Decrypt a single field value."""
        if not encrypted_value:
            return None
        decoded = base64.b64decode(encrypted_value)
        decrypted = self.cipher.decrypt(decoded)
        return decrypted.decode()
    
    def encrypt_profile(self, profile: dict) -> dict:
        """Encrypt PII fields in candidate profile."""
        pii_fields = ['email', 'phone', 'address']
        
        for field in pii_fields:
            if field in profile.get('personal', {}):
                profile['personal'][field] = self.encrypt_field(
                    profile['personal'][field]
                )
        
        return profile
```

### Data Deletion Service
```python
# services/data_deletion_service.py
class DataDeletionService:
    async def process_deletion_request(self, request_id: str):
        """
        Process right-to-erasure request.
        Deletes all candidate data across all tables.
        """
        request = await self.get_deletion_request(request_id)
        candidate_id = request.candidate_id
        
        try:
            # Soft delete candidate
            await self.db.execute(
                "UPDATE candidates SET deleted_at = NOW() WHERE id = $1",
                candidate_id
            )
            
            # Delete related data
            tables = [
                'candidate_profiles',
                'applications',
                'candidate_scores',
                'candidate_notes',
                'candidate_tags',
                'candidate_documents'
            ]
            
            for table in tables:
                await self.db.execute(
                    f"UPDATE {table} SET deleted_at = NOW() WHERE candidate_id = $1",
                    candidate_id
                )
            
            # Anonymize audit logs (keep for compliance, remove PII)
            await self.anonymize_audit_logs(candidate_id)
            
            # Delete files from S3
            await self.delete_candidate_files(candidate_id)
            
            # Update request status
            request.status = 'completed'
            request.completed_at = datetime.utcnow()
            await self.db.commit()
            
            # Send confirmation email
            await self.send_deletion_confirmation(request.requested_by)
            
        except Exception as e:
            logger.error(f"Deletion failed: {e}")
            request.status = 'failed'
            await self.db.commit()
```

## Stories
- Story 13.1: PII Field-Level Encryption
- Story 13.2: Consent Management
- Story 13.3: Right to Erasure (Data Deletion)
- Story 13.4: Data Portability (Export)
- Story 13.5: Data Retention Policy Enforcement
- Story 13.6: Data Residency Configuration
- Story 13.7: Compliance Audit Reports
- Story 13.8: Candidate Data Request Portal

## Estimated Effort
**21-26 story points** (3-4 sprints)

## Success Metrics
- 100% PII fields encrypted
- Data deletion requests completed within 30 days
- Zero compliance violations
- Data export requests completed within 24 hours
