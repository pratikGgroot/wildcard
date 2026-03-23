# Story 06.3: Semantic Candidate Search Tool

## User Story
**As a** recruiter  
**I want to** search for candidates using natural language queries  
**So that** I can find relevant candidates without knowing exact skill names or filter values

## BRD Requirements Covered
- FR-CA-02: Support queries like "Show top backend engineers with Kubernetes experience"
- BRD Section 8.5: `search_candidates(query, job_id, filters)` — semantic search over candidate profiles

## Acceptance Criteria
1. **Given** a query like "backend engineers with Kubernetes and 5+ years experience"  
   **When** the search tool runs  
   **Then** results are ranked by semantic relevance and include candidates matching those criteria

2. **Given** a search query  
   **When** results are returned  
   **Then** each result includes: candidate name, fit score, top matching skills, and a profile link

3. **Given** a job_id is provided in the query context  
   **When** search runs  
   **Then** results are scoped to candidates who applied to that job

4. **Given** no job_id is provided  
   **When** search runs  
   **Then** results span all candidates the recruiter has access to

5. **Given** a query returns no results  
   **When** the assistant responds  
   **Then** it suggests broadening the search (e.g., "No exact matches — here are the closest 3 candidates")

## Priority
**P0 — Must Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **Search Method:** RAG pattern — embed query, vector search over candidate embeddings, re-rank
- **Latency:** ≤ 2 seconds for search results
- **RBAC:** Results scoped to recruiter's accessible jobs
- **Result Limit:** Default 10 results; configurable up to 50

## Technical Design

### Search Implementation
```python
async def search_candidates(query: str, job_id: UUID | None, filters: dict, limit: int = 10) -> list:
    # Embed the query
    query_embedding = await embedding_service.embed_text(query)
    
    # Vector search
    candidates = await vector_db.search(
        embedding=query_embedding,
        job_id=job_id,
        filters=filters,
        limit=limit * 2  # over-fetch for re-ranking
    )
    
    # Re-rank by combining vector score + fit score
    reranked = rerank(candidates, query)
    return reranked[:limit]
```

### API Endpoints
```
POST /api/chat/tools/search-candidates   — Direct tool endpoint (also called via agent)
```

## Sub-Tasks
- [ ] 06.3.a — Implement query embedding and vector search
- [ ] 06.3.b — Implement re-ranking logic (vector score + fit score blend)
- [ ] 06.3.c — Implement RBAC scoping for search results
- [ ] 06.3.d — Implement "no results" fallback with nearest candidates

## Testing Strategy
- Unit: RBAC scoping, result ranking
- Integration: Vector search with real candidate embeddings
- Quality: 10 sample queries evaluated for relevance

## Dependencies
- Story 04.1 (Embedding generation — candidate embeddings)
- Story 06.2 (Intent routing — calls this tool)
- Epic 12 (RBAC — access scoping)
