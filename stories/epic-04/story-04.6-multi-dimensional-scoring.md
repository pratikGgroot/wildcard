# Story 04.6: Multi-Dimensional Scoring (Technical, Culture, Growth)

## User Story
**As a** recruiter  
**I want to** see separate scores for technical fit, culture fit, and growth potential  
**So that** I can make more nuanced hiring decisions beyond a single composite score

## BRD Requirements Covered
- FR-SC-06: Support multi-dimensional scoring (technical fit, culture fit, growth potential)

## Acceptance Criteria
1. **Given** multi-dimensional scoring is enabled for a job  
   **When** scoring runs  
   **Then** three separate sub-scores are computed: Technical Fit, Culture Fit, Growth Potential

2. **Given** sub-scores are computed  
   **When** the candidate card is displayed  
   **Then** a radar/spider chart shows all three dimensions alongside the composite score

3. **Given** a recruiter wants to sort candidates  
   **When** they select a sort dimension  
   **Then** they can sort by any individual dimension (not just composite)

4. **Given** culture fit scoring is enabled  
   **When** the job is configured  
   **Then** the recruiter can define culture values/competencies that drive the culture fit score

5. **Given** this feature is marked "Good to Have"  
   **When** it is not enabled for a job  
   **Then** only the composite score is shown (no regression in existing behavior)

## Priority
**P3 — Good to Have**

## Estimated Effort
**8 story points**

## NFR / Tech Notes
- **Feature Flag:** Controlled by org-level feature flag (disabled by default)
- **Culture Fit Input:** Recruiter-defined competency descriptions embedded and compared
- **Growth Potential:** Derived from career trajectory analysis (title progression, tenure patterns)
- **Radar Chart:** Rendered using Recharts or Nivo

## Technical Design

### Scoring Dimensions
```python
MULTI_DIM_DIMENSIONS = {
    "technical_fit": {
        "criteria": ["skills", "experience", "certifications"],
        "default_weight": 0.50
    },
    "culture_fit": {
        "criteria": ["values_alignment", "communication_style"],
        "default_weight": 0.25
    },
    "growth_potential": {
        "criteria": ["career_trajectory", "learning_indicators"],
        "default_weight": 0.25
    }
}
```

### API Endpoints
```
GET  /api/applications/:id/score/dimensions   — Get multi-dimensional scores
POST /api/jobs/:id/culture-competencies       — Define culture fit criteria
```

## Sub-Tasks
- [ ] 04.6.a — Implement multi-dimensional scoring engine
- [ ] 04.6.b — Build culture competency definition UI
- [ ] 04.6.c — Build radar chart component for score visualization
- [ ] 04.6.d — Implement dimension-based sorting in pipeline view
- [ ] 04.6.e — Implement feature flag gating

## Testing Strategy
- Unit: Dimension score computation, feature flag behavior
- Integration: Full multi-dim scoring pipeline
- Visual: Radar chart renders correctly with varied score distributions

## Dependencies
- Story 04.2 (Fit score calculation — base scoring engine)
- Story 04.1 (Embedding generation — dimension-specific embeddings)
