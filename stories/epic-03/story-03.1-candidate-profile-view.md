# Story 03.1: Candidate Profile View

## User Story
**As a** recruiter  
**I want to** view a structured candidate profile page  
**So that** I can quickly understand a candidate's background, fit score, and AI insights in one place

## BRD Requirements Covered
- FR-CP-01: Create a structured candidate profile from parsed resume data
- FR-CP-03: Display candidate's AI fit score, summary, and skill match breakdown
- BRD Section 12.1: Candidate Card — detailed view: profile, fit score, AI summary, interview kit

## Acceptance Criteria
1. **Given** a candidate has been parsed and scored  
   **When** a recruiter opens the candidate profile  
   **Then** they see: personal info, work experience timeline, education, skills (with canonical tags), certifications, and projects

2. **Given** a fit score has been computed  
   **When** the profile loads  
   **Then** the fit score (0–100) is displayed prominently with a color indicator (green ≥ 70, amber 40–69, red < 40)

3. **Given** an AI summary has been generated  
   **When** the profile loads  
   **Then** the 3–5 sentence AI summary is displayed with a "Regenerate" option

4. **Given** a score breakdown is available  
   **When** the recruiter clicks "Why this score?"  
   **Then** a panel opens showing per-criterion contributions (Technical Skills, Experience, Education, Projects)

5. **Given** the profile is loading  
   **When** the page renders  
   **Then** it loads within 2 seconds (P95) and shows skeleton loaders during data fetch

6. **Given** a recruiter is on the profile  
   **When** they click "View Resume"  
   **Then** the original resume file opens in a side panel or new tab

## Priority
**P0 — Must Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **Page Load:** ≤ 2 seconds (P95) — BRD NFR-P-04
- **Responsive:** Works on tablet (hiring managers reviewing on the go) — BRD Section 12.2
- **Accessibility:** WCAG 2.1 AA target
- **Caching:** Profile data cached in Redis with 5-minute TTL; invalidated on profile update
- **Resume File:** Served via pre-signed S3 URL (1-hour expiry)

## Technical Design

### Component Structure
```
CandidateProfilePage
├── ProfileHeader (name, contact, fit score badge, AI summary)
├── ScoreBreakdownPanel (collapsible, criterion bars)
├── ExperienceTimeline (sorted by date desc)
├── EducationSection
├── SkillsCloud (canonical tags, color-coded by type)
├── CertificationsSection
├── ProjectsSection
├── ResumeViewer (side panel, pre-signed URL)
└── ActionBar (Move Stage, Add Note, Generate Interview Kit)
```

### API Endpoints
```
GET /api/candidates/:id                    — Full candidate profile
GET /api/candidates/:id/applications/:jobId — Application-specific data (score, summary)
GET /api/candidates/:id/resume-url         — Pre-signed resume download URL
```

## Sub-Tasks
- [ ] 03.1.a — Build ProfileHeader component with fit score badge
- [ ] 03.1.b — Build ExperienceTimeline and EducationSection components
- [ ] 03.1.c — Build SkillsCloud with canonical tag display
- [ ] 03.1.d — Build ScoreBreakdownPanel (collapsible)
- [ ] 03.1.e — Implement resume side-panel viewer
- [ ] 03.1.f — Implement skeleton loaders and error states

## Testing Strategy
- Unit: Score color logic, component rendering
- Integration: Profile API with real candidate data
- Performance: Page load ≤ 2s with full profile data
- Accessibility: Screen reader and keyboard navigation

## Dependencies
- Epic 02 (Parsed profile data)
- Epic 04 (Fit score and breakdown)
- Epic 15 (S3 file storage for resume URL)
