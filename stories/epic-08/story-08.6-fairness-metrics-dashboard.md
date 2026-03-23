# Story 08.6: Fairness Metrics Dashboard

## User Story
**As a** compliance officer or HR admin  
**I want to** view fairness and demographic parity metrics for each job pipeline  
**So that** I can monitor for systemic bias and take corrective action

## BRD Requirements Covered
- FR-BD-03: Provide bias risk score per job pipeline
- BRD Section 8.7 Step 3: Demographic parity and equalized odds metrics in analytics dashboard

## Acceptance Criteria
1. **Given** I navigate to the Fairness Dashboard  
   **When** the page loads  
   **Then** I see a list of active jobs with their overall bias risk level (Low/Medium/High)

2. **Given** I select a job  
   **When** the job-level fairness view loads  
   **Then** I see: number of flagged candidates, average score delta, and a bias risk trend over time

3. **Given** the fairness metrics are displayed  
   **When** I view the demographic parity section  
   **Then** I see the disparate impact ratio (DIR) for the job (DIR < 0.8 = potential adverse impact)

4. **Given** a job has DIR < 0.8  
   **When** the metric is displayed  
   **Then** it is highlighted in red with a recommendation to review the scoring criteria

5. **Given** I want to see historical trends  
   **When** I select a date range  
   **Then** the bias risk trend chart updates to show the selected period

## Priority
**P0 — Must Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **Disparate Impact Ratio:** DIR = (selection rate of protected group) / (selection rate of majority group); threshold < 0.8 per EEOC 4/5ths rule
- **Data Source:** Computed from bias_audit_logs; no actual demographic data stored
- **Refresh:** Metrics recomputed daily via background job
- **Access:** Compliance officer and HR admin roles only

## Technical Design

### Fairness Metrics Computation
```python
def compute_disparate_impact_ratio(job_id: UUID) -> float:
    """
    Proxy-based DIR: compare shortlist rates for candidates with vs without detected proxies.
    Note: Uses proxy detection results, not actual demographic data.
    """
    flagged = db.count_shortlisted_with_bias_flags(job_id)
    unflagged = db.count_shortlisted_without_bias_flags(job_id)
    total_flagged = db.count_total_with_bias_flags(job_id)
    total_unflagged = db.count_total_without_bias_flags(job_id)
    
    if total_flagged == 0 or total_unflagged == 0:
        return 1.0  # Cannot compute
    
    rate_flagged = flagged / total_flagged
    rate_unflagged = unflagged / total_unflagged
    
    return rate_flagged / rate_unflagged if rate_unflagged > 0 else 1.0
```

### API Endpoints
```
GET /api/fairness/dashboard              — Org-level fairness overview
GET /api/fairness/jobs/:id               — Job-level fairness metrics
GET /api/fairness/jobs/:id/trend         — Historical bias risk trend
```

## Sub-Tasks
- [ ] 08.6.a — Implement disparate impact ratio computation
- [ ] 08.6.b — Build fairness dashboard UI with job list and risk levels
- [ ] 08.6.c — Build job-level fairness detail view with DIR and trend chart
- [ ] 08.6.d — Implement daily metrics refresh background job
- [ ] 08.6.e — Implement RBAC for compliance officer access

## Testing Strategy
- Unit: DIR calculation, risk level thresholds
- Integration: Metrics computation from real audit log data
- RBAC: Verify only compliance officers and admins can access

## Dependencies
- Story 08.3 (Bias flagging — data source)
- Story 08.5 (Audit log — data source)
- Epic 12 (RBAC — access control)
