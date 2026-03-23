# Story 04.4: Score Recalculation on JD Update

## User Story
**As a** system  
**I want to** automatically recalculate fit scores when a job's criteria are updated  
**So that** scores always reflect the current job requirements

## BRD Requirements Covered
- FR-SC-04: Scores are recalculated if the JD criteria are updated

## Acceptance Criteria
1. **Given** a recruiter updates the criteria or weights for an active job  
   **When** the update is saved  
   **Then** a recalculation job is queued for all candidates in that job's pipeline

2. **Given** a recalculation job is queued  
   **When** the recruiter views the pipeline  
   **Then** they see a banner: "Scores are being recalculated — estimated completion: X minutes"

3. **Given** recalculation completes  
   **When** the pipeline view refreshes  
   **Then** all scores are updated and the banner is dismissed

4. **Given** recalculation is in progress  
   **When** a recruiter views a candidate card  
   **Then** the old score is shown with a "Recalculating..." indicator

5. **Given** recalculation completes  
   **When** scores are updated  
   **Then** the previous scores are retained in history (not overwritten) for audit purposes

6. **Given** the JD embedding changes (criteria text changed)  
   **When** recalculation runs  
   **Then** the JD embedding is regenerated before candidate scores are recomputed

## Priority
**P0 — Must Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **Trigger:** Automatic on JD criteria save; also manually triggerable by recruiter
- **Queue:** Recalculation jobs processed via SQS/BullMQ to avoid blocking UI
- **Progress:** Real-time progress via WebSocket or polling
- **Audit:** Old scores retained with `is_current = FALSE` flag
- **Throughput:** Recalculation of 500 candidates ≤ 10 minutes (NFR-P-05)

## Technical Design

### Recalculation Trigger
```python
@event_handler("job.criteria_updated")
async def on_criteria_updated(job_id: UUID, criteria_version: int):
    # Re-embed the JD
    await embedding_service.embed_job(job_id)
    
    # Queue recalculation for all active applications
    applications = await db.get_active_applications(job_id)
    for app in applications:
        await queue.enqueue("recalculate_score", {
            "application_id": app.id,
            "job_id": job_id,
            "criteria_version": criteria_version
        })
    
    # Notify recruiter
    await notify_recruiter(job_id, f"Recalculating scores for {len(applications)} candidates")
```

### API Endpoints
```
POST /api/jobs/:id/recalculate-scores   — Manually trigger recalculation
GET  /api/jobs/:id/recalculation-status — Get progress (completed/total)
```

## Sub-Tasks
- [ ] 04.4.a — Implement event trigger on JD criteria save
- [ ] 04.4.b — Implement recalculation queue job
- [ ] 04.4.c — Build progress banner UI with WebSocket updates
- [ ] 04.4.d — Implement score history preservation (is_current flag)

## Testing Strategy
- Unit: Event trigger logic, queue job creation
- Integration: Full recalculation flow with criteria update
- Concurrency: Multiple jobs recalculating simultaneously

## Dependencies
- Story 04.1 (Embedding generation)
- Story 04.2 (Fit score calculation)
- Epic 01 (Job criteria update — trigger source)
