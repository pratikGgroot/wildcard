# Story 13.2: Consent Management

## User Story
**As a** candidate  
**I want to** give explicit consent for my data to be processed  
**So that** I know how my information is being used and can withdraw consent

## BRD Requirements Covered
- BRD Section 11.2: GDPR — Consent management; DPDP Act 2023 — consent, data principal rights

## Acceptance Criteria
1. **Given** a candidate submits an application  
   **When** the application is received  
   **Then** a consent record is created capturing: consent given, timestamp, IP address, and consent text version

2. **Given** a candidate wants to withdraw consent  
   **When** they submit a withdrawal request  
   **Then** their data processing is stopped and they are notified within 72 hours

3. **Given** the consent text is updated  
   **When** a candidate next interacts with the platform  
   **Then** they are shown the updated consent text and asked to re-consent

4. **Given** a candidate has not given consent  
   **When** their data is processed  
   **Then** the system blocks processing and logs the attempt

5. **Given** a compliance officer audits consent  
   **When** they query the consent log  
   **Then** they can see the full consent history for any candidate

## Priority
**P0 — Must Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **GDPR Article 7:** Consent must be freely given, specific, informed, and unambiguous
- **DPDP Act 2023:** Consent notice must be in clear language; withdrawal must be as easy as giving
- **Consent Versioning:** Consent text versioned; re-consent required on material changes
- **Audit:** Full consent history retained for 5 years

## Technical Design

### Consent Schema
```sql
CREATE TABLE consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  consent_text_version VARCHAR(10) NOT NULL,
  consent_given BOOLEAN NOT NULL,
  ip_address INET,
  user_agent TEXT,
  given_at TIMESTAMP DEFAULT NOW(),
  withdrawn_at TIMESTAMP
);

CREATE TABLE consent_text_versions (
  version VARCHAR(10) PRIMARY KEY,
  text TEXT NOT NULL,
  effective_from TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### API Endpoints
```
POST /api/consent/record          — Record consent (called at application submission)
POST /api/consent/withdraw        — Withdraw consent
GET  /api/candidates/:id/consent  — Get consent history (admin/compliance)
GET  /api/consent/current-text    — Get current consent text version
```

## Sub-Tasks
- [ ] 13.2.a — Implement consent recording at application submission
- [ ] 13.2.b — Implement consent withdrawal flow
- [ ] 13.2.c — Implement consent text versioning and re-consent trigger
- [ ] 13.2.d — Build consent audit view for compliance officers

## Testing Strategy
- Unit: Consent version check, withdrawal blocking
- Integration: Consent recorded at application; withdrawal stops processing
- Compliance: Verify consent audit trail is complete

## Dependencies
- Epic 02 (Resume upload — consent recorded at submission)
