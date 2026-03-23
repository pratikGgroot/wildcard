# Story 03.3: AI Insights Display

## User Story
**As a** recruiter  
**I want to** see AI-generated insights on a candidate's profile  
**So that** I can quickly understand their strengths, gaps, and overall fit without reading the full resume

## BRD Requirements Covered
- FR-CP-03: Display candidate's AI fit score, summary, and skill match breakdown
- BRD Section 8.3: Candidate Summarization Agent — 3–5 sentence summary per candidate per job
- BRD Section 8.8: Explainability Layer — "Why this score?" button on every candidate card

## Acceptance Criteria
1. **Given** an AI summary has been generated for a candidate+job pair  
   **When** the profile loads  
   **Then** the summary is displayed as 3–5 sentences with a "Strong Match / Moderate Match / Weak Match" badge

2. **Given** the summary is displayed  
   **When** the recruiter clicks "Regenerate Summary"  
   **Then** a new summary is generated and the old one is replaced (old version retained in history)

3. **Given** a fit score is displayed  
   **When** the recruiter clicks "Why this score?"  
   **Then** an explainability panel opens showing: top contributing factors, top detractors, and a plain-English explanation

4. **Given** the explainability panel is open  
   **When** the recruiter hovers over a criterion  
   **Then** they see the specific evidence from the candidate's profile that drove that score

5. **Given** the AI summary is being generated  
   **When** the profile loads before generation completes  
   **Then** a loading skeleton is shown with "AI analysis in progress..." message

6. **Given** the AI service is unavailable  
   **When** the profile loads  
   **Then** a graceful fallback message is shown: "AI insights temporarily unavailable" with a retry button

## Priority
**P0 — Must Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **Summary Generation Latency:** ≤ 5 seconds (async, shown when ready)
- **Caching:** Summary cached per (candidate_id, job_id); invalidated on profile or JD change
- **Model:** Claude claude-sonnet-4 or GPT-4o with constrained prompt
- **Explainability:** SHAP-like weighted feature attribution for score breakdown
- **Audit:** Every AI output logged with model version, input hash, timestamp (BRD Section 8.8)

## Technical Design

### Summary Generation
```python
SUMMARY_PROMPT = """
You are a senior recruiter assistant. Given the candidate profile and job requirements below,
write a 3-5 sentence objective summary highlighting:
1. Key strengths relevant to the role
2. Potential gaps or concerns
3. Overall recommendation: Strong Match / Moderate Match / Weak Match

Candidate Profile: {profile_json}
Job Requirements: {jd_criteria_json}

Return JSON: { "summary": "...", "recommendation": "Strong Match|Moderate Match|Weak Match" }
"""
```

### Explainability Panel Data
```typescript
interface ExplainabilityData {
  overall_score: number;
  dimensions: {
    name: string;           // "Technical Skills Match"
    weight: number;         // 0.40
    score: number;          // 0.85
    contribution: number;   // 34 points
    evidence: string;       // "Candidate lists Python, FastAPI, PostgreSQL — all required"
    top_matches: string[];
    gaps: string[];
  }[];
  plain_english: string;    // "Strong technical match. Main gap is AWS experience."
}
```

### API Endpoints
```
GET  /api/candidates/:id/applications/:jobId/summary      — Get AI summary
POST /api/candidates/:id/applications/:jobId/summary/regenerate — Regenerate
GET  /api/candidates/:id/applications/:jobId/explainability — Get score explanation
```

## Sub-Tasks
- [ ] 03.3.a — Build AI summary display component with recommendation badge
- [ ] 03.3.b — Implement regenerate summary flow with version history
- [ ] 03.3.c — Build explainability panel with criterion breakdown
- [ ] 03.3.d — Implement loading skeleton and error fallback states
- [ ] 03.3.e — Write unit tests for summary caching and invalidation logic

## Testing Strategy
- Unit: Cache invalidation triggers, fallback rendering
- Integration: Summary generation API with real LLM
- UI: Explainability panel hover interactions

## Dependencies
- Story 03.1 (Candidate profile view)
- Epic 04 (Fit score and breakdown data)
- Epic 08 (Explainability layer)
