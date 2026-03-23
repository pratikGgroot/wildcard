# Story 16.6: Organization Settings

## User Story
**As an** admin  
**I want to** configure organization-wide settings  
**So that** the platform reflects our company's branding, timezone, and preferences

## BRD Requirements Covered
- BRD Section 12.1: Admin Panel — platform configuration

## Acceptance Criteria
1. **Given** I navigate to Organization Settings  
   **When** the page loads  
   **Then** I see: org name, logo, timezone, default language, and data residency region

2. **Given** I upload a company logo  
   **When** the upload completes  
   **Then** the logo appears in the platform header and email templates

3. **Given** I change the default timezone  
   **When** the change is saved  
   **Then** all timestamps in the platform display in the new timezone for all users

4. **Given** I configure the data residency region  
   **When** I save  
   **Then** I am shown a warning about data migration implications and asked to confirm

5. **Given** I configure a custom domain  
   **When** DNS is verified  
   **Then** the platform is accessible at the custom domain

## Priority
**P0 — Must Have**

## Estimated Effort
**3 story points**

## NFR / Tech Notes
- **Logo:** Stored in S3; max 2MB; PNG/SVG
- **Timezone:** IANA timezone format (e.g., "Asia/Kolkata")
- **Data Residency:** Change requires migration (Story 13.6)
- **Custom Domain:** Optional; requires DNS CNAME verification

## Technical Design

### Organization Schema
```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  logo_url VARCHAR(500),
  timezone VARCHAR(50) DEFAULT 'UTC',
  default_language VARCHAR(10) DEFAULT 'en',
  data_residency_region VARCHAR(20) DEFAULT 'us',
  custom_domain VARCHAR(200),
  custom_domain_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### API Endpoints
```
GET  /api/admin/organization          — Get org settings
PUT  /api/admin/organization          — Update org settings
POST /api/admin/organization/logo     — Upload logo
POST /api/admin/organization/verify-domain — Verify custom domain DNS
```

## Sub-Tasks
- [ ] 16.6.a — Build organization settings UI
- [ ] 16.6.b — Implement logo upload and display
- [ ] 16.6.c — Implement timezone configuration with display update
- [ ] 16.6.d — Implement custom domain verification

## Testing Strategy
- Unit: Timezone display, logo URL generation
- Integration: Settings change → reflected across platform

## Dependencies
- Epic 15 (S3 — logo storage)
- Story 13.6 (Data residency — region change)
