# Story 04.1: Embedding Generation for Candidates & Jobs

## User Story
**As a** system  
**I want to** generate and store vector embeddings for candidate profiles and job descriptions  
**So that** semantic similarity can be computed for fit scoring

## BRD Requirements Covered
- FR-SC-02: Score is derived from semantic similarity between candidate profile embedding and JD embedding
- BRD Section 8.2: Embed candidate profiles and JD criteria using a high-quality text embedding model

## Acceptance Criteria
1. **Given** a candidate profile is created or updated  
   **When** the embedding job runs  
   **Then** a vector embedding is generated and stored in the vector database

2. **Given** a job description's criteria are created or updated  
   **When** the embedding job runs  
   **Then** a JD embedding is generated and stored

3. **Given** embeddings are stored  
   **When** a cosine similarity query is run  
   **Then** results are returned within 200ms for a database of 10M+ vectors

4. **Given** the embedding model is updated  
   **When** a re-embedding job is triggered  
   **Then** all existing profiles and JDs are re-embedded with the new model version

5. **Given** embedding generation fails  
   **When** the failure occurs  
   **Then** the job is retried 3 times; on final failure the candidate is flagged as "embedding pending"

## Priority
**P0 — Must Have**

## Estimated Effort
**8 story points**

## NFR / Tech Notes
- **Embedding Model:** OpenAI `text-embedding-3-large` (3072 dims) or Voyage AI `voyage-large-2` (1536 dims)
- **Vector Store:** pgvector on PostgreSQL (primary) or Pinecone (scale-out option)
- **Similarity Search Latency:** ≤ 200ms for top-K search over 10M vectors
- **Embedding Latency:** ≤ 2 seconds per profile
- **Versioning:** Embeddings are versioned by model name + version; re-embedding on model change
- **Batch Processing:** Batch embed up to 100 profiles per API call to reduce cost

### SLA Requirements
- **Embedding Generation:** ≤ 2 seconds per profile
- **Vector Search:** ≤ 200ms (P95) for 10M+ vectors

## Technical Design

### Embedding Text Construction
```python
def build_candidate_embedding_text(profile: ParsedProfile) -> str:
    """Construct a rich text representation for embedding."""
    parts = []
    # Skills
    parts.append(f"Skills: {', '.join(profile.skills.normalized)}")
    # Experience
    for exp in profile.experience:
        parts.append(f"{exp.title} at {exp.company}: {' '.join(exp.responsibilities[:3])}")
    # Education
    for edu in profile.education:
        parts.append(f"{edu.degree} in {edu.field} from {edu.institution}")
    # Projects
    for proj in profile.projects:
        parts.append(f"Project: {proj.name} — {proj.description}")
    return "\n".join(parts)

def build_jd_embedding_text(job: Job) -> str:
    criteria_text = "\n".join([f"{c.name} ({c.weight}): {c.description}" 
                                for c in job.extracted_criteria])
    return f"Job: {job.title}\nRequirements:\n{criteria_text}"
```

### Database Schema
```sql
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE candidate_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  embedding vector(1536) NOT NULL,
  model_name VARCHAR(100) NOT NULL,
  model_version VARCHAR(20) NOT NULL,
  input_hash VARCHAR(64),  -- SHA256 of input text for cache
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE job_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  embedding vector(1536) NOT NULL,
  model_name VARCHAR(100) NOT NULL,
  model_version VARCHAR(20) NOT NULL,
  input_hash VARCHAR(64),
  created_at TIMESTAMP DEFAULT NOW()
);

-- HNSW index for fast approximate nearest neighbor search
CREATE INDEX idx_candidate_embeddings_hnsw 
  ON candidate_embeddings USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_job_embeddings_hnsw
  ON job_embeddings USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

### Embedding Service
```python
class EmbeddingService:
    async def embed_candidate(self, candidate_id: UUID) -> None:
        profile = await self.db.get_parsed_profile(candidate_id)
        text = build_candidate_embedding_text(profile)
        input_hash = sha256(text.encode()).hexdigest()
        
        # Check if already embedded with same input
        existing = await self.db.get_embedding(candidate_id, input_hash)
        if existing:
            return
        
        embedding = await self.openai.embed(text, model="text-embedding-3-large")
        await self.db.upsert_candidate_embedding(candidate_id, embedding, input_hash)
```

### API Endpoints
```
POST /api/candidates/:id/embed        — Trigger embedding generation
POST /api/jobs/:id/embed              — Trigger JD embedding generation
POST /api/admin/re-embed              — Trigger full re-embedding job (admin)
GET  /api/candidates/:id/embedding-status — Check embedding status
```

## Sub-Tasks
- [ ] 04.1.a — Set up pgvector extension and schema
- [ ] 04.1.b — Implement candidate embedding text construction
- [ ] 04.1.c — Implement JD embedding text construction
- [ ] 04.1.d — Implement embedding service with batching and retry
- [ ] 04.1.e — Implement HNSW index and benchmark search latency
- [ ] 04.1.f — Implement re-embedding background job with model versioning
- [ ] 04.1.g — Write performance tests: ≤ 200ms search over 1M vectors

## Testing Strategy
- Unit: Text construction, hash-based cache check
- Integration: OpenAI embedding API + pgvector storage
- Performance: Search latency benchmark at 1M and 10M vectors
- Regression: Re-embedding job preserves all candidate data

## Dependencies
- Story 02.4 (LLM extraction — provides structured profile)
- Story 02.5 (Skill normalization — canonical skills in embedding text)
- Epic 01 (Job criteria — JD embedding input)
