# Story 02.6: Duplicate Candidate Detection

## User Story
**As a** system  
**I want to** detect when a candidate applies to the same role multiple times  
**So that** recruiters see a single unified profile instead of duplicate entries

## BRD Requirements Covered
- FR-RP-05: Deduplicate candidates who apply to the same role multiple times

## Acceptance Criteria
1. **Given** a new resume is uploaded for a job  
   **When** the deduplication check runs  
   **Then** the system checks for existing candidates with matching email address

2. **Given** an exact email match is found for the same job  
   **When** deduplication runs  
   **Then** the new submission is merged into the existing application (resume updated, timestamp updated) and the recruiter is notified

3. **Given** no exact email match but high profile similarity (≥ 0.92 cosine similarity on embeddings)  
   **When** deduplication runs  
   **Then** the system flags the pair as a potential duplicate and surfaces it for recruiter review

4. **Given** a candidate applies to two different jobs  
   **When** deduplication runs  
   **Then** a single candidate profile is created/reused, with separate application records per job

5. **Given** a recruiter reviews a flagged duplicate pair  
   **When** they confirm it is a duplicate  
   **Then** the profiles are merged; when they dismiss it  
   **Then** both profiles are retained and the flag is cleared

6. **Given** a merge is performed  
   **When** the merge completes  
   **Then** all notes, tags, and stage history from both records are preserved in the merged profile

## Priority
**P0 — Must Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **Primary Dedup Key:** Email address (exact match)
- **Secondary Dedup:** Embedding cosine similarity ≥ 0.92 → flag for review
- **Merge Strategy:** Newer resume wins for profile data; all history preserved
- **Performance:** Dedup check ≤ 500ms per candidate
- **Cross-Job:** Same candidate can have multiple applications (different jobs) — this is valid, not a duplicate

## Technical Design

### Deduplication Flow
```python
class DuplicateDetectionService:
    async def check(self, new_candidate: CandidateProfile, job_id: UUID) -> DedupResult:
        # Step 1: Exact email match
        existing = await self.db.find_candidate_by_email(new_candidate.email)
        if existing:
            existing_app = await self.db.find_application(existing.id, job_id)
            if existing_app:
                return DedupResult(type='exact_duplicate', match_id=existing.id)
            else:
                return DedupResult(type='same_candidate_new_job', match_id=existing.id)
        
        # Step 2: Embedding similarity
        similar = await self.vector_db.find_similar(
            new_candidate.embedding, threshold=0.92, job_id=job_id
        )
        if similar:
            return DedupResult(type='probable_duplicate', match_id=similar.id, score=similar.score)
        
        return DedupResult(type='new_candidate')
```

### Database Schema
```sql
CREATE TABLE duplicate_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id_a UUID REFERENCES candidates(id),
  candidate_id_b UUID REFERENCES candidates(id),
  similarity_score FLOAT,
  detection_method VARCHAR(20) CHECK (detection_method IN ('email', 'embedding')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'dismissed')),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_duplicate_flags_status ON duplicate_flags(status) WHERE status = 'pending';
```

### API Endpoints
```
GET  /api/duplicates/pending          — List pending duplicate flags
POST /api/duplicates/:id/confirm      — Confirm and merge duplicates
POST /api/duplicates/:id/dismiss      — Dismiss duplicate flag
GET  /api/candidates/:id/duplicates   — Get duplicate flags for a candidate
```

## Sub-Tasks
- [ ] 02.6.a — Implement email-based exact dedup check
- [ ] 02.6.b — Implement embedding similarity dedup check
- [ ] 02.6.c — Implement profile merge logic (preserve all history)
- [ ] 02.6.d — Build recruiter review UI for flagged duplicates
- [ ] 02.6.e — Write unit tests for merge logic and edge cases

## Testing Strategy
- Unit: Merge logic, flag creation, email matching
- Integration: Full dedup pipeline with test candidates
- Edge cases: Same candidate, different email; same email, different jobs

## Dependencies
- Story 02.4 (LLM extraction — provides profile for embedding)
- Epic 04 (Embedding generation — needed for similarity check)
