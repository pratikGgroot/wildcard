# Story 08.4: Blind Review Mode (Field Masking)

## User Story
**As a** recruiter  
**I want to** enable blind review mode for a job  
**So that** demographic proxy fields are hidden during initial screening to reduce unconscious bias

## BRD Requirements Covered
- FR-BD-04: Mask or suppress known demographic proxy fields during scoring (name, photo, address)
- BRD Section 8.7 Mitigation: Auto-mask name, address, photo fields during initial screening (blind review mode); recruiter configurable per job

## Acceptance Criteria
1. **Given** blind review mode is enabled for a job  
   **When** a recruiter views candidate cards in the pipeline  
   **Then** name, photo, address, and graduation year are hidden/replaced with "Candidate A", "Candidate B", etc.

2. **Given** blind review mode is enabled  
   **When** AI scoring runs  
   **Then** proxy fields are automatically masked before embedding generation (not just in UI)

3. **Given** a recruiter wants to enable blind mode  
   **When** they toggle it in job settings  
   **Then** it applies immediately to all candidates in that pipeline

4. **Given** blind mode is active  
   **When** a recruiter moves a candidate to the interview stage  
   **Then** the candidate's real name and contact info are revealed (blind mode ends at interview stage)

5. **Given** blind mode is disabled  
   **When** a recruiter views the pipeline  
   **Then** all candidate information is shown normally

## Priority
**P0 — Must Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **Scope:** Blind mode applies to: pipeline view, candidate cards, AI scoring input
- **Reveal Trigger:** Configurable — default: reveal at Interview stage
- **Audit:** Blind mode enable/disable events logged
- **Anonymization:** Candidates labeled "Candidate A", "Candidate B" in alphabetical order by application date

## Technical Design

### Blind Mode Configuration
```sql
ALTER TABLE jobs ADD COLUMN blind_review_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE jobs ADD COLUMN blind_review_reveal_stage VARCHAR(50) DEFAULT 'Interviewing';
```

### Masking Middleware
```python
def apply_blind_mode(candidate: CandidateProfile, job: Job, current_stage: str) -> CandidateProfile:
    if not job.blind_review_enabled:
        return candidate
    
    # Check if past reveal stage
    if is_past_reveal_stage(current_stage, job.blind_review_reveal_stage):
        return candidate
    
    return candidate.copy(update={
        "personal": {
            "name": f"Candidate {candidate.anonymized_label}",
            "email": "hidden",
            "phone": "hidden",
            "address": None,
            "photo_url": None
        },
        "education": [
            {**edu, "institution": "University", "graduation_year": None}
            for edu in candidate.education
        ]
    })
```

### API Endpoints
```
PATCH /api/jobs/:id/blind-review   — Enable/disable blind review mode
GET   /api/jobs/:id/blind-review   — Get blind review configuration
```

## Sub-Tasks
- [ ] 08.4.a — Implement blind mode configuration in job settings
- [ ] 08.4.b — Implement masking middleware for API responses
- [ ] 08.4.c — Implement masking in AI scoring pipeline (not just UI)
- [ ] 08.4.d — Implement reveal trigger at configurable stage
- [ ] 08.4.e — Build blind mode toggle UI in job settings

## Testing Strategy
- Unit: Masking completeness, reveal trigger logic
- Integration: Blind mode end-to-end (enable → view pipeline → reveal at interview)
- Security: Verify masked fields are not accessible via API when blind mode is active

## Dependencies
- Story 04.1 (Embedding generation — must use masked profile when blind mode active)
- Epic 09 (Pipeline stages — reveal trigger)
