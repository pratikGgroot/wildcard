# Story 07.1: Skill Gap Analysis for Interview Kit

## User Story
**As a** system  
**I want to** analyze the gap between a candidate's skills and the job requirements  
**So that** the interview kit focuses on areas that need deeper probing

## BRD Requirements Covered
- FR-IK-01: Generate a tailored interview kit for each candidate based on their profile + JD
- FR-IK-07: AI flags areas where candidate data is weak and suggests deeper probing questions
- BRD Section 8.6: Gap-probe questions targeting identified weaknesses

## Acceptance Criteria
1. **Given** a candidate has a parsed profile and a job has extracted criteria  
   **When** skill gap analysis runs  
   **Then** it produces a list of: matched skills, missing required skills, and partially matched skills

2. **Given** gap analysis completes  
   **When** the results are stored  
   **Then** each gap is categorized as: Critical (required, missing), Important (should-have, missing), or Minor (nice-to-have, missing)

3. **Given** gap analysis results are available  
   **When** the interview kit is generated  
   **Then** gap-probe questions are generated for Critical and Important gaps

4. **Given** a candidate has no gaps  
   **When** gap analysis runs  
   **Then** the result indicates "No significant gaps" and the kit focuses on depth questions for matched skills

## Priority
**P0 — Must Have**

## Estimated Effort
**3 story points**

## NFR / Tech Notes
- **Gap Matching:** Uses canonical skill names (from Story 02.5) for accurate comparison
- **Criticality:** Derived from criterion weight (High weight → Critical gap)
- **Performance:** Gap analysis ≤ 500ms (no LLM call needed — set comparison)

## Technical Design

### Gap Analysis
```python
def analyze_skill_gap(candidate_skills: list[str], jd_criteria: list[Criterion]) -> GapAnalysis:
    gaps = []
    for criterion in jd_criteria:
        match = find_skill_match(candidate_skills, criterion.skill)
        if not match:
            gaps.append(SkillGap(
                skill=criterion.skill,
                criticality="critical" if criterion.weight == "high" else "important",
                criterion_weight=criterion.weight
            ))
    return GapAnalysis(gaps=gaps, matched=matched_skills, partial=partial_matches)
```

### API Endpoints
```
GET /api/applications/:id/skill-gap   — Get gap analysis for candidate+job
```

## Sub-Tasks
- [ ] 07.1.a — Implement skill gap comparison using canonical skills
- [ ] 07.1.b — Implement criticality classification based on criterion weight
- [ ] 07.1.c — Write unit tests for gap analysis edge cases

## Testing Strategy
- Unit: Gap detection, criticality classification, no-gap case
- Integration: Gap analysis with real candidate profiles and JD criteria

## Dependencies
- Story 02.5 (Skill normalization — canonical skills)
- Epic 01 (Job criteria with weights)
