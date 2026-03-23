# Story 07.3: Behavioral Interview Question Generation

## User Story
**As a** recruiter  
**I want to** receive AI-generated behavioral interview questions mapped to role competencies  
**So that** I can assess soft skills and culture fit in a structured way

## BRD Requirements Covered
- FR-IK-02: Kit includes behavioral questions
- FR-IK-03: Questions tagged by competency area
- BRD Section 8.6: Behavioral questions (STAR-format) mapped to role competencies

## Acceptance Criteria
1. **Given** a job has defined competencies (e.g., leadership, collaboration, problem-solving)  
   **When** behavioral question generation runs  
   **Then** 3–5 STAR-format behavioral questions are generated, one per key competency

2. **Given** questions are generated  
   **When** they are stored  
   **Then** each question is tagged with: competency, STAR format indicator, and what to look for

3. **Given** the job has no explicit competencies defined  
   **When** generation runs  
   **Then** default competencies are inferred from the job title and description (e.g., "Senior Engineer" → leadership, mentoring)

4. **Given** behavioral questions are generated  
   **When** the interviewer views them  
   **Then** each question shows: the question text, the competency it assesses, and 2–3 green/red flag indicators

## Priority
**P0 — Must Have**

## Estimated Effort
**3 story points**

## NFR / Tech Notes
- **STAR Format:** Questions phrased as "Tell me about a time when..." or "Describe a situation where..."
- **Competency Source:** Job-defined competencies or inferred from JD text
- **Count:** 3–5 behavioral questions per kit
- **Caching:** Cached per (job_id, competencies_version) — same questions reused across candidates for same job

## Technical Design

### Behavioral Question Prompt
```python
BEHAVIORAL_PROMPT = """
Generate {count} behavioral interview questions in STAR format for a {job_title} role.

Key competencies to assess: {competencies}

For each question:
- Use "Tell me about a time..." or "Describe a situation where..." format
- Map to one competency
- Include 2-3 green flags (what a strong answer looks like)
- Include 1-2 red flags (warning signs)

Return as JSON array.
"""
```

### API Endpoints
```
POST /api/jobs/:id/interview-kit/generate-behavioral   — Generate behavioral questions for a job
GET  /api/interview-kits/:id/questions?type=behavioral — Get behavioral questions
```

## Sub-Tasks
- [ ] 07.3.a — Implement behavioral question generation with STAR format
- [ ] 07.3.b — Implement competency inference from JD when not explicitly defined
- [ ] 07.3.c — Implement job-level caching (same questions across candidates)

## Testing Strategy
- Unit: Competency inference, STAR format validation
- Integration: LLM generation with real job descriptions
- Quality: Verify questions are genuinely STAR-format

## Dependencies
- Story 07.2 (Technical question generation — shares kit structure)
- Epic 01 (Job description — competency source)
