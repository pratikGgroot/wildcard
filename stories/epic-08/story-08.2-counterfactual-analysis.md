# Story 08.2: Counterfactual Bias Analysis

## User Story
**As a** system  
**I want to** rescore candidate profiles with proxy fields masked  
**So that** I can detect whether demographic proxies are influencing AI scores

## BRD Requirements Covered
- FR-BD-02: Flag if a demographic proxy appears to significantly influence a score
- BRD Section 8.7 Step 2: Run counterfactual analysis — rescore profile with proxy fields masked/altered; if score delta > threshold (±10 points), flag as potentially biased

## Acceptance Criteria
1. **Given** proxy fields have been detected for a candidate  
   **When** counterfactual analysis runs  
   **Then** the candidate profile is re-scored with proxy fields (name, address, graduation year) masked/nulled

2. **Given** the counterfactual score is computed  
   **When** the delta is calculated  
   **Then** delta = |original_score - masked_score|

3. **Given** delta > 10 points  
   **When** the threshold is crossed  
   **Then** the application is flagged as "potentially biased" and added to the bias review queue

4. **Given** delta ≤ 10 points  
   **When** analysis completes  
   **Then** the application is marked "Low bias risk" and no flag is raised

5. **Given** a bias flag is raised  
   **When** the recruiter views the candidate card  
   **Then** a bias warning indicator is shown with a link to the explanation

6. **Given** counterfactual analysis runs  
   **When** results are stored  
   **Then** both scores (with and without proxy), delta, and risk level are stored in BiasAuditLog

## Priority
**P0 — Must Have**

## Estimated Effort
**8 story points**

## NFR / Tech Notes
- **Bias Threshold:** ±10 points score delta (configurable per org)
- **Masking Strategy:** Null out proxy fields; replace name with generic placeholder
- **Performance:** Counterfactual scoring ≤ 15 seconds (requires re-embedding masked profile)
- **Audit:** All counterfactual results stored with model version and timestamp

## Technical Design

### Counterfactual Scoring
```python
class CounterfactualAnalyzer:
    BIAS_THRESHOLD = 10.0
    
    async def analyze(self, application_id: UUID) -> BiasAnalysisResult:
        application = await db.get_application(application_id)
        original_score = application.fit_score
        
        # Create masked profile
        masked_profile = self._mask_proxy_fields(application.candidate.profile)
        
        # Re-embed and re-score masked profile
        masked_embedding = await embedding_service.embed_profile(masked_profile)
        masked_score = await scoring_service.compute_score(
            masked_embedding, application.job.embedding
        )
        
        delta = abs(original_score - masked_score)
        risk_level = "High" if delta > self.BIAS_THRESHOLD else "Low"
        
        await db.update_bias_audit_log(application_id, {
            "score_with_proxy": original_score,
            "score_without_proxy": masked_score,
            "delta": delta,
            "risk_level": risk_level
        })
        
        if risk_level == "High":
            await self._flag_for_review(application_id, delta)
        
        return BiasAnalysisResult(delta=delta, risk_level=risk_level)
    
    def _mask_proxy_fields(self, profile: dict) -> dict:
        masked = profile.copy()
        masked["personal"]["name"] = "Candidate"
        masked["personal"]["address"] = None
        masked["education"] = [
            {**edu, "institution": "University"} for edu in masked["education"]
        ]
        return masked
```

### API Endpoints
```
POST /api/applications/:id/bias/counterfactual   — Run counterfactual analysis
GET  /api/jobs/:id/bias/flagged                  — List flagged applications for a job
```

## Sub-Tasks
- [ ] 08.2.a — Implement proxy field masking strategy
- [ ] 08.2.b — Implement counterfactual re-embedding and re-scoring
- [ ] 08.2.c — Implement bias threshold check and flagging
- [ ] 08.2.d — Implement bias flag indicator on candidate card UI
- [ ] 08.2.e — Write unit tests for masking, delta calculation, threshold logic

## Testing Strategy
- Unit: Masking completeness, delta calculation, threshold boundary
- Integration: Full counterfactual pipeline with real profiles
- Regression: Verify masking doesn't break scoring pipeline

## Dependencies
- Story 08.1 (Proxy detection — identifies which fields to mask)
- Story 04.1 (Embedding generation — re-embedding masked profile)
- Story 04.2 (Fit score calculation — re-scoring)
