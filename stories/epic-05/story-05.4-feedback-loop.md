# Story 05.4: Recruiter Feedback Loop for Score Improvement

## User Story
**As a** system  
**I want to** learn from recruiter accept/reject decisions on shortlist recommendations  
**So that** future shortlists improve over time based on recruiter preferences

## BRD Requirements Covered
- FR-SL-04: System learns from recruiter accept/reject feedback to improve future shortlists
- BRD Section 8.4: Feedback loop — recruiter accept/reject actions stored and used to fine-tune scoring weights via RLHF-lite approach

## Acceptance Criteria
1. **Given** a recruiter accepts or rejects a shortlist recommendation  
   **When** the action is saved  
   **Then** the signal (accept=positive, reject=negative) is stored as a preference record

2. **Given** enough preference signals have been collected (≥ 50 per job type)  
   **When** the weight optimization job runs  
   **Then** scoring dimension weights are adjusted to better predict recruiter preferences

3. **Given** weights have been adjusted  
   **When** the next shortlist is generated  
   **Then** it uses the updated weights and shows a "Personalized for your preferences" indicator

4. **Given** a recruiter wants to reset learned preferences  
   **When** they click "Reset to Default Weights"  
   **Then** the weights revert to system defaults and the preference history is cleared

5. **Given** weight adjustments are made  
   **When** the change is logged  
   **Then** the audit log records: old weights, new weights, number of signals used, and timestamp

## Priority
**P1 — Should Have**

## Estimated Effort
**8 story points**

## NFR / Tech Notes
- **Approach:** RLHF-lite preference learning (Bradley-Terry model or simple weight regression)
- **Minimum Signals:** ≥ 50 accept/reject pairs before weight adjustment
- **Weight Bounds:** Weights constrained to [0.05, 0.70] per dimension to prevent collapse
- **Scope:** Weights learned per recruiter (personalized) or per org (shared) — configurable
- **Privacy:** Preference signals are internal; not exposed to candidates

## Technical Design

### Preference Storage
```sql
CREATE TABLE recruiter_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id UUID REFERENCES users(id),
  job_id UUID REFERENCES jobs(id),
  application_id UUID REFERENCES applications(id),
  action VARCHAR(10) CHECK (action IN ('accept', 'reject')),
  fit_score FLOAT,
  score_breakdown JSONB,
  recorded_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE learned_weights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id UUID REFERENCES users(id),
  job_category VARCHAR(100),
  weights JSONB NOT NULL,  -- {"skills": 0.45, "experience": 0.35, ...}
  signal_count INT,
  computed_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);
```

### Weight Optimization (Simplified)
```python
def optimize_weights(preferences: list[Preference]) -> dict:
    """
    Simple logistic regression: predict accept/reject from score breakdown.
    Coefficients become new dimension weights.
    """
    X = np.array([[p.breakdown[d] for d in DIMENSIONS] for p in preferences])
    y = np.array([1 if p.action == 'accept' else 0 for p in preferences])
    
    model = LogisticRegression(C=1.0)
    model.fit(X, y)
    
    raw_weights = np.abs(model.coef_[0])
    normalized = raw_weights / raw_weights.sum()
    # Clip to bounds
    clipped = np.clip(normalized, 0.05, 0.70)
    return dict(zip(DIMENSIONS, clipped / clipped.sum()))
```

### API Endpoints
```
GET  /api/recruiters/:id/learned-weights        — Get current learned weights
POST /api/recruiters/:id/learned-weights/reset  — Reset to defaults
GET  /api/recruiters/:id/preferences/stats      — Signal count and quality metrics
```

## Sub-Tasks
- [ ] 05.4.a — Implement preference signal storage on accept/reject
- [ ] 05.4.b — Implement weight optimization job (logistic regression)
- [ ] 05.4.c — Implement weight application in scoring pipeline
- [ ] 05.4.d — Build "Personalized" indicator in shortlist UI
- [ ] 05.4.e — Implement reset to defaults flow
- [ ] 05.4.f — Write unit tests for weight optimization and bounds enforcement

## Testing Strategy
- Unit: Weight optimization, bounds enforcement, minimum signal threshold
- Integration: Full feedback → weight update → re-scoring cycle
- Quality: Verify shortlist quality improves with simulated preference data

## Dependencies
- Story 05.3 (Accept/reject/defer — source of preference signals)
- Story 04.2 (Fit score calculation — uses learned weights)
