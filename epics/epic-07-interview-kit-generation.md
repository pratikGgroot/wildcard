# Epic 07: Interview Kit Generation

## Overview
Generate personalized interview kits for each candidate using AI, including technical questions, behavioral questions, gap-probe questions, and scoring rubrics.

## Business Value
- Reduces interview prep time from 30-60 minutes to instant
- Ensures consistent, role-relevant interview questions
- Identifies candidate-specific areas to probe

## BRD Requirements Covered
- FR-IK-01: Generate tailored interview kit per candidate
- FR-IK-02: Include technical, behavioral, and gap-probe questions
- FR-IK-03: Tag questions by competency and difficulty
- FR-IK-04: Provide scoring rubric per question
- FR-IK-05: Interviewer can edit/approve kit
- FR-IK-06: Export as PDF or shareable link
- FR-IK-07: Flag weak areas for deeper probing

## Priority
**HIGH**

## NFR / Tech Notes
- **Generation Time:** Kit generation ≤15 seconds
- **Question Quality:** 90% of generated questions rated relevant by interviewers
- **LLM Model:** Claude Sonnet 4 for question generation
- **Template Library:** Maintain question templates by role type

## Technical Design

### Kit Generation Pipeline
```
Candidate Profile + Job Criteria
       ↓
[Identify Skill Gaps]
       ↓
[LLM: Generate Technical Questions]
       ↓
[LLM: Generate Behavioral Questions]
       ↓
[LLM: Generate Gap-Probe Questions]
       ↓
[Generate Scoring Rubrics]
       ↓
[Compile Kit with Metadata]
       ↓
[Store & Present for Review]
```

### Data Model
```typescript
interface InterviewKit {
  id: string;
  applicationId: string;
  candidateId: string;
  jobId: string;
  
  technicalQuestions: Question[];
  behavioralQuestions: Question[];
  gapProbeQuestions: Question[];
  
  generatedAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
  exportUrl?: string;
}

interface Question {
  id: string;
  text: string;
  competency: string;
  type: 'technical' | 'behavioral' | 'gap-probe';
  difficulty: 'easy' | 'medium' | 'hard';
  rubric: {
    lookFor: string[];
    redFlags: string[];
    greenFlags: string[];
  };
  estimatedTime: number; // minutes
}
```

### Database Schema
```sql
CREATE TABLE interview_kits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES candidates(id),
  job_id UUID REFERENCES jobs(id),
  
  kit_data JSONB NOT NULL,
  
  generated_at TIMESTAMP DEFAULT NOW(),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  export_url VARCHAR(1000)
);

CREATE INDEX idx_interview_kits_application ON interview_kits(application_id);
```

## Stories
- Story 07.1: Skill Gap Analysis
- Story 07.2: Technical Question Generation
- Story 07.3: Behavioral Question Generation
- Story 07.4: Gap-Probe Question Generation
- Story 07.5: Scoring Rubric Generation
- Story 07.6: Kit Review and Edit Interface
- Story 07.7: PDF Export and Sharing

## Estimated Effort
**18-21 story points** (3 sprints)

## Success Metrics
- Kit generation time ≤15 seconds
- 90% of kits approved with minimal edits
- Interviewer satisfaction ≥4.5/5
