# Story 06.4: Pipeline Filter Tool

## User Story
**As a** recruiter  
**I want to** filter the candidate pipeline using natural language date and stage queries  
**So that** I can quickly answer questions like "who applied in the last 7 days?"

## BRD Requirements Covered
- FR-CA-03: Support queries like "Which candidates applied in the last 7 days for the ML Engineer role?"
- BRD Section 8.5: `filter_pipeline(stage, date_range, score_range)` tool

## Acceptance Criteria
1. **Given** a query like "candidates applied in the last 7 days for ML Engineer"  
   **When** the filter tool runs  
   **Then** it returns candidates filtered by job, date range, and optionally stage

2. **Given** a query like "candidates in the interview stage with score above 70"  
   **When** the filter tool runs  
   **Then** it returns candidates filtered by stage and score range

3. **Given** filter results are returned  
   **When** the assistant displays them  
   **Then** each result shows: name, stage, score, application date, and a profile link

4. **Given** a relative date like "last week" or "this month"  
   **When** the agent parses the query  
   **Then** it correctly resolves to absolute date ranges

5. **Given** no candidates match the filter  
   **When** results are returned  
   **Then** the assistant responds: "No candidates found matching those criteria" with suggestions

## Priority
**P0 — Must Have**

## Estimated Effort
**3 story points**

## NFR / Tech Notes
- **Date Parsing:** Relative dates resolved by LLM before tool call
- **Performance:** Filter query ≤ 500ms (SQL-based, not vector search)
- **RBAC:** Results scoped to recruiter's accessible jobs

## Technical Design

### Filter Tool Implementation
```python
async def filter_pipeline(
    job_id: UUID,
    stage: str | None,
    date_range: dict | None,
    score_range: dict | None
) -> list[ApplicationSummary]:
    query = db.select(Application).where(Application.job_id == job_id)
    
    if stage:
        query = query.where(Application.pipeline_stage == stage)
    if date_range:
        query = query.where(Application.created_at.between(
            date_range['from'], date_range['to']
        ))
    if score_range:
        query = query.join(FitScore).where(
            FitScore.fit_score.between(score_range['min'], score_range['max'])
        )
    
    return await query.order_by(Application.created_at.desc()).limit(50).all()
```

### API Endpoints
```
POST /api/chat/tools/filter-pipeline   — Direct tool endpoint
```

## Sub-Tasks
- [ ] 06.4.a — Implement filter_pipeline tool with all filter parameters
- [ ] 06.4.b — Implement relative date resolution in agent prompt
- [ ] 06.4.c — Write unit tests for filter combinations

## Testing Strategy
- Unit: Date range resolution, filter combinations, RBAC
- Integration: Filter with real pipeline data

## Dependencies
- Story 06.2 (Intent routing — calls this tool)
- Epic 09 (Pipeline stages — stage names)
