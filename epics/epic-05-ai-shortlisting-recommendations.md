# Epic 05: AI Shortlisting & Recommendations

## Overview
Automatically generate shortlist recommendations with transparent reasoning, enabling recruiters to quickly identify top candidates with AI-powered insights.

## Business Value
- Reduces time-to-shortlist by 50%
- Provides transparent reasoning for every recommendation
- Learns from recruiter feedback to improve future recommendations

## BRD Requirements Covered
- FR-SL-01: AI recommends top N candidates with reasoning
- FR-SL-02: Reasoning displayed in plain English
- FR-SL-03: Recruiter can accept/reject/defer recommendations
- FR-SL-04: System learns from feedback
- FR-SL-05: Show "near miss" candidates

## Priority
**CRITICAL**

## NFR / Tech Notes
- **Performance:** Shortlist generation ≤30 seconds for 200 candidates
- **Accuracy:** Top-5 matches recruiter picks ≥70% of time (KPI)
- **Learning:** RLHF-lite approach for preference learning

## Stories
- Story 05.1: Generate Shortlist Recommendations
- Story 05.2: LLM-based Reasoning Generation
- Story 05.3: Accept/Reject/Defer Actions
- Story 05.4: Feedback Loop & Learning
- Story 05.5: Near Miss Candidates Display

## Estimated Effort
**13-16 story points** (2 sprints)
