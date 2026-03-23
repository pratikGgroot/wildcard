# Story 13.1: PII Field-Level Encryption

## User Story
**As a** system  
**I want to** encrypt PII fields at the database level  
**So that** candidate personal data is protected even if the database is compromised

## BRD Requirements Covered
- BRD Section 9.3: PII fields (name, email, phone, address) encrypted at field level in the database
- BRD Section 7.4: All data encrypted at rest (AES-256)

## Acceptance Criteria
1. **Given** a candidate profile is created  
   **When** it is stored in the database  
   **Then** PII fields (name, email, phone, address) are encrypted using AES-256

2. **Given** PII fields are encrypted  
   **When** an authorized user retrieves a candidate profile  
   **Then** the fields are transparently decrypted and returned in plaintext

3. **Given** the database is accessed directly (e.g., by a DBA)  
   **When** they query the candidates table  
   **Then** PII fields appear as ciphertext, not plaintext

4. **Given** the encryption key is rotated  
   **When** the rotation job runs  
   **Then** all encrypted fields are re-encrypted with the new key without data loss

5. **Given** a field is searched (e.g., find by email)  
   **When** the search runs  
   **Then** it uses a deterministic hash index (not the encrypted value) for lookups

## Priority
**P0 — Must Have**

## Estimated Effort
**8 story points**

## NFR / Tech Notes
- **Algorithm:** AES-256-GCM for authenticated encryption
- **Key Management:** AWS KMS or HashiCorp Vault for key storage
- **Search:** Deterministic HMAC hash stored alongside encrypted value for equality lookups
- **Performance:** Encryption/decryption overhead ≤ 5ms per field
- **Key Rotation:** Automated quarterly key rotation

## Technical Design

### Encryption Service
```python
class PIIEncryptionService:
    def encrypt(self, plaintext: str) -> tuple[str, str]:
        """Returns (ciphertext_b64, hmac_hash) for storage."""
        key = self.kms.get_current_key()
        nonce = os.urandom(12)
        cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
        ciphertext, tag = cipher.encrypt_and_digest(plaintext.encode())
        encoded = base64.b64encode(nonce + tag + ciphertext).decode()
        hmac_hash = hmac.new(self.hmac_key, plaintext.encode(), hashlib.sha256).hexdigest()
        return encoded, hmac_hash
    
    def decrypt(self, ciphertext_b64: str) -> str:
        key = self.kms.get_current_key()
        data = base64.b64decode(ciphertext_b64)
        nonce, tag, ciphertext = data[:12], data[12:28], data[28:]
        cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
        return cipher.decrypt_and_verify(ciphertext, tag).decode()
```

### Database Schema
```sql
-- PII stored encrypted; hash for lookups
ALTER TABLE candidates ADD COLUMN name_encrypted TEXT;
ALTER TABLE candidates ADD COLUMN email_encrypted TEXT;
ALTER TABLE candidates ADD COLUMN email_hash VARCHAR(64);  -- for lookups
ALTER TABLE candidates ADD COLUMN phone_encrypted TEXT;
ALTER TABLE candidates ADD COLUMN address_encrypted TEXT;

CREATE INDEX idx_candidates_email_hash ON candidates(email_hash);
```

## Sub-Tasks
- [ ] 13.1.a — Implement AES-256-GCM encryption service
- [ ] 13.1.b — Integrate AWS KMS for key management
- [ ] 13.1.c — Implement HMAC hash index for email lookups
- [ ] 13.1.d — Implement key rotation job
- [ ] 13.1.e — Write unit tests for encrypt/decrypt round-trip

## Testing Strategy
- Unit: Encrypt/decrypt round-trip, HMAC lookup
- Security: Verify ciphertext in DB, plaintext in API response
- Key Rotation: Verify all records re-encrypted correctly

## Dependencies
- Epic 15 (AWS KMS — key management)
