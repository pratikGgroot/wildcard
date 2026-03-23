# Story 07.2: Technical Interview Question Generation

## User Story
**As a** recruiter or hiring manager  
**I want to** receive AI-generated technical interview questions tailored to the candidate and role  
**So that** I can conduct a focused, relevant technical interview without spending time writing questions

## BRD Requirements Covered
- FR-IK-02: Kit includes role-specific technical questions
- FR-IK-03: Questions tagged by competency area and difficulty level
- BRD Section 8.6: Technical questions targeting required skills (Easy / Medium / Hard difficulty)

## Acceptance Criteria
1. **Given** a candidate has a profile and a job has extracted criteria  
   **When** technical question generation runs  
   **Then** 5–10 technical questions are generated covering the required skills

2. **Given** questions are generated  
   **When** they are stored  
   **Then** each question has: text, competency area, difficulty (Easy/Medium/Hard), and a suggested answer/rubric

3. **Given** the candidate has strong Python skills  
   **When** questions are generated  
   **Then** Python questions are at Medium/Hard difficulty; questions for weaker areas are at Easy/Medium

4. **Given** questions are generated  
   **When** the interviewer views them  
   **Then** questions are grouped by competency area (e.g., "Python", "System Design", "Databases")

5. **Given** the LLM generates a question  
   **When** it is stored  
   **Then** it is tagged with the specific JD criterion it addresses

## Priority
**P0 — Must Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **Generation Latency:** ≤ 5 seconds for full question set
- **Question Count:** 5–10 technical questions per kit
- **Difficulty Calibration:** Based on candidate's skill level vs. requirement level
- **Caching:** Questions cached per (candidate_id, job_id, criteria_version)

## Technical Design

### Technical Question Prompt
```python
TECH_QUESTION_PROMPT = """
Generate {count} technical interview questions for a {job_title} role.

Candidate's skill level: {skill_assessment}
Required skills: {required_skills}
Candidate's matched skills: {matched_skills}
Candidate's skill gaps: {skill_gaps}

For each question:
- Target a specific required skill
- Set difficulty based on candidate's proficiency (stronger skills → harder questions)
- Include what a good answer looks like (2-3 sentences)
- Tag with: competency_area, difficulty (Easy/Medium/Hard), criterion_id

Return as JSON array of question objects.
"""
```

### Database Schema
```sql
CREATE TABLE interview_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id UUID REFERENCES interview_kits(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type VARCHAR(20) CHECK (question_type IN ('technical','behavioral','gap_probe','culture')),
  competency_area VARCHAR(100),
  difficulty VARCHAR(10) CHECK (difficulty IN ('Easy','Medium','Hard')),
  criterion_id UUID REFERENCES job_criteria(id),
  suggested_answer TEXT,
  green_flags TEXT[],
  red_flags TEXT[],
  display_order INT,
  is_edited BOOLEAN DEFAULT FALSE
);
```

### API Endpoints
```
POST /api/applications/:id/interview-kit/generate-technical   — Generate technical questions
GET  /api/interview-kits/:id/questions?type=technical         — Get technical questions
```

## Sub-Tasks
- [ ] 07.2.a — Implement technical question generation prompt and LLM call
- [ ] 07.2.b — Implement difficulty calibration based on skill match
- [ ] 07.2.c — Implement question storage with competency tagging
- [ ] 07.2.d — Write unit tests for difficulty calibration logic

## Testing Strategy
- Unit: Difficulty calibration, question count bounds
- Integration: LLM generation with real candidate profiles
- Quality: Manual review of 10 generated question sets

## Dependencies
- Story 07.1 (Skill gap analysis — provides gap data for question targeting)
- Epic 01 (Job criteria — required skills and weights)
