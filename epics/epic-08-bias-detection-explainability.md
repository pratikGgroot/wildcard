# Epic 08: Bias Detection & Explainability

## Overview
Implement fairness monitoring and explainability features to detect demographic bias in AI scoring and provide transparent explanations for all AI decisions.

## Business Value
- Ensures fair and compliant hiring practices
- Builds trust in AI recommendations through transparency
- Reduces legal risk from discriminatory hiring

## BRD Requirements Covered
- FR-BD-01: Analyze scores across demographic proxies
- FR-BD-02: Flag demographic influence on scores
- FR-BD-03: Provide bias risk score per job
- FR-BD-04: Mask demographic proxy fields during scoring
- FR-BD-05: Audit log of every AI decision
- FR-BD-06: Compliance report export

## Priority
**CRITICAL** - Legal and ethical requirement

## NFR / Tech Notes
- **Compliance:** GDPR, DPDP Act, EEOC compliance (NFR 11.2)
- **Fairness Metrics:** Demographic parity, equalized odds
- **Libraries:** Microsoft Fairlearn, IBM AIF360
- **Audit Retention:** 5 years (NFR 9.2)
- **Masking:** Name, address, photo masked during scoring

## Technical Design

### Bias Detection Pipeline
```
Candidate Scores Generated
       ↓
[Identify Demographic Proxies]
       ↓
[Counterfactual Analysis: Rescore with Masked Fields]
       ↓
[Calculate Score Delta]
       ↓
[If Delta > Threshold: Flag as Biased]
       ↓
[Generate Fairness Metrics]
       ↓
[Store Audit Log]
```

### Fairness Metrics
```python
# Demographic Parity: P(shortlist | group A) ≈ P(shortlist | group B)
# Equalized Odds: P(shortlist | qualified, group A) ≈ P(shortlist | qualified, group B)
# Disparate Impact Ratio: min(P(A), P(B)) / max(P(A), P(B)) ≥ 0.8
```

### Database Schema
```sql
CREATE TABLE bias_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES applications(id),
  job_id UUID REFERENCES jobs(id),
  
  proxy_fields_detected JSONB,
  score_with_proxy DECIMAL(5,2),
  score_without_proxy DECIMAL(5,2),
  score_delta DECIMAL(5,2),
  
  risk_level VARCHAR(20), -- low, medium, high
  flagged BOOLEAN DEFAULT false,
  flagged_at TIMESTAMP,
  
  reviewed_by UUID REFERENCES users(id),
  resolution TEXT,
  resolved_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE job_fairness_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id),
  
  demographic_parity DECIMAL(5,4),
  equalized_odds DECIMAL(5,4),
  disparate_impact_ratio DECIMAL(5,4),
  
  bias_risk_score VARCHAR(20), -- low, medium, high
  flagged_candidates_count INTEGER,
  
  calculated_at TIMESTAMP DEFAULT NOW()
);
```

## Stories
- Story 08.1: Demographic Proxy Detection
- Story 08.2: Counterfactual Score Analysis
- Story 08.3: Bias Flagging System
- Story 08.4: Field Masking During Scoring
- Story 08.5: Audit Log Generation
- Story 08.6: Fairness Metrics Dashboard
- Story 08.7: Compliance Report Export
- Story 08.8: Explainability Panel ("Why this score?")

## Estimated Effort
**21-26 story points** (3-4 sprints)

## Success Metrics
- Bias detection accuracy ≥85%
- Demographic score variance reduced by ≥30%
- 100% of AI decisions logged with explainability
- Zero compliance violations
