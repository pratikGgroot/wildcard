# AI-Driven Hiring Intelligence Platform - Epics & Stories

## Overview
This directory contains detailed epics and user stories for building an AI-powered Applicant Tracking System (ATS) with embedded AI agents. The platform transforms traditional passive tracking into active intelligent hiring assistance.

**Source:** `docs/BRD_AI_Hiring_Intelligence_Platform.md`  
**Created:** March 18, 2026  
**Status:** Ready for Development

---

## Quick Navigation

### 📋 Start Here
- **[EPIC_INDEX.md](EPIC_INDEX.md)** - Complete epic summary with dependencies and metrics
- **[BRD Document](../docs/BRD_AI_Hiring_Intelligence_Platform.md)** - Original requirements

### 📁 Epic Files
All epic files are in the `epics/` directory with naming pattern: `epic-XX-name.md`

### 📝 Story Files
All story files are organized under `stories/epic-XX/` with naming pattern: `story-XX.Y-name.md`

---

## Epic List

### Phase 1: Foundation (Critical Path)

1. **[Epic 01: Job Description Management](epic-01-job-description-management.md)** ⭐ CRITICAL
   - 7 stories, 16-20 SP
   - AI-powered criteria extraction, job templates, weight configuration
   - **Key SLA:** Criteria extraction ≤5 seconds

2. **[Epic 02: Resume Ingestion & Parsing](epic-02-resume-ingestion-parsing.md)** ⭐ CRITICAL
   - 8 stories, 21-25 SP
   - Bulk upload, LLM parsing, skill normalization, duplicate detection
   - **Key SLA:** ≥100 resumes/minute, ≥95% accuracy

3. **[Epic 12: Authentication & Authorization](epic-12-authentication-authorization.md)** ⭐ CRITICAL
   - 8 stories, 21-26 SP
   - SSO, MFA, RBAC, JWT tokens
   - **Key SLA:** Login ≤2 seconds, 99.99% uptime

4. **[Epic 14: System Infrastructure & DevOps](epic-14-system-infrastructure.md)** ⭐ CRITICAL
   - 8 stories, 26-32 SP
   - Kubernetes, CI/CD, monitoring, observability
   - **Key SLA:** 99.9% uptime, MTTR ≤30 minutes

### Phase 2: AI Core

5. **[Epic 03: Candidate Profile Management](epic-03-candidate-profile-management.md)** ⭐ CRITICAL
   - 6 stories, 15-18 SP
   - Profile views, notes/tags, search/filter, document management
   - **Key SLA:** Profile load ≤2 seconds

6. **[Epic 04: AI Candidate Scoring & Ranking](epic-04-ai-scoring-ranking.md)** ⭐ CRITICAL
   - 6 stories, 18-21 SP
   - Semantic embeddings, fit score calculation, multi-dimensional scoring
   - **Key SLA:** Scoring ≤10 seconds, top-5 accuracy ≥70%

7. **[Epic 05: AI Shortlisting & Recommendations](epic-05-ai-shortlisting-recommendations.md)** ⭐ CRITICAL
   - 5 stories, 13-16 SP
   - Automated shortlist generation, reasoning, feedback loop
   - **Key SLA:** Generation ≤30 seconds for 200 candidates

8. **[Epic 08: Bias Detection & Explainability](epic-08-bias-detection-explainability.md)** ⭐ CRITICAL
   - 8 stories, 21-26 SP
   - Counterfactual analysis, fairness metrics, audit logging
   - **Key SLA:** 100% AI decisions logged, bias detection ≥85% accuracy

### Phase 3: Intelligence Layer

9. **[Epic 06: Recruiter Conversational Assistant](epic-06-conversational-assistant.md)** 🔥 HIGH
   - 8 stories, 21-26 SP
   - Natural language queries, semantic search, multi-turn conversations
   - **Key SLA:** Response ≤3 seconds, 1,000 concurrent sessions

10. **[Epic 07: Interview Kit Generation](epic-07-interview-kit-generation.md)** 🔥 HIGH
    - 7 stories, 18-21 SP
    - Personalized questions, scoring rubrics, PDF export
    - **Key SLA:** Generation ≤15 seconds

11. **[Epic 09: Pipeline & Workflow Management](epic-09-pipeline-workflow-management.md)** ⭐ CRITICAL
    - 7 stories, 18-21 SP
    - Configurable stages, kanban board, bulk actions, automations
    - **Key SLA:** Pipeline load ≤2 seconds

12. **[Epic 10: Notifications & Communication](epic-10-notifications-communication.md)** 🔥 HIGH
    - 7 stories, 15-18 SP
    - Email templates, in-app notifications, Gmail/Outlook integration
    - **Key SLA:** Email delivery ≤5 minutes, ≥99% success rate

### Phase 4: Analytics & Compliance

13. **[Epic 11: Reporting & Analytics Dashboard](epic-11-reporting-analytics.md)** 🔥 HIGH
    - 7 stories, 18-21 SP
    - Metrics dashboards, funnel charts, bias analytics, CSV/PDF export
    - **Key SLA:** Dashboard load ≤2 seconds

14. **[Epic 13: Data Privacy & Compliance](epic-13-data-privacy-compliance.md)** ⭐ CRITICAL
    - 8 stories, 21-26 SP
    - GDPR/DPDP compliance, PII encryption, right to erasure, data portability
    - **Key SLA:** Data deletion ≤30 days, 100% PII encrypted

---

## Story Structure

Each story file includes:

### Standard Sections
- **User Story:** As a [role], I want to [action], so that [benefit]
- **BRD Requirements Covered:** Traceability to original requirements
- **Acceptance Criteria:** Given/When/Then format
- **Priority:** P0 (Critical), P1 (Should Have), P2 (Nice to Have)
- **Estimated Effort:** Story points
- **NFR / Tech Notes:** Performance, scalability, technical constraints
- **Technical Design:** Architecture, data models, API specs, code samples
- **Testing Strategy:** Unit, integration, E2E, performance tests
- **Dependencies:** Required stories/epics

### SLA Tracking
Stories with specific SLA requirements include a dedicated "SLA Requirements" section highlighting:
- Performance targets (latency, throughput)
- Availability requirements
- Accuracy/quality metrics

All SLA requirements are also documented in the NFR/Tech Notes section of each epic.

---

## Key Performance Indicators (KPIs)

### Business KPIs
- **G1:** Reduce manual screening time by ≥60%
- **G2:** Increase shortlist-to-offer conversion by ≥25%
- **G3:** Reduce time-to-shortlist by ≥50%
- **G4:** Reduce demographic score variance by ≥30%
- **G5:** Achieve recruiter NPS ≥40

### Technical KPIs
- **Parsing accuracy:** ≥95%
- **Ranking precision:** Top-5 match ≥70%
- **AI scoring latency:** ≤10 seconds
- **Chat response time:** ≤3 seconds
- **System uptime:** 99.9%

---

## Technology Stack

### Frontend
- **Framework:** Next.js 14 (App Router)
- **UI:** Tailwind CSS + shadcn/ui
- **State:** Zustand, TanStack Query
- **Charts:** Recharts

### Backend
- **API:** FastAPI (Python) or NestJS (TypeScript)
- **Jobs:** Celery + Redis
- **Queue:** AWS SQS or Kafka
- **ORM:** SQLAlchemy or Prisma

### AI/ML
- **LLM:** Claude Sonnet 4 / GPT-4o
- **Embeddings:** text-embedding-3-large
- **Vector DB:** pgvector
- **Fairness:** Microsoft Fairlearn

### Infrastructure
- **Cloud:** AWS (EKS, RDS, S3)
- **Containers:** Docker + Kubernetes
- **CI/CD:** GitHub Actions + ArgoCD
- **Monitoring:** Datadog / OpenTelemetry

---

## Development Workflow

### 1. Epic Planning
- Review epic file for overview and acceptance criteria
- Understand dependencies and technical design
- Estimate effort and assign to sprint

### 2. Story Development
- Read story file for detailed requirements
- Review acceptance criteria and technical design
- Implement following the provided architecture
- Write tests per testing strategy
- Verify NFR/SLA requirements are met

### 3. Testing & Validation
- Unit tests for business logic
- Integration tests for API endpoints
- E2E tests for user workflows
- Performance tests for SLA validation
- Security tests for compliance

### 4. Documentation
- Update API documentation
- Document configuration changes
- Update deployment guides
- Record architectural decisions

---

## Priority Definitions

- **P0 (Critical):** Must have for MVP, blocks other features
- **P1 (Should Have):** Important for user experience, can be deferred
- **P2 (Nice to Have):** Enhancement, future phase

---

## SLA Summary by Epic

| Epic | Key SLAs |
|------|----------|
| Epic 01 | Criteria extraction ≤5s |
| Epic 02 | ≥100 resumes/min, ≥95% accuracy, bulk 500 in ≤10min |
| Epic 04 | Scoring ≤10s, batch 200 in 5min |
| Epic 05 | Shortlist generation ≤30s for 200 candidates |
| Epic 06 | Chat response ≤3s, 1K concurrent sessions |
| Epic 07 | Kit generation ≤15s |
| Epic 10 | Email delivery ≤5min, ≥99% success |
| Epic 11 | Dashboard load ≤2s, reports ≤30s |
| Epic 13 | Data deletion ≤30 days |
| Epic 14 | 99.9% uptime, MTTR ≤30min |

---

## Getting Started

### For Product Managers
1. Start with [EPIC_INDEX.md](EPIC_INDEX.md) for high-level overview
2. Review individual epic files for feature details
3. Use BRD coverage matrix to ensure completeness

### For Engineers
1. Review epic technical design sections
2. Read story files for implementation details
3. Follow provided code samples and architecture diagrams
4. Ensure all NFR/SLA requirements are met

### For QA
1. Use acceptance criteria for test case creation
2. Follow testing strategy in each story
3. Validate SLA requirements with performance tests
4. Track coverage against BRD requirements

---

## Questions or Issues?

- **Missing requirements?** Check BRD document and create new story
- **Technical questions?** Review technical design sections in epics
- **Priority conflicts?** Refer to critical path dependencies
- **SLA concerns?** Check NFR/Tech Notes in each story

---

**Maintained By:** Product & Engineering  
**Last Updated:** March 18, 2026
