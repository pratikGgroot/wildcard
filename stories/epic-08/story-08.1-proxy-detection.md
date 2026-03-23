# Story 08.1: Demographic Proxy Detection

## User Story
**As a** system  
**I want to** detect demographic proxy fields in candidate profiles  
**So that** I can assess whether they may be influencing AI scoring in a discriminatory way

## BRD Requirements Covered
- FR-BD-01: Analyze AI scores across demographic proxies (name patterns, gender-coded language, institutions)
- BRD Section 8.7 Step 1: Identify demographic proxies — name (gender/ethnicity inference), university prestige, address/zip code, graduation year (age proxy)

## Acceptance Criteria
1. **Given** a candidate profile is processed  
   **When** proxy detection runs  
   **Then** it identifies which fields are potential demographic proxies (name, address, graduation year, institution)

2. **Given** proxy fields are identified  
   **When** detection completes  
   **Then** each proxy is categorized: gender proxy, ethnicity proxy, age proxy, socioeconomic proxy

3. **Given** proxy detection runs  
   **When** results are stored  
   **Then** they are stored in the BiasAuditLog with the proxy fields detected and their categories

4. **Given** a name is detected as a gender/ethnicity proxy  
   **When** the result is stored  
   **Then** the actual inferred value is NOT stored (only the fact that a proxy was detected) to avoid reinforcing bias

5. **Given** proxy detection completes  
   **When** the bias analysis pipeline continues  
   **Then** the detected proxies are passed to the counterfactual analysis (Story 08.2)

## Priority
**P0 — Must Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **Libraries:** Fairlearn, AIF360 for disparate impact computation
- **Name Analysis:** Use name-ethnicity/gender inference library (e.g., `ethnicolr`, `gender-guesser`) — inference only, not stored
- **Privacy:** Proxy inference results are used only for bias detection; never exposed to recruiters as labels
- **Performance:** Proxy detection ≤ 1 second per candidate

## Technical Design

### Proxy Detection
```python
PROXY_FIELDS = {
    "name": {"type": "gender_ethnicity", "method": "name_inference"},
    "address": {"type": "socioeconomic", "method": "zip_code_lookup"},
    "graduation_year": {"type": "age", "method": "year_calculation"},
    "institution": {"type": "prestige_socioeconomic", "method": "institution_ranking"}
}

class ProxyDetector:
    def detect(self, profile: ParsedProfile) -> list[ProxyDetection]:
        detections = []
        for field, config in PROXY_FIELDS.items():
            value = getattr(profile, field, None)
            if value and self._is_proxy_present(value, config):
                detections.append(ProxyDetection(
                    field=field,
                    proxy_type=config["type"],
                    detected=True
                    # NOTE: inferred demographic value NOT stored
                ))
        return detections
```

### Database Schema
```sql
CREATE TABLE bias_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id),
  proxy_fields_detected JSONB,  -- [{"field": "name", "proxy_type": "gender_ethnicity"}]
  score_with_proxy FLOAT,
  score_without_proxy FLOAT,
  delta FLOAT,
  risk_level VARCHAR(10) CHECK (risk_level IN ('Low','Medium','High')),
  flagged_at TIMESTAMP DEFAULT NOW(),
  reviewed_by UUID REFERENCES users(id),
  resolution TEXT
);
```

### API Endpoints
```
POST /api/applications/:id/bias/detect-proxies   — Run proxy detection
GET  /api/applications/:id/bias/audit            — Get bias audit log entry
```

## Sub-Tasks
- [ ] 08.1.a — Implement proxy field identification for all 4 proxy types
- [ ] 08.1.b — Integrate Fairlearn/AIF360 for disparate impact computation
- [ ] 08.1.c — Implement proxy detection pipeline trigger (runs after scoring)
- [ ] 08.1.d — Write unit tests ensuring inferred values are never stored

## Testing Strategy
- Unit: Proxy detection for each field type, privacy assertion (no inferred values stored)
- Integration: Full proxy detection pipeline with real profiles
- Privacy: Verify audit log contains no demographic labels

## Dependencies
- Story 04.2 (Fit score calculation — score_with_proxy value)
- Story 08.2 (Counterfactual analysis — uses proxy detection output)
