# Story 06.5: Candidate Comparison Tool

## User Story
**As a** recruiter  
**I want to** compare multiple candidates side-by-side via the chat assistant  
**So that** I can make faster decisions when choosing between finalists

## BRD Requirements Covered
- FR-CA-04: Support comparative queries like "Compare the top 3 candidates for the Data Scientist role"
- BRD Section 8.5: `compare_candidates(candidate_ids[])` — side-by-side comparison generation

## Acceptance Criteria
1. **Given** a query like "Compare the top 3 candidates for Data Scientist"  
   **When** the comparison tool runs  
   **Then** a structured comparison table is returned showing key dimensions side-by-side

2. **Given** the comparison is displayed  
   **When** the recruiter views it  
   **Then** they see: fit score, top skills, years of experience, education, and key strengths/gaps per candidate

3. **Given** the comparison is displayed  
   **When** the recruiter clicks a candidate name  
   **Then** they are taken to that candidate's full profile

4. **Given** more than 5 candidates are requested for comparison  
   **When** the tool runs  
   **Then** it limits to the top 5 and informs the recruiter

5. **Given** candidates are from different jobs  
   **When** comparison runs  
   **Then** the comparison is normalized to the same job's criteria (or the recruiter is asked to specify a job)

## Priority
**P1 — Should Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **Max Candidates:** 5 per comparison
- **Comparison Format:** Structured table rendered in chat as markdown
- **Generation:** LLM generates narrative comparison after structured data is assembled
- **Latency:** ≤ 3 seconds for comparison generation

## Technical Design

### Comparison Output Structure
```typescript
interface CandidateComparison {
  job_id: string;
  candidates: {
    id: string;
    name: string;
    fit_score: number;
    top_skills: string[];
    years_experience: number;
    education: string;
    strengths: string[];
    gaps: string[];
  }[];
  narrative: string;  // LLM-generated summary
}
```

### API Endpoints
```
POST /api/chat/tools/compare-candidates   — Direct tool endpoint
```

## Sub-Tasks
- [ ] 06.5.a — Implement compare_candidates tool with structured data assembly
- [ ] 06.5.b — Implement LLM narrative generation for comparison
- [ ] 06.5.c — Build comparison table renderer in chat UI (markdown table)
- [ ] 06.5.d — Implement candidate name → profile link in comparison output

## Testing Strategy
- Unit: Comparison data assembly, max candidate limit enforcement
- Integration: Full comparison with real candidate data
- UI: Table rendering in chat panel

## Dependencies
- Story 06.2 (Intent routing)
- Story 04.2 (Fit scores — comparison data source)
