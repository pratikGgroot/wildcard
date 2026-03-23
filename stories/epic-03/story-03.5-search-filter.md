# Story 03.5: Candidate Search & Filter

## User Story
**As a** recruiter  
**I want to** search and filter candidates across all active pipelines  
**So that** I can quickly find the right candidates without manually browsing every job

## BRD Requirements Covered
- FR-CP-06: Candidate profiles are searchable and filterable across all active pipelines

## Acceptance Criteria
1. **Given** I am on the candidates list page  
   **When** I type a search query  
   **Then** results appear within 1 second showing candidates whose name, skills, or job titles match

2. **Given** search results are displayed  
   **When** I apply filters (job, stage, score range, tags, skills)  
   **Then** results update immediately to reflect the combined search + filter criteria

3. **Given** I search for a skill (e.g., "Kubernetes")  
   **When** results load  
   **Then** candidates with the canonical skill "Kubernetes" appear, including those tagged with aliases ("K8s")

4. **Given** I apply a score range filter (e.g., 70–100)  
   **When** results load  
   **Then** only candidates with fit scores in that range for the selected job are shown

5. **Given** I want to save a search  
   **When** I click "Save Search"  
   **Then** the current query and filters are saved and accessible from "Saved Searches"

6. **Given** I have no search query and no filters  
   **When** the page loads  
   **Then** all candidates I have access to are shown, sorted by most recently updated

## Priority
**P0 — Must Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **Search Backend:** OpenSearch / Elasticsearch for full-text + faceted search
- **Skill Search:** Uses canonical skill names (normalized via Story 02.5)
- **Search Latency:** ≤ 1 second for query results (P95)
- **Pagination:** 25 results per page with cursor-based pagination
- **RBAC:** Recruiters only see candidates in jobs they are assigned to

## Technical Design

### Search Index Fields
```json
{
  "candidate_id": "uuid",
  "name": "text",
  "email": "keyword",
  "skills": ["keyword"],
  "job_titles": ["text"],
  "companies": ["text"],
  "tags": ["keyword"],
  "applications": [
    {
      "job_id": "uuid",
      "job_title": "text",
      "stage": "keyword",
      "fit_score": "float",
      "status": "keyword"
    }
  ]
}
```

### API Endpoints
```
GET  /api/candidates/search           — Search with query + filters
POST /api/candidates/saved-searches   — Save a search
GET  /api/candidates/saved-searches   — List saved searches
```

## Sub-Tasks
- [ ] 03.5.a — Set up OpenSearch index with candidate mapping
- [ ] 03.5.b — Implement search API with full-text + filter support
- [ ] 03.5.c — Build search UI with filter panel (job, stage, score, tags, skills)
- [ ] 03.5.d — Implement saved searches feature
- [ ] 03.5.e — Implement index sync on candidate profile updates

## Testing Strategy
- Unit: Filter logic, RBAC access checks
- Integration: Search API with OpenSearch
- Performance: ≤ 1s response for complex queries

## Dependencies
- Story 02.5 (Skill normalization — canonical skill names)
- Epic 12 (RBAC — search scope)
