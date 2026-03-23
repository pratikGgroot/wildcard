# Epic 16: Admin Panel & Platform Configuration

## Overview
Build the Admin Panel that enables HR Admins to manage users, configure RBAC, manage integrations, set AI model settings, configure AI ethics/governance policies, and manage organization-wide platform settings.

## Business Value
- Enables self-service platform administration without engineering involvement
- Enforces AI ethics and governance policies across the organization
- Provides centralized control over integrations, users, and AI behavior

## BRD Requirements Covered
- Section 12.1: Admin Panel screen — User management, RBAC, integrations, AI settings
- Section 11.3: AI Ethics & Governance — model version control, human-in-the-loop, bias audit schedule, candidate transparency disclosure
- Section 11.1: RBAC configuration (Admin > Recruiter > Hiring Manager > Read-Only Viewer)
- Section 4: HR Admins stakeholder — Configuration, user management, reports

## Priority
**CRITICAL** — Required for platform operation and compliance

## Dependencies
- Epic 12 (Authentication & Authorization)
- Epic 13 (Data Privacy & Compliance)
- Epic 15 (External Integrations)

## NFR / Tech Notes
- **Performance:** Admin panel pages load ≤2 seconds
- **Security:** All admin actions require re-authentication for destructive operations
- **Audit Trail:** Every admin action logged with user, timestamp, before/after state
- **RBAC Enforcement:** Admin-only routes protected at API middleware level
- **AI Governance:** Model version changes require approval workflow before activation

### SLA Requirements
- **Admin Page Load:** ≤2 seconds (P95)
- **User Provisioning:** New user active within 30 seconds of creation
- **AI Settings Change Propagation:** ≤60 seconds to take effect across all services

## Technical Design

### Admin Panel Screens
```
Admin Panel
├── User Management
│   ├── User list (search, filter by role)
│   ├── Create / Edit / Deactivate user
│   └── Bulk import users (CSV)
├── RBAC Configuration
│   ├── Role definitions and permissions
│   └── Role assignment per user
├── Integration Settings
│   ├── OAuth connections (LinkedIn, Gmail, Outlook, Slack)
│   ├── Job board webhook configuration
│   └── File storage configuration
├── AI Settings
│   ├── LLM provider selection and API keys
│   ├── Embedding model selection
│   ├── Scoring weight defaults
│   ├── Shortlist threshold defaults
│   └── Model version management
├── AI Ethics & Governance
│   ├── Human-in-the-loop enforcement toggle
│   ├── Blind review mode default
│   ├── Bias audit schedule configuration
│   ├── Candidate AI disclosure settings
│   └── Automated rejection policy
└── Organization Settings
    ├── Company profile
    ├── Email domain whitelist
    ├── Data residency region
    └── Notification preferences
```

### Data Model
```sql
CREATE TABLE organization_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  setting_key VARCHAR(100) NOT NULL,
  setting_value JSONB NOT NULL,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_org_settings_key ON organization_settings(org_id, setting_key);

CREATE TABLE ai_model_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_type VARCHAR(50) NOT NULL,  -- llm, embedding, bias_detection
  model_name VARCHAR(100) NOT NULL,
  model_version VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT false,
  activated_at TIMESTAMP,
  activated_by UUID REFERENCES users(id),
  change_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  before_state JSONB,
  after_state JSONB,
  ip_address VARCHAR(50),
  performed_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_admin_audit_log_admin ON admin_audit_log(admin_user_id, performed_at DESC);
```

### AI Governance Settings
```typescript
interface AIGovernanceConfig {
  humanInTheLoop: {
    enabled: boolean;
    requireApprovalForStageTransition: boolean;
    requireApprovalForRejection: boolean;
  };
  blindReview: {
    defaultEnabled: boolean;
    fieldsToMask: ('name' | 'address' | 'photo' | 'university' | 'graduation_year')[];
  };
  biasAudit: {
    scheduleFrequency: 'weekly' | 'monthly' | 'quarterly';
    alertThreshold: number;  // bias risk score threshold for alerts
  };
  candidateDisclosure: {
    disclosureEnabled: boolean;
    disclosureText: string;
  };
  automatedRejection: {
    allowed: boolean;
    requireHumanReview: boolean;
  };
}
```

## Stories
- [Story 16.1: User Management](stories/epic-16/story-16.1-user-management.md)
- [Story 16.2: RBAC Configuration](stories/epic-16/story-16.2-rbac-configuration.md)
- [Story 16.3: Integration Settings Management](stories/epic-16/story-16.3-integration-settings.md)
- [Story 16.4: AI Model Settings](stories/epic-16/story-16.4-ai-model-settings.md)
- [Story 16.5: AI Ethics & Governance Configuration](stories/epic-16/story-16.5-ai-ethics-governance.md)
- [Story 16.6: Organization Settings](stories/epic-16/story-16.6-organization-settings.md)
- [Story 16.7: Admin Audit Log](stories/epic-16/story-16.7-admin-audit-log.md)

## Estimated Effort
**16-20 story points** (2-3 sprints)

## Success Metrics
- Admin page load ≤2 seconds
- 100% of admin actions logged
- AI governance settings propagate within 60 seconds
- Zero unauthorized admin access incidents
