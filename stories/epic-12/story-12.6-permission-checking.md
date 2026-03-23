# Story 12.6: UI Permission Checking

## User Story
**As a** user  
**I want to** see only the UI elements I have permission to use  
**So that** the interface is clean and I'm not confused by disabled or inaccessible features

## BRD Requirements Covered
- BRD Section 7.4: Role-Based Access Control enforced at API and UI layer

## Acceptance Criteria
1. **Given** I am a hiring manager  
   **When** I view the pipeline  
   **Then** I do not see "Move Stage", "Bulk Actions", or "Configure Stages" buttons

2. **Given** I am a read-only viewer  
   **When** I view a candidate profile  
   **Then** I see all information but no action buttons (no "Add Note", "Move Stage", etc.)

3. **Given** I am a recruiter  
   **When** I view the admin panel  
   **Then** I see a 403 page or the admin panel link is not shown in navigation

4. **Given** my role changes  
   **When** I refresh the page  
   **Then** the UI reflects my new permissions

## Priority
**P0 — Must Have**

## Estimated Effort
**3 story points**

## NFR / Tech Notes
- **Permission Source:** Fetched from `/api/auth/permissions` on login; cached in app state
- **UI Hiding:** Buttons/links hidden (not just disabled) for unauthorized actions
- **Defense in Depth:** UI hiding is UX only; API enforcement (Story 12.5) is the security layer

## Technical Design

### Permission Hook
```typescript
const usePermission = (permission: string): boolean => {
  const { permissions } = useAuthStore();
  return permissions.includes(permission) || permissions.includes('*');
};

// Usage
const canMoveStage = usePermission('pipeline:write');
{canMoveStage && <MoveStageButton />}
```

## Sub-Tasks
- [ ] 12.6.a — Implement usePermission hook
- [ ] 12.6.b — Apply permission checks to all action buttons and navigation items
- [ ] 12.6.c — Implement permission refresh on role change

## Testing Strategy
- Unit: usePermission hook for all role/permission combinations
- UI: Verify buttons hidden for each role
- Integration: UI permissions match API permissions

## Dependencies
- Story 12.5 (RBAC middleware — permission definitions)
- Story 12.4 (JWT — role in token)
