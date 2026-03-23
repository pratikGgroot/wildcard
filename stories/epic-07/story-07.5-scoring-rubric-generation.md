# Story 07.5: Scoring Rubric Generation

## User Story
**As a** hiring manager  
**I want to** receive a suggested scoring rubric for each interview question  
**So that** I can evaluate candidates consistently and objectively

## BRD Requirements Covered
- FR-IK-04: Provide a suggested scoring rubric for each question
- BRD Section 8.6: Suggested evaluation rubric per question (What to look for, Red flags, Green flags)

## Acceptance Criteria
1. **Given** interview questions have been generated  
   **When** rubric generation runs  
   **Then** each question has a rubric with: score levels (1–4), what each level looks like, green flags, and red flags

2. **Given** a rubric is displayed  
   **When** the interviewer views it  
   **Then** they see a 4-point scale: 1=Poor, 2=Below Expectations, 3=Meets Expectations, 4=Exceeds Expectations

3. **Given** a rubric is generated for a technical question  
   **When** it is displayed  
   **Then** it includes specific technical indicators (e.g., "Mentions time complexity" = green flag)

4. **Given** a rubric is generated for a behavioral question  
   **When** it is displayed  
   **Then** it includes STAR-format completeness as a scoring criterion

## Priority
**P1 — Should Have**

## Estimated Effort
**3 story points**

## NFR / Tech Notes
- **Rubric Scale:** 1–4 (avoids middle-of-the-road 3-point scales)
- **Generation:** LLM-generated at question creation time; cached with question
- **Format:** Stored as JSONB alongside question record

## Technical Design

### Rubric Schema
```typescript
interface ScoringRubric {
  question_id: string;
  scale: {
    score: 1 | 2 | 3 | 4;
    label: string;
    description: string;
  }[];
  green_flags: string[];
  red_flags: string[];
}
```

### API Endpoints
```
GET /api/interview-kits/:id/questions/:questionId/rubric   — Get rubric for a question
PUT /api/interview-kits/:id/questions/:questionId/rubric   — Update rubric (manual edit)
```

## Sub-Tasks
- [ ] 07.5.a — Implement rubric generation as part of question generation prompt
- [ ] 07.5.b — Build rubric display component in interview kit UI
- [ ] 07.5.c — Implement rubric edit capability

## Testing Strategy
- Unit: Rubric schema validation
- Integration: Rubric generation with real questions
- Quality: Manual review of 10 rubrics for usefulness

## Dependencies
- Story 07.2 (Technical questions — rubric generated alongside)
- Story 07.3 (Behavioral questions — rubric generated alongside)
