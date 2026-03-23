# Story 02.5: Skill Normalization

## User Story
**As a** system  
**I want to** normalize extracted skill names to canonical forms  
**So that** "React.js", "ReactJS", and "React" are treated as the same skill during scoring and search

## BRD Requirements Covered
- FR-RP-08: Normalize skill names (e.g., "React.js", "ReactJS", "React" → canonical form)
- BRD Section 8.1: Skills normalization using a curated ontology (ESCO skills taxonomy or custom skill graph)

## Acceptance Criteria
1. **Given** a list of raw extracted skills  
   **When** normalization runs  
   **Then** each skill is mapped to its canonical form (e.g., "ReactJS" → "React", "Postgres" → "PostgreSQL")

2. **Given** a skill that has no direct match in the ontology  
   **When** fuzzy matching is attempted  
   **Then** the closest match with similarity ≥ 0.85 is used; below threshold the skill is stored as-is and flagged for ontology review

3. **Given** normalized skills are stored  
   **When** a recruiter searches for "React"  
   **Then** candidates with "ReactJS", "React.js", or "React" all appear in results

4. **Given** the skill ontology is updated  
   **When** a re-normalization job is triggered  
   **Then** all existing profiles are re-normalized without data loss

5. **Given** a skill is an alias (e.g., "K8s")  
   **When** normalization runs  
   **Then** it maps to the canonical form "Kubernetes"

## Priority
**P0 — Must Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **Ontology Source:** ESCO Skills Taxonomy v1.1 + custom extension for tech skills
- **Matching Strategy:** Exact match → alias lookup → fuzzy match (Levenshtein / cosine on embeddings)
- **Fuzzy Threshold:** ≥ 0.85 similarity for auto-normalization
- **Performance:** Normalization of 500 skills ≤ 200ms
- **Ontology Updates:** Versioned; re-normalization job runs on version bump
- **Storage:** Canonical skill list stored in PostgreSQL; alias map cached in Redis

## Technical Design

### Normalization Pipeline
```python
class SkillNormalizer:
    def __init__(self, ontology: SkillOntology):
        self.ontology = ontology
        self.alias_map = ontology.get_alias_map()  # {"reactjs": "React", "k8s": "Kubernetes"}
        self.embeddings = ontology.get_skill_embeddings()

    def normalize(self, raw_skill: str) -> NormalizedSkill:
        key = raw_skill.lower().strip()
        
        # 1. Exact match
        if key in self.ontology.canonical_map:
            return NormalizedSkill(canonical=self.ontology.canonical_map[key], confidence=1.0)
        
        # 2. Alias lookup
        if key in self.alias_map:
            return NormalizedSkill(canonical=self.alias_map[key], confidence=0.99)
        
        # 3. Fuzzy / embedding match
        best_match, score = self._embedding_match(raw_skill)
        if score >= 0.85:
            return NormalizedSkill(canonical=best_match, confidence=score)
        
        # 4. Unknown — store raw, flag for review
        return NormalizedSkill(canonical=raw_skill, confidence=score, needs_review=True)
```

### Database Schema
```sql
CREATE TABLE skill_ontology (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name VARCHAR(100) UNIQUE NOT NULL,
  category VARCHAR(50),  -- e.g., "programming_language", "framework", "cloud"
  aliases TEXT[],
  embedding_vector vector(1536),
  ontology_version VARCHAR(10),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE candidate_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  raw_skill VARCHAR(200),
  canonical_skill VARCHAR(100) REFERENCES skill_ontology(canonical_name),
  skill_type VARCHAR(20) CHECK (skill_type IN ('explicit', 'inferred', 'normalized')),
  confidence FLOAT,
  needs_review BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_candidate_skills_canonical ON candidate_skills(canonical_skill);
CREATE INDEX idx_candidate_skills_candidate ON candidate_skills(candidate_id);
```

### API Endpoints
```
GET  /api/skills/ontology              — List canonical skills
POST /api/skills/normalize             — Normalize a list of raw skills
GET  /api/skills/review-queue          — Skills flagged for ontology review
POST /api/skills/ontology              — Add new canonical skill or alias (admin)
POST /api/admin/skills/re-normalize    — Trigger full re-normalization job
```

## Sub-Tasks
- [ ] 02.5.a — Build and seed skill ontology (ESCO + tech extensions)
- [ ] 02.5.b — Implement exact match and alias lookup
- [ ] 02.5.c — Implement embedding-based fuzzy matching
- [ ] 02.5.d — Implement re-normalization background job
- [ ] 02.5.e — Build admin UI for ontology management and review queue
- [ ] 02.5.f — Write unit tests for all matching strategies

## Testing Strategy
- Unit: Exact match, alias lookup, fuzzy threshold boundary cases
- Integration: Full normalization pipeline with sample skill lists
- Regression: Re-normalization job preserves all existing data

## Dependencies
- Story 02.4 (LLM entity extraction — provides raw skills)
- Epic 16 (Admin panel — ontology management UI)
