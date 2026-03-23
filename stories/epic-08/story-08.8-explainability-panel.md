# Story 08.8: Explainability Panel ("Why This Score?")

## User Story
**As a** recruiter  
**I want to** understand why a candidate received a specific AI score  
**So that** I can trust the AI's recommendation and explain it to hiring managers

## BRD Requirements Covered
- BRD Section 8.8: Explainability Layer — "Why this score?" button on every candidate card; fit score breakdown via SHAP-like weighted feature attribution; LLM-generated rationale narrative

## Acceptance Criteria
1. **Given** a candidate card is displayed  
   **When** the recruiter clicks "Why this score?"  
   **Then** an explainability panel opens with a full breakdown

2. **Given** the panel is open  
   **When** the recruiter views it  
   **Then** they see: dimension scores (bar chart), top contributing factors, top detractors, and a plain-English narrative

3. **Given** the panel shows a bias flag  
   **When** the recruiter views the bias section  
   **Then** they see: which proxy was detected, the counterfactual delta, and a plain-English explanation of the potential bias

4. **Given** the panel is open  
   **When** the recruiter clicks "View Audit Trail"  
   **Then** they see the full AI audit log entry for this decision (model, version, timestamp)

5. **Given** the explainability data is displayed  
   **When** the recruiter hovers over a dimension bar  
   **Then** a tooltip shows the specific evidence from the candidate's profile

## Priority
**P0 — Must Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **Panel Load:** ≤ 500ms (data pre-computed at scoring time)
- **Narrative:** LLM-generated, cached per (candidate_id, job_id, score_version)
- **Bias Section:** Only shown if bias flag exists for this candidate
- **Audit Link:** Links to Story 08.5 audit log entry

## Technical Design

### Explainability Panel Sections
```
ExplainabilityPanel
├── ScoreOverview (overall score, confidence)
├── DimensionBreakdown (bar chart: Technical, Experience, Education, Projects)
│   └── EvidenceTooltip (per dimension)
├── TopFactors (top 3 positive contributors)
├── TopGaps (top 3 detractors)
├── NarrativeSummary (LLM-generated plain English)
├── BiasSection (conditional — only if flagged)
│   ├── ProxyDetected
│   ├── CounterfactualDelta
│   └── BiasExplanation
└── AuditTrailLink → audit log entry
```

### API Endpoints
```
GET /api/applications/:id/explainability   — Get full explainability data
```

## Sub-Tasks
- [ ] 08.8.a — Build ExplainabilityPanel component with all sections
- [ ] 08.8.b — Build DimensionBreakdown bar chart with evidence tooltips
- [ ] 08.8.c — Build BiasSection (conditional rendering)
- [ ] 08.8.d — Implement audit trail link to Story 08.5
- [ ] 08.8.e — Implement LLM narrative generation and caching

## Testing Strategy
- Unit: Conditional bias section rendering, narrative caching
- Integration: Full explainability data assembly
- UI: Panel opens within 500ms, all sections render correctly

## Dependencies
- Story 04.2 (Fit score — dimension breakdown data)
- Story 08.2 (Counterfactual analysis — bias section data)
- Story 08.5 (Audit log — audit trail link)
