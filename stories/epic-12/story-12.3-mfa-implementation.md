# Story 12.3: Multi-Factor Authentication (MFA)

## User Story
**As an** admin  
**I want to** enforce MFA for admin accounts  
**So that** privileged accounts are protected against credential compromise

## BRD Requirements Covered
- BRD Section 11.1: MFA enforced for admin accounts

## Acceptance Criteria
1. **Given** I am an admin logging in with email/password  
   **When** my credentials are verified  
   **Then** I am prompted for a TOTP code before receiving my JWT

2. **Given** I have not set up MFA  
   **When** I first log in as admin  
   **Then** I am forced to set up MFA before accessing the platform

3. **Given** I enter a valid TOTP code  
   **When** verification succeeds  
   **Then** I receive my JWT and am logged in

4. **Given** I enter an invalid TOTP code 3 times  
   **When** the 3rd failure occurs  
   **Then** my session is terminated and I must restart the login flow

5. **Given** I lose access to my authenticator  
   **When** I use a backup code  
   **Then** I can log in and am prompted to set up a new authenticator

6. **Given** an org admin wants to enforce MFA for all users  
   **When** they enable "Require MFA for all users"  
   **Then** all users are prompted to set up MFA on next login

## Priority
**P0 — Must Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **TOTP Standard:** RFC 6238 (30-second window, SHA-1)
- **Backup Codes:** 8 single-use backup codes generated at MFA setup
- **Enforcement:** Mandatory for Admin role; optional (org-configurable) for others
- **QR Code:** TOTP secret displayed as QR code for authenticator app setup

## Technical Design

### MFA Schema
```sql
CREATE TABLE user_mfa (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE PRIMARY KEY,
  totp_secret_encrypted TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT FALSE,
  backup_codes_hashed TEXT[],  -- 8 hashed backup codes
  setup_at TIMESTAMP,
  last_used_at TIMESTAMP
);
```

### API Endpoints
```
POST /api/auth/mfa/setup/initiate   — Generate TOTP secret + QR code
POST /api/auth/mfa/setup/verify     — Verify TOTP and enable MFA
POST /api/auth/mfa/verify           — Verify TOTP during login
POST /api/auth/mfa/backup-code      — Use backup code
POST /api/auth/mfa/disable          — Disable MFA (admin approval required)
```

## Sub-Tasks
- [ ] 12.3.a — Implement TOTP secret generation and QR code display
- [ ] 12.3.b — Implement TOTP verification during login
- [ ] 12.3.c — Implement backup code generation and single-use validation
- [ ] 12.3.d — Implement MFA enforcement for admin role
- [ ] 12.3.e — Build MFA setup UI (QR code + verification step)

## Testing Strategy
- Unit: TOTP verification, backup code single-use enforcement
- Integration: Full MFA setup → login flow
- Security: Verify replay attack prevention (used codes rejected)

## Dependencies
- Story 12.1 (Email/password auth — MFA added as second factor)
