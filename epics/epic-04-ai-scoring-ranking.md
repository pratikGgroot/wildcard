# Epic 04: AI Candidate Scoring & Ranking

## Overview
Implement semantic embedding-based candidate scoring that generates fit scores (0-100) by comparing candidate profiles against job requirements. This is the core AI intelligence that powers candidate matching.

## Business Value
- Automates candidate evaluation, saving 60-70% of screening time
- Provides objective, consistent scoring across all candidates
- Enables data-driven shortlisting decisions

## Acceptance Criteria
- System generates fit scores (0-100) for each candidate-job pair
- Scores are based on semantic similarity between embeddings
- Score breakdown shows contribution of each criterion
- Scores are recalculated when JD criteria are updated
- Recruiters can override scores with justification
- Multi-dimensional scoring supported (technical, culture, growth potential)

## Priority
**CRITICAL** - Core AI functionality

## Dependencies
- Epic 01 (Job criteria)
- Epic 02 (Candidate profiles)

## NFR / Tech Notes
- **Latency:** AI scoring per candidate ≤10 seconds (NFR-P-02)
- **Accuracy:** Top-5 AI shortlist matches recruiter picks ≥70% of time (KPI)
- **Embedding Model:** text-embedding-3-large (OpenAI) or voyage-large-2
- **Vector DB:** pgvector on PostgreSQL
- **Batch Processing:** Score all candidates when JD changes

### SLA Requirements
- **Scoring Latency:** ≤10 seconds per candidate (P95)
- **Batch Scoring:** 200 candidates scored within 5 minutes
- **Embedding Generation:** ≤2 seconds per profile/JD

## Technical Design

### Scoring Architecture
```
Candidate Profile + Job Criteria
       ↓
[Generate/Retrieve Embeddings]
       ↓
[Calculate Cosine Similarity per Criterion]
       ↓
[Apply Weighted Scoring Formula]
       ↓
[Generate Score Breakdown]
       ↓
[Store Score + Breakdown in DB]
```

### Scoring Formula
```python
# Weighted semantic similarity scoring
fit_score = Σ (weight_i × cosine_sim(candidate_embedding_i, jd_embedding_i))

# Normalized to [0, 100]
# Where:
# - weight_i = configured weight for criterion i
# - cosine_sim = cosine similarity between embeddings
# - Dimensions: skills (40%), experience (30%), education (15%), certs (15%)
```

### Database Schema
```sql
CREATE TABLE candidate_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES candidates(id),
  job_id UUID REFERENCES jobs(id),
  
  fit_score DECIMAL(5,2) NOT NULL, -- 0.00 to 100.00
  score_breakdown JSONB NOT NULL,
  
  -- Multi-dimensional scores
  technical_fit_score DECIMAL(5,2),
  culture_fit_score DECIMAL(5,2),
  growth_potential_score DECIMAL(5,2),
  
  -- Metadata
  model_version VARCHAR(50),
  embedding_model VARCHAR(50),
  scored_at TIMESTAMP DEFAULT NOW(),
  
  -- Override support
  overridden BOOLEAN DEFAULT false,
  override_score DECIMAL(5,2),
  override_reason TEXT,
  overridden_by UUID REFERENCES users(id),
  overridden_at TIMESTAMP
);

CREATE INDEX idx_candidate_scores_application ON candidate_scores(application_id);
CREATE INDEX idx_candidate_scores_fit_score ON candidate_scores(fit_score DESC);
CREATE INDEX idx_candidate_scores_job ON candidate_scores(job_id);

-- Embeddings table
CREATE TABLE embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(20) NOT NULL, -- 'candidate' or 'job'
  entity_id UUID NOT NULL,
  embedding_vector vector(1536), -- Dimension depends on model
  model_version VARCHAR(50),
  generated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_embeddings_entity ON embeddings(entity_type, entity_id);
-- Vector similarity index
CREATE INDEX idx_embeddings_vector ON embeddings USING ivfflat (embedding_vector vector_cosine_ops);
```

### Scoring Service Implementation
```python
# services/scoring_service.py
from openai import OpenAI
import numpy as np

class CandidateScoringService:
    def __init__(self):
        self.openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)
        self.embedding_model = "text-embedding-3-large"
    
    async def score_candidate(
        self,
        candidate_id: str,
        job_id: str,
        application_id: str
    ) -> CandidateScore:
        """
        Generate fit score for candidate-job pair.
        """
        # Get or generate embeddings
        candidate_embedding = await self.get_candidate_embedding(candidate_id)
        job_embedding = await self.get_job_embedding(job_id)
        
        # Get job criteria and weights
        job = await self.get_job(job_id)
        criteria = await self.get_job_criteria(job_id)
        weight_config = job.weight_config
        
        # Calculate category scores
        category_scores = {
            'skills': await self._score_skills(
                candidate_id, criteria, candidate_embedding, job_embedding
            ),
            'experience': await self._score_experience(
                candidate_id, criteria, candidate_embedding, job_embedding
            ),
            'education': await self._score_education(
                candidate_id, criteria
            ),
            'certifications': await self._score_certifications(
                candidate_id, criteria
            )
        }
        
        # Apply weights
        weighted_score = sum(
            category_scores[cat] * (weight_config[cat] / 100)
            for cat in category_scores
        )
        
        # Generate breakdown
        breakdown = self._generate_breakdown(category_scores, criteria)
        
        # Store score
        score = CandidateScore(
            application_id=application_id,
            candidate_id=candidate_id,
            job_id=job_id,
            fit_score=round(weighted_score, 2),
            score_breakdown=breakdown,
            model_version='v1.0',
            embedding_model=self.embedding_model,
            scored_at=datetime.utcnow()
        )
        
        await self.db.add(score)
        await self.db.commit()
        
        return score
    
    async def get_candidate_embedding(self, candidate_id: str) -> np.ndarray:
        """Get or generate candidate profile embedding."""
        # Check cache
        cached = await self.get_cached_embedding('candidate', candidate_id)
        if cached:
            return cached
        
        # Generate new embedding
        profile = await self.get_candidate_profile(candidate_id)
        profile_text = self._profile_to_text(profile)
        
        response = self.openai_client.embeddings.create(
            model=self.embedding_model,
            input=profile_text
        )
        
        embedding = np.array(response.data[0].embedding)
        
        # Cache embedding
        await self.cache_embedding('candidate', candidate_id, embedding)
        
        return embedding
    
    def _profile_to_text(self, profile: dict) -> str:
        """Convert profile to text for embedding."""
        parts = []
        
        # Skills
        skills = profile.get('skills', {})
        all_skills = skills.get('explicit', []) + skills.get('inferred', [])
        parts.append(f"Skills: {', '.join(all_skills)}")
        
        # Experience
        for exp in profile.get('experience', []):
            parts.append(
                f"{exp['title']} at {exp['company']}: "
                f"{' '.join(exp.get('responsibilities', []))}"
            )
        
        # Education
        for edu in profile.get('education', []):
            parts.append(f"{edu['degree']} in {edu['field']} from {edu['institution']}")
        
        return "\n".join(parts)
    
    async def _score_skills(
        self,
        candidate_id: str,
        criteria: list,
        candidate_emb: np.ndarray,
        job_emb: np.ndarray
    ) -> float:
        """Score skill match using embedding similarity."""
        skill_criteria = [c for c in criteria if c.type == 'skill']
        
        if not skill_criteria:
            return 50.0  # Neutral score if no skill criteria
        
        # Calculate cosine similarity
        similarity = np.dot(candidate_emb, job_emb) / (
            np.linalg.norm(candidate_emb) * np.linalg.norm(job_emb)
        )
        
        # Convert to 0-100 scale
        score = (similarity + 1) * 50  # Cosine sim is [-1, 1]
        
        return min(100, max(0, score))
```

## Stories
- [Story 04.1: Embedding Generation Service](stories/epic-04/story-04.1-embedding-generation.md)
- [Story 04.2: Fit Score Calculation](stories/epic-04/story-04.2-fit-score-calculation.md)
- [Story 04.3: Score Breakdown Display](stories/epic-04/story-04.3-score-breakdown.md)
- [Story 04.4: Score Recalculation on JD Changes](stories/epic-04/story-04.4-score-recalculation.md)
- [Story 04.5: Manual Score Override](stories/epic-04/story-04.5-manual-override.md)
- [Story 04.6: Multi-dimensional Scoring](stories/epic-04/story-04.6-multi-dimensional-scoring.md)

## Estimated Effort
**18-21 story points** (3 sprints)

## Success Metrics
- Scoring latency ≤10 seconds per candidate
- Top-5 AI shortlist matches recruiter picks ≥70% of time
- Score recalculation completes within 5 minutes for 200 candidates
- Embedding cache hit rate ≥80%
