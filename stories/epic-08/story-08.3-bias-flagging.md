# Story 08.3: Bias Risk Flagging & Review Queue

## User Story
**As a** recruiter or compliance officer  
**I want to** see which candidates have been flagged for potential bias  
**So that** I can review and resolve bias concerns before making hiring decisions

## BRD Requirements Covered
- FR-BD-02: Flag if a demographic proxy appears to significantly influence a score
- FR-BD-03: Provide bias risk score per job pipeline

## Acceptance Criteria
1. **Given** a candidate has been flagged for potential bias  
   **When** a recruiter views the candidate card  
   **Then** a yellow warning badge is shown: "Bias Risk: High — Review Recommended"

2. **Given** a recruiter clicks the bias warning badge  
   **When** the explanation panel opens  
   **Then** they see: which proxy was detected, original score, masked score, delta, and a plain-English explanation

3. **Given** a job pipeline has multiple flagged candidates  
   **When** a recruiter views the pipeline  
   **Then** a banner shows: "X candidates flagged for bias review" with a link to the review queue

4. **Given** a compliance officer views the bias review queue  
   **When** they open a flagged case  
   **Then** they can mark it as: "Reviewed — No Action", "Reviewed — Score Adjusted", or "Reviewed — Escalated"

5. **Given** a bias risk score is computed per job  
   **When** the recruiter views the job dashboard  
   **Then** they see an overall bias risk level (Low/Medium/High) for the pipeline

## Priority
**P0 — Must Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **Risk Levels:** Low (delta ≤ 5), Medium (5 < delta ≤ 10), High (delta > 10)
- **Job-Level Risk:** Aggregate of individual candidate risk levels
- **Review Audit:** All review actions logged with reviewer, timestamp, and resolution

## Technical Design

### Job-Level Bias Risk Calculation
```python
def compute_job_bias_risk(job_id: UUID) -> str:
    flags = db.get_bias_flags(job_id)
    if not flags:
        return "Low"
    high_count = sum(1 for f in flags if f.risk_level == "High")
    ratio = high_count / len(flags)
    if ratio > 0.20:
        return "High"
    elif ratio > 0.10:
        return "Medium"
    return "Low"
```

### API Endpoints
```
GET  /api/jobs/:id/bias/risk-score        — Get job-level bias risk
GET  /api/bias/review-queue               — List all flagged cases (compliance officer)
POST /api/bias/:id/resolve                — Mark bias flag as reviewed with resolution
```

## Sub-Tasks
- [ ] 08.3.a — Build bias warning badge component for candidate card
- [ ] 08.3.b — Build bias explanation panel
- [ ] 08.3.c — Build bias review queue UI for compliance officers
- [ ] 08.3.d — Implement job-level bias risk score calculation
- [ ] 08.3.e — Implement review resolution logging

## Testing Strategy
- Unit: Risk level calculation, job-level aggregation
- Integration: Flag creation → review queue → resolution flow
- RBAC: Verify compliance officer role can access review queue

## Dependencies
- Story 08.2 (Counterfactual analysis — creates flags)
- Epic 12 (RBAC — compliance officer role)
