# Story 12.2: SSO Integration (SAML / OIDC)

## User Story
**As an** enterprise user  
**I want to** log in using my company's SSO provider  
**So that** I don't need a separate password for the platform

## BRD Requirements Covered
- BRD Section 11.1: SSO via SAML 2.0 / OIDC (Okta, Google Workspace, Azure AD)
- BRD Section 7.4: OAuth 2.0 / SSO support

## Acceptance Criteria
1. **Given** my org has SSO configured with Okta  
   **When** I click "Sign in with SSO"  
   **Then** I am redirected to Okta; on successful authentication I am logged into the platform

2. **Given** SSO authentication succeeds  
   **When** I am redirected back  
   **Then** a platform JWT is issued and I am logged in with my org role

3. **Given** my SSO account is deprovisioned  
   **When** I try to log in  
   **Then** I receive: "Your account has been deactivated. Contact your administrator."

4. **Given** an admin configures SSO  
   **When** they provide the IdP metadata URL  
   **Then** the platform fetches and stores the SAML metadata automatically

5. **Given** SSO is configured  
   **When** a new user logs in via SSO for the first time  
   **Then** a platform account is automatically provisioned with the default role

## Priority
**P0 — Must Have**

## Estimated Effort
**8 story points**

## NFR / Tech Notes
- **Protocols:** SAML 2.0 (enterprise) + OIDC (Google Workspace, Azure AD)
- **Providers:** Okta, Google Workspace, Azure AD (primary); generic SAML/OIDC for others
- **JIT Provisioning:** Auto-create user on first SSO login
- **Role Mapping:** Map IdP groups to platform roles (configurable)

## Technical Design

### SSO Configuration Schema
```sql
CREATE TABLE sso_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) UNIQUE,
  protocol VARCHAR(10) CHECK (protocol IN ('saml','oidc')),
  provider_name VARCHAR(50),
  metadata_url VARCHAR(500),
  client_id VARCHAR(200),
  client_secret_encrypted TEXT,
  role_mapping JSONB,  -- {"admin_group": "Admin", "recruiter_group": "Recruiter"}
  is_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### API Endpoints
```
GET  /api/auth/sso/initiate/:org_slug   — Initiate SSO flow
GET  /api/auth/sso/callback             — SAML/OIDC callback
POST /api/admin/sso/configure           — Configure SSO (admin)
GET  /api/admin/sso/metadata            — Get SP metadata for IdP configuration
```

## Sub-Tasks
- [ ] 12.2.a — Implement SAML 2.0 SP (using python3-saml or passport-saml)
- [ ] 12.2.b — Implement OIDC client (Google, Azure AD)
- [ ] 12.2.c — Implement JIT user provisioning on first SSO login
- [ ] 12.2.d — Implement role mapping from IdP groups
- [ ] 12.2.e — Build SSO configuration UI in admin panel

## Testing Strategy
- Unit: Role mapping, JIT provisioning
- Integration: Full SSO flow with test Okta/Google tenant
- Security: Verify SAML assertion signature validation

## Dependencies
- Story 12.1 (Auth foundation — JWT issuance)
- Epic 16 (Admin panel — SSO configuration UI)
