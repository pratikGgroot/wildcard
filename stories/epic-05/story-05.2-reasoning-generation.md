# Story 05.2: Shortlist Reasoning Generation

## User Story
**As a** recruiter  
**I want to** see plain-English reasoning for why each candidate was shortlisted  
**So that** I can quickly validate the AI's recommendation without reading the full profile

## BRD Requirements Covered
- FR-SL-02: Reasoning displayed in plain English (e.g., "Strong Python background, 4 years relevant experience, lacks AWS exposure")
- BRD Section 8.4: For each shortlisted candidate, generate a reasoning note using LLM

## Acceptance Criteria
1. **Given** a candidate is on the shortlist  
   **When** the shortlist view loads  
   **Then** each candidate card shows a 2–3 sentence reasoning note

2. **Given** the reasoning note is displayed  
   **When** the recruiter reads it  
   **Then** it includes: key strengths for this role, identified gaps, and confidence level (High/Medium/Low)

3. **Given** reasoning is being generated  
   **When** the shortlist loads before generation completes  
   **Then** a skeleton loader is shown per candidate with "Generating reasoning..."

4. **Given** reasoning has been generated  
   **When** the JD criteria change and scores are recalculated  
   **Then** reasoning is invalidated and regenerated for the new shortlist

5. **Given** the LLM is unavailable  
   **When** reasoning generation fails  
   **Then** a fallback template is used: "Score: {score}/100. Top skills: {top_skills}. Gaps: {missing_skills}."

## Priority
**P0 — Must Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **Generation Latency:** ≤ 3 seconds per candidate (async, shown when ready)
- **Caching:** Reasoning cached per (candidate_id, job_id, criteria_version)
- **Fallback:** Template-based fallback if LLM unavailable
- **Model:** Claude claude-sonnet-4 or GPT-4o

## Technical Design

### Reasoning Prompt
```python
REASONING_PROMPT = """
You are a senior recruiter. Given the candidate's fit score breakdown and job requirements,
write a 2-3 sentence shortlist reasoning note.

Include:
1. Top 2-3 strengths relevant to this role
2. Main gap or concern (if any)
3. Confidence: High / Medium / Low

Be specific and factual. Do not use filler phrases.

Score Breakdown: {score_breakdown_json}
Job Requirements: {jd_criteria_json}
Candidate Skills: {candidate_skills}

Return JSON: { "reasoning": "...", "confidence": "High|Medium|Low" }
"""
```

### API Endpoints
```
POST /api/applications/:id/shortlist-reasoning          — Generate reasoning
GET  /api/applications/:id/shortlist-reasoning          — Get cached reasoning
POST /api/jobs/:id/shortlist/generate-all-reasoning     — Batch generate for shortlist
```

## Sub-Tasks
- [ ] 05.2.a — Implement reasoning generation service with LLM
- [ ] 05.2.b — Implement fallback template for LLM unavailability
- [ ] 05.2.c — Implement caching with criteria_version invalidation
- [ ] 05.2.d — Build reasoning card UI with skeleton loader
- [ ] 05.2.e — Implement batch generation for full shortlist

## Testing Strategy
- Unit: Fallback template logic, cache invalidation
- Integration: LLM reasoning generation with real score data
- Quality: Manual review of 20 generated reasoning notes for accuracy

## Dependencies
- Story 05.1 (Generate shortlist — provides shortlisted candidates)
- Story 04.2 (Fit score calculation — provides breakdown for prompt)
