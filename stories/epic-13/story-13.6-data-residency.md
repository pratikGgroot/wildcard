# Story 13.6: Data Residency

## User Story
**As an** enterprise customer  
**I want to** ensure my candidate data is stored in a specific geographic region  
**So that** I comply with local data sovereignty laws (GDPR EU, DPDP India)

## BRD Requirements Covered
- BRD Section 9.3: Data residency — support for region-specific data storage (EU, India)

## Acceptance Criteria
1. **Given** an org is configured for EU data residency  
   **When** candidate data is stored  
   **Then** it is stored in AWS eu-west-1 (Ireland) or eu-central-1 (Frankfurt)

2. **Given** an org is configured for India data residency  
   **When** candidate data is stored  
   **Then** it is stored in AWS ap-south-1 (Mumbai)

3. **Given** data residency is configured  
   **When** AI processing runs  
   **Then** data is not transferred outside the configured region (LLM API calls use region-specific endpoints where available)

4. **Given** an org changes their data residency region  
   **When** the change is requested  
   **Then** a data migration plan is presented; migration requires explicit admin approval

## Priority
**P1 — Should Have**

## Estimated Effort
**8 story points**

## NFR / Tech Notes
- **Regions:** EU (eu-west-1, eu-central-1), India (ap-south-1), US (us-east-1, us-west-2)
- **Implementation:** Separate database instances per region; org-to-region mapping in global config DB
- **LLM:** Use Anthropic/OpenAI region-specific endpoints where available; document data processing locations
- **S3:** Region-specific S3 buckets for resume file storage

## Technical Design

### Org Region Configuration
```sql
-- Global config database (region-agnostic)
CREATE TABLE org_data_residency (
  org_id UUID PRIMARY KEY,
  region VARCHAR(20) NOT NULL CHECK (region IN ('eu', 'india', 'us')),
  db_connection_string_encrypted TEXT NOT NULL,
  s3_bucket VARCHAR(100) NOT NULL,
  configured_at TIMESTAMP DEFAULT NOW()
);
```

### Region Router
```python
class RegionRouter:
    def get_db_connection(self, org_id: UUID) -> AsyncConnection:
        region = self.config.get_org_region(org_id)
        return self.connections[region]
    
    def get_s3_bucket(self, org_id: UUID) -> str:
        region = self.config.get_org_region(org_id)
        return REGION_BUCKETS[region]
```

### API Endpoints
```
GET  /api/admin/data-residency          — Get current residency config
POST /api/admin/data-residency          — Configure data residency (admin)
POST /api/admin/data-residency/migrate  — Request region migration
```

## Sub-Tasks
- [ ] 13.6.a — Set up multi-region database infrastructure
- [ ] 13.6.b — Implement region router for DB and S3 connections
- [ ] 13.6.c — Implement org-to-region mapping
- [ ] 13.6.d — Build data residency configuration UI in admin panel
- [ ] 13.6.e — Document LLM data processing locations for compliance

## Testing Strategy
- Unit: Region routing, connection selection
- Integration: Data written to correct region DB and S3 bucket
- Compliance: Verify no cross-region data transfer for EU/India orgs

## Dependencies
- Epic 15 (AWS S3 — region-specific buckets)
- Epic 16 (Admin panel — residency configuration)
