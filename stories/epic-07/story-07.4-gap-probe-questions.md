# Story 07.4: Gap-Probe Question Generation

## User Story
**As a** recruiter  
**I want to** receive targeted questions that probe a candidate's identified skill gaps  
**So that** I can assess whether they can compensate for missing skills or learn quickly

## BRD Requirements Covered
- FR-IK-02: Kit includes skill-gap probe questions
- FR-IK-07: AI flags areas where candidate data is weak and suggests deeper probing questions
- BRD Section 8.6: Gap-probe questions targeting identified weaknesses

## Acceptance Criteria
1. **Given** a candidate has identified skill gaps (from Story 07.1)  
   **When** gap-probe question generation runs  
   **Then** 1–3 questions are generated per Critical gap, 1 question per Important gap

2. **Given** gap-probe questions are generated  
   **When** they are displayed  
   **Then** each question shows: the gap it addresses, the question text, and what a compensating answer looks like

3. **Given** a candidate has no Critical gaps  
   **When** generation runs  
   **Then** gap-probe questions are generated only for Important gaps (if any)

4. **Given** a gap is in a skill the candidate has never mentioned  
   **When** the question is generated  
   **Then** it is phrased to assess learning ability: "How would you approach learning X if required for this role?"

## Priority
**P0 — Must Have**

## Estimated Effort
**3 story points**

## NFR / Tech Notes
- **Question Count:** 1–3 per Critical gap, 1 per Important gap; max 5 gap-probe questions total
- **Phrasing:** For complete gaps → learning ability questions; for partial gaps → depth questions
- **Caching:** Cached per (candidate_id, job_id, gap_analysis_version)

## Technical Design

### Gap-Probe Prompt
```python
GAP_PROBE_PROMPT = """
Generate interview questions to probe the following skill gaps for a {job_title} candidate.

Gaps:
{gaps_json}

For complete gaps (skill not mentioned at all): ask about learning approach
For partial gaps (skill mentioned but limited): ask depth questions

Return JSON array with: question_text, gap_skill, gap_criticality, question_rationale
"""
```

### API Endpoints
```
POST /api/applications/:id/interview-kit/generate-gap-probes   — Generate gap-probe questions
GET  /api/interview-kits/:id/questions?type=gap_probe          — Get gap-probe questions
```

## Sub-Tasks
- [ ] 07.4.a — Implement gap-probe question generation with criticality-based count
- [ ] 07.4.b — Implement learning-ability vs. depth question phrasing logic
- [ ] 07.4.c — Write unit tests for question count rules

## Testing Strategy
- Unit: Question count per gap criticality, no-gap case
- Integration: Generation with real gap analysis data

## Dependencies
- Story 07.1 (Skill gap analysis — provides gaps)
- Story 07.2 (Technical questions — shares kit structure)
