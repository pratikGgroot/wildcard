# Epic 03: Candidate Profile Management

## Overview
Provide comprehensive candidate profile views with AI-generated insights, search/filter capabilities, and document management. Enable recruiters to efficiently manage and interact with candidate data.

## Business Value
- Centralized candidate information reduces time spent searching for data
- AI-generated summaries provide instant candidate insights
- Historical tracking enables better hiring decisions

## Acceptance Criteria
- Structured candidate profiles display all parsed resume data
- Recruiters can add notes, tags, and custom fields
- AI fit score and skill match breakdown are prominently displayed
- Full application history is maintained across all jobs
- Profiles are searchable and filterable across pipelines
- Additional documents can be attached to profiles

## Priority
**CRITICAL** - Core user-facing functionality

## Dependencies
- Epic 02 (Resume parsing)
- Epic 04 (AI scoring)

## NFR / Tech Notes
- **Performance:** Profile page load ≤2 seconds (NFR-P-04)
- **Search:** Full-text search responds within 1 second
- **Scalability:** Support 1M+ candidate profiles (NFR 7.2)
- **Data Privacy:** PII fields encrypted at rest (AES-256)

## Technical Design

### Profile Data Architecture
```
┌─────────────────────────────────────────┐
│         Candidate Profile View          │
├─────────────────────────────────────────┤
│ Personal Info (masked for bias)         │
│ AI Summary & Fit Score                  │
│ Experience Timeline                     │
│ Skills Matrix (explicit + inferred)     │
│ Education & Certifications              │
│ Application History                     │
│ Recruiter Notes & Tags                  │
│ Attached Documents                      │
└─────────────────────────────────────────┘
```

### Database Schema
```sql
CREATE TABLE candidate_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  application_id UUID REFERENCES applications(id),
  note_text TEXT NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE candidate_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  tag_name VARCHAR(50) NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE candidate_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  document_type VARCHAR(50), -- cover_letter, portfolio, certificate
  file_key VARCHAR(500) NOT NULL,
  file_url VARCHAR(1000),
  file_name VARCHAR(200),
  uploaded_by UUID REFERENCES users(id),
  uploaded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_candidate_notes_candidate ON candidate_notes(candidate_id);
CREATE INDEX idx_candidate_tags_candidate ON candidate_tags(candidate_id);
CREATE INDEX idx_candidate_documents_candidate ON candidate_documents(candidate_id);
```

## Stories
- [Story 03.1: Candidate Profile View](stories/epic-03/story-03.1-profile-view.md)
- [Story 03.2: Add Notes and Tags](stories/epic-03/story-03.2-notes-tags.md)
- [Story 03.3: Display AI Insights](stories/epic-03/story-03.3-ai-insights.md)
- [Story 03.4: Application History](stories/epic-03/story-03.4-application-history.md)
- [Story 03.5: Candidate Search and Filter](stories/epic-03/story-03.5-search-filter.md)
- [Story 03.6: Attach Documents](stories/epic-03/story-03.6-attach-documents.md)

## Estimated Effort
**15-18 story points** (2-3 sprints)

## Success Metrics
- Profile page load time ≤2 seconds (P95)
- Search response time ≤1 second
- 90% of recruiters use notes/tags feature weekly
- Zero PII data breaches
