# Story 09.2: Kanban Pipeline Board

## User Story
**As a** recruiter  
**I want to** view the candidate pipeline as a kanban board  
**So that** I can see all candidates organized by stage at a glance

## BRD Requirements Covered
- FR-PL-02: Drag-and-drop kanban board for moving candidates across stages
- BRD Section 12.1: Job Detail + Pipeline — Kanban-style candidate pipeline for a specific job

## Acceptance Criteria
1. **Given** I navigate to a job's pipeline view  
   **When** the page loads  
   **Then** I see a kanban board with one column per stage and candidate cards in each column

2. **Given** the kanban board is displayed  
   **When** I view a candidate card  
   **Then** I see: candidate name (or anonymized if blind mode), fit score badge, top 3 skills, and days in current stage

3. **Given** the board has many candidates in a stage  
   **When** the column renders  
   **Then** it shows the first 20 candidates with a "Load more" option; columns are scrollable

4. **Given** the board is displayed  
   **When** I click a candidate card  
   **Then** the candidate profile opens in a side panel (not navigating away from the board)

5. **Given** the board is displayed  
   **When** I want to filter candidates  
   **Then** I can filter by score range, tags, or skills and the board updates in real-time

## Priority
**P1 — Should Have**

## Estimated Effort
**8 story points**

## NFR / Tech Notes
- **Page Load:** ≤ 2 seconds (P95) — BRD NFR-P-04
- **Virtualization:** Virtual scrolling for columns with > 50 candidates
- **Real-time:** Stage counts update in real-time via WebSocket when candidates are moved
- **Responsive:** Works on tablet (BRD Section 12.2)

## Technical Design

### Component Structure
```
KanbanBoard
├── StageColumn[] (one per pipeline stage)
│   ├── ColumnHeader (stage name, candidate count)
│   ├── CandidateCard[] (virtualized list)
│   │   ├── ScoreBadge
│   │   ├── SkillTags (top 3)
│   │   └── DaysInStage
│   └── LoadMoreButton
└── FilterBar (score range, tags, skills)
```

### API Endpoints
```
GET /api/jobs/:id/pipeline/board   — Get all stages with candidate counts and first 20 per stage
GET /api/jobs/:id/pipeline/stage/:stageId/candidates — Paginated candidates for a stage
```

## Sub-Tasks
- [ ] 09.2.a — Build KanbanBoard layout with StageColumn components
- [ ] 09.2.b — Build CandidateCard component with score badge and skill tags
- [ ] 09.2.c — Implement virtual scrolling for large columns
- [ ] 09.2.d — Implement filter bar with real-time board updates
- [ ] 09.2.e — Implement candidate profile side panel on card click
- [ ] 09.2.f — Implement WebSocket updates for real-time stage counts

## Testing Strategy
- Unit: Filter logic, card rendering with blind mode
- Integration: Board data loading with real pipeline data
- Performance: Board loads ≤ 2s with 500 candidates across stages

## Dependencies
- Story 09.1 (Pipeline stages — column definitions)
- Story 09.3 (Drag-and-drop — movement between columns)
- Epic 08 (Blind mode — candidate name masking)
