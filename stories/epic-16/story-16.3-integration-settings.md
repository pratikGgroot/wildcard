# Story 16.3: Integration Settings

## User Story
**As an** admin  
**I want to** manage all third-party integrations from a central settings page  
**So that** I can configure, test, and monitor all external connections in one place

## BRD Requirements Covered
- BRD Section 12.1: Admin Panel — Integrations
- BRD Section 10: All integration requirements

## Acceptance Criteria
1. **Given** I navigate to Integration Settings  
   **When** the page loads  
   **Then** I see all available integrations with their connection status (Connected/Disconnected)

2. **Given** I click on an integration  
   **When** the detail panel opens  
   **Then** I see: connection status, last sync time, configuration options, and a "Test Connection" button

3. **Given** I click "Test Connection"  
   **When** the test runs  
   **Then** I see a success or failure message with details

4. **Given** an integration is failing  
   **When** I view the integration  
   **Then** I see the error message and a "Reconnect" button

5. **Given** I configure a new integration  
   **When** I save the configuration  
   **Then** the integration is activated and a test connection is run automatically

## Priority
**P0 — Must Have**

## Estimated Effort
**3 story points**

## NFR / Tech Notes
- **Integrations Shown:** LinkedIn, Gmail, Outlook, Slack, Job Boards (Indeed, Naukri), AWS S3
- **Status Polling:** Integration health checked every 15 minutes
- **Credentials:** Never shown in UI after initial setup (masked)

## Technical Design

### Integration Registry
```typescript
const INTEGRATIONS = [
  { id: "linkedin", name: "LinkedIn", category: "sourcing", icon: "linkedin" },
  { id: "gmail", name: "Gmail", category: "email", icon: "gmail" },
  { id: "outlook", name: "Outlook", category: "email", icon: "outlook" },
  { id: "slack", name: "Slack", category: "notifications", icon: "slack" },
  { id: "indeed", name: "Indeed", category: "job_boards", icon: "indeed" },
  { id: "s3", name: "AWS S3", category: "storage", icon: "aws" }
];
```

### API Endpoints
```
GET  /api/admin/integrations              — List all integrations with status
GET  /api/admin/integrations/:id          — Get integration detail
POST /api/admin/integrations/:id/test     — Test connection
POST /api/admin/integrations/:id/reconnect — Reconnect integration
```

## Sub-Tasks
- [ ] 16.3.a — Build integration settings page with status cards
- [ ] 16.3.b — Build integration detail panel with test connection
- [ ] 16.3.c — Implement integration health polling
- [ ] 16.3.d — Implement reconnect flow for failed integrations

## Testing Strategy
- Unit: Status aggregation, health check logic
- Integration: Test connection for each integration type
- UI: Status cards update when integration status changes

## Dependencies
- Epic 15 (All integrations — status data sources)
