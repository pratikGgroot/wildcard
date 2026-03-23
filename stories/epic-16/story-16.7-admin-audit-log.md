# Story 16.7: Admin Audit Log

## User Story
**As an** admin  
**I want to** see a log of all administrative actions taken in the platform  
**So that** I can audit configuration changes and investigate incidents

## BRD Requirements Covered
- BRD Section 11.2: SOC 2 Type II — security, availability, confidentiality controls audit
- BRD Section 7.5: Observability — full application logging

## Acceptance Criteria
1. **Given** any admin action is taken (user invite, role change, settings update, integration change)  
   **When** the action is performed  
   **Then** it is logged with: action type, performed by, target resource, old value, new value, and timestamp

2. **Given** I navigate to the Admin Audit Log  
   **When** the page loads  
   **Then** I see a searchable, filterable list of admin actions

3. **Given** I filter by action type or user  
   **When** the filter is applied  
   **Then** matching log entries are returned within 1 second

4. **Given** I want to export the audit log  
   **When** I click "Export CSV"  
   **Then** a CSV file is downloaded with the filtered log entries

5. **Given** an audit log entry exists  
   **When** it is stored  
   **Then** it is immutable — no updates or deletes allowed

## Priority
**P0 — Must Have**

## Estimated Effort
**3 story points**

## NFR / Tech Notes
- **Retention:** 5 years (SOC 2 requirement)
- **Immutability:** Append-only
- **Coverage:** All admin actions: user management, RBAC, settings, integrations, AI config
- **Search:** Full-text search on action type and user; date range filter

## Technical Design

### Admin Audit Schema
```sql
CREATE TABLE admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  performed_by UUID REFERENCES users(id),
  action_type VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  old_value JSONB,
  new_value JSONB,
  ip_address INET,
  created_at TIMESTAMP DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Immutability
CREATE RULE no_update_admin_audit AS ON UPDATE TO admin_audit_logs DO INSTEAD NOTHING;
CREATE RULE no_delete_admin_audit AS ON DELETE TO admin_audit_logs DO INSTEAD NOTHING;
```

### API Endpoints
```
GET  /api/admin/audit-log              — List admin audit log (filter: action, user, date)
GET  /api/admin/audit-log/export       — Export as CSV
```

## Sub-Tasks
- [ ] 16.7.a — Implement admin audit log schema with immutability
- [ ] 16.7.b — Implement audit logging middleware for all admin actions
- [ ] 16.7.c — Build admin audit log UI with search and filter
- [ ] 16.7.d — Implement CSV export

## Testing Strategy
- Unit: Immutability enforcement, action coverage
- Integration: Admin action → appears in audit log within 1 second
- Compliance: Verify all admin action types are logged

## Dependencies
- Stories 16.1–16.6 (Admin actions — audit sources)
