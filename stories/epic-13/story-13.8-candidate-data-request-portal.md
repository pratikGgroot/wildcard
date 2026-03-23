# Story 13.8: Candidate Data Request Portal

## User Story
**As a** candidate  
**I want to** submit data requests (access, erasure, portability) through a self-service portal  
**So that** I can exercise my data rights without contacting support

## BRD Requirements Covered
- BRD Section 11.2: DPDP Act 2023 — grievance redressal; GDPR — data subject rights

## Acceptance Criteria
1. **Given** I visit the candidate data portal  
   **When** the page loads  
   **Then** I see options: "Access My Data", "Delete My Data", "Withdraw Consent"

2. **Given** I submit a request  
   **When** I enter my email and verify it  
   **Then** a request is created and I receive a confirmation email with a reference number

3. **Given** a request is submitted  
   **When** it is processed  
   **Then** I receive a response within the legally required timeframe (30 days for erasure, 72 hours for access)

4. **Given** I want to check my request status  
   **When** I enter my reference number  
   **Then** I see the current status and estimated completion date

5. **Given** a request requires identity verification  
   **When** I submit it  
   **Then** I am asked to verify my email via OTP before the request is processed

## Priority
**P0 — Must Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **No Login Required:** Portal accessible without platform account
- **Identity Verification:** Email OTP verification before processing
- **Response Times:** Access/portability: 72 hours; Erasure: 30 days
- **Languages:** Portal available in English; additional languages in Phase 2

## Technical Design

### Request Schema
```sql
CREATE TABLE data_subject_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  request_type VARCHAR(20) CHECK (request_type IN ('access','erasure','portability','consent_withdrawal')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','verified','processing','completed','rejected')),
  submitted_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  response_url VARCHAR(500)
);
```

### API Endpoints
```
POST /api/data-portal/requests          — Submit data request (public)
POST /api/data-portal/verify-email      — Verify email with OTP
GET  /api/data-portal/requests/:ref     — Check request status (public, by reference)
POST /api/admin/data-portal/requests/:id/process — Process request (admin)
```

## Sub-Tasks
- [ ] 13.8.a — Build candidate data portal UI (public, no auth)
- [ ] 13.8.b — Implement email OTP verification
- [ ] 13.8.c — Implement request routing to appropriate handler (erasure/access/portability)
- [ ] 13.8.d — Build admin request management UI
- [ ] 13.8.e — Implement status notification emails

## Testing Strategy
- Unit: OTP verification, request routing
- Integration: Full portal flow — submit → verify → process → notify
- Accessibility: Portal meets WCAG 2.1 AA

## Dependencies
- Story 13.3 (Right to erasure — erasure handler)
- Story 13.4 (Data portability — access/portability handler)
- Story 13.2 (Consent management — withdrawal handler)
