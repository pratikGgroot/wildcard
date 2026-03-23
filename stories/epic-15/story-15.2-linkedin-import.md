# Story 15.2: LinkedIn Profile Import

## User Story
**As a** recruiter  
**I want to** import a candidate's LinkedIn profile as their resume  
**So that** candidates don't need to upload a separate resume file

## BRD Requirements Covered
- BRD Section 10: LinkedIn Import — OAuth + Profile API (Should Have)
- FR-RP-04: Support LinkedIn profile URL import as a resume source

## Acceptance Criteria
1. **Given** a recruiter provides a LinkedIn profile URL  
   **When** they click "Import from LinkedIn"  
   **Then** the candidate is prompted to authorize the LinkedIn OAuth connection

2. **Given** the candidate authorizes  
   **When** the OAuth flow completes  
   **Then** the profile data (name, experience, education, skills) is fetched and stored

3. **Given** LinkedIn data is fetched  
   **When** it is processed  
   **Then** it is mapped to the canonical candidate profile schema and enters the normal parsing pipeline

4. **Given** a LinkedIn import is performed  
   **When** the source is recorded  
   **Then** the application source is set to "LinkedIn Import"

5. **Given** the LinkedIn API is unavailable  
   **When** import is attempted  
   **Then** an error is shown: "LinkedIn import temporarily unavailable. Please upload a resume file."

## Priority
**P1 — Should Have**

## Estimated Effort
**8 story points**

## NFR / Tech Notes
- **OAuth Scopes:** `r_liteprofile`, `r_emailaddress` (LinkedIn basic profile)
- **API:** LinkedIn Profile API v2
- **Token Storage:** Encrypted; used only for the import, not stored long-term
- **Rate Limits:** LinkedIn API rate limits apply; implement backoff

## Technical Design

### LinkedIn Profile Mapping
```python
def map_linkedin_to_profile(linkedin_data: dict) -> ParsedProfile:
    return ParsedProfile(
        personal={
            "name": f"{linkedin_data['firstName']['localized']['en_US']} {linkedin_data['lastName']['localized']['en_US']}",
            "linkedin_url": f"https://linkedin.com/in/{linkedin_data['vanityName']}"
        },
        experience=[
            {
                "company": pos["companyName"],
                "title": pos["title"],
                "start_date": f"{pos['timePeriod']['startDate']['year']}-{pos['timePeriod']['startDate'].get('month', 1):02d}",
                "end_date": None if pos.get("isCurrent") else f"{pos['timePeriod']['endDate']['year']}-{pos['timePeriod']['endDate'].get('month', 12):02d}"
            }
            for pos in linkedin_data.get("positions", {}).get("values", [])
        ]
    )
```

### API Endpoints
```
POST /api/integrations/linkedin/import-url   — Initiate LinkedIn import for a URL
GET  /api/integrations/linkedin/callback     — OAuth callback
```

## Sub-Tasks
- [ ] 15.2.a — Implement LinkedIn OAuth flow
- [ ] 15.2.b — Implement LinkedIn Profile API data fetching
- [ ] 15.2.c — Implement LinkedIn → canonical profile mapping
- [ ] 15.2.d — Integrate with normal parsing pipeline (Story 02.4)
- [ ] 15.2.e — Implement error handling for API unavailability

## Testing Strategy
- Unit: Profile mapping, OAuth token handling
- Integration: Full LinkedIn import flow with test account
- Error: API unavailability fallback

## Dependencies
- Story 02.4 (LLM extraction — LinkedIn data enters same pipeline)
- Story 11.4 (Source tracking — LinkedIn Import source)
