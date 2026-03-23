# AI-Driven Hiring Intelligence Platform - Epic Index

## Document Overview
This index provides a complete map of all epics and stories for the AI-Driven Hiring Intelligence Platform. Each epic represents a major feature area with detailed user stories, acceptance criteria, technical design, and NFR notes.

**Source Document:** `docs/BRD_AI_Hiring_Intelligence_Platform.md`  
**Total Epics:** 16  
**Estimated Total Effort:** 254-312 story points (34-44 sprints)

---

## Epic Summary

| Epic ID | Epic Name | Priority | Effort | Status |
|---------|-----------|----------|--------|--------|
| Epic 01 | Job Description Management | CRITICAL | 16-20 SP | Not Started |
| Epic 02 | Resume Ingestion & Parsing | CRITICAL | 21-25 SP | Not Started |
| Epic 03 | Candidate Profile Management | CRITICAL | 15-18 SP | Not Started |
| Epic 04 | AI Candidate Scoring & Ranking | CRITICAL | 18-21 SP | Not Started |
| Epic 05 | AI Shortlisting & Recommendations | CRITICAL | 13-16 SP | Not Started |
| Epic 06 | Recruiter Conversational Assistant | HIGH | 21-26 SP | Not Started |
| Epic 07 | Interview Kit Generation | HIGH | 18-21 SP | Not Started |
| Epic 08 | Bias Detection & Explainability | CRITICAL | 21-26 SP | Not Started |
| Epic 09 | Pipeline & Workflow Management | CRITICAL | 18-21 SP | Not Started |
| Epic 10 | Notifications & Communication | HIGH | 15-18 SP | Not Started |
| Epic 11 | Reporting & Analytics Dashboard | HIGH | 18-21 SP | Not Started |
| Epic 12 | Authentication & Authorization | CRITICAL | 21-26 SP | Not Started |
| Epic 13 | Data Privacy & Compliance | CRITICAL | 21-26 SP | Not Started |
| Epic 14 | System Infrastructure & DevOps | CRITICAL | 26-32 SP | Not Started |
| Epic 15 | External Integrations | HIGH | 18-22 SP | Not Started |
| Epic 16 | Admin Panel & Platform Configuration | CRITICAL | 16-20 SP | Not Started |

---

## Phase 1: Foundation (Sprints 1-8)

### Epic 01: Job Description Management
**Goal:** Enable job posting creation with AI-powered criteria extraction

**Stories:**
- 01.1: Create Job Posting (3 SP) - P0
- 01.2: AI Criteria Extraction (5 SP) - P0
- 01.3: Review and Edit Criteria (3 SP) - P0
- 01.4: Configure Criteria Weights (2 SP) - P0
- 01.5: Job Assignment and Status (3 SP) - P0
- 01.6: Job Templates (3 SP) - P1
- 01.7: AI Criteria Suggestions (5 SP) - P1

**Key NFRs:**
- Criteria extraction: ≤5 seconds
- Support 10,000 active jobs

### Epic 02: Resume Ingestion & Parsing
**Goal:** Automated resume parsing with ≥95% accuracy

**Stories:**
- 02.1: Resume Upload Interface (3 SP) - P0
- 02.2: Text Extraction from PDF/DOCX (5 SP) - P0
- 02.3: OCR for Scanned PDFs (5 SP) - P0
- 02.4: LLM-based Entity Extraction (8 SP) - P0
- 02.5: Skill Normalization (5 SP) - P0
- 02.6: Duplicate Detection (5 SP) - P0
- 02.7: Parsing Error Handling (3 SP) - P0
- 02.8: LinkedIn Profile Import (5 SP) - P1

**Key NFRs:**
- Parsing throughput: ≥100 resumes/minute
- Accuracy: ≥95% field extraction
- Bulk upload: 500 resumes in ≤10 minutes

### Epic 12: Authentication & Authorization
**Goal:** Secure access with SSO and RBAC

**Stories:**
- 12.1: Email/Password Authentication (3 SP) - P0
- 12.2: SSO Integration (5 SP) - P0
- 12.3: MFA Implementation (3 SP) - P0
- 12.4: JWT Token Management (3 SP) - P0
- 12.5: RBAC Middleware (5 SP) - P0
- 12.6: Permission Checking (3 SP) - P0
- 12.7: Session Management (3 SP) - P0
- 12.8: Audit Logging (3 SP) - P0

**Key NFRs:**
- Login response: ≤2 seconds
- Uptime: 99.99%

### Epic 14: System Infrastructure
**Goal:** Production-ready infrastructure

**Stories:**
- 14.1: Docker Containerization (3 SP) - P0
- 14.2: Kubernetes Deployment (5 SP) - P0
- 14.3: CI/CD Pipeline (5 SP) - P0
- 14.4: Monitoring & Alerting (5 SP) - P0
- 14.5: Logging Infrastructure (3 SP) - P0
- 14.6: Distributed Tracing (3 SP) - P0
- 14.7: Secrets Management (2 SP) - P0
- 14.8: Backup & DR (5 SP) - P0

**Key NFRs:**
- System uptime: 99.9%
- MTTR: ≤30 minutes

---

## Phase 2: AI Core (Sprints 9-16)

### Epic 03: Candidate Profile Management
**Goal:** Comprehensive candidate data management

**Stories:**
- 03.1: Candidate Profile View (3 SP) - P0
- 03.2: Add Notes and Tags (3 SP) - P0
- 03.3: Display AI Insights (3 SP) - P0
- 03.4: Application History (2 SP) - P0
- 03.5: Candidate Search and Filter (5 SP) - P0
- 03.6: Attach Documents (3 SP) - P1

**Key NFRs:**
- Profile load: ≤2 seconds
- Search response: ≤1 second
- Support 1M+ profiles

### Epic 04: AI Candidate Scoring & Ranking
**Goal:** Semantic embedding-based candidate scoring

**Stories:**
- 04.1: Embedding Generation Service (5 SP) - P0
- 04.2: Fit Score Calculation (5 SP) - P0
- 04.3: Score Breakdown Display (3 SP) - P0
- 04.4: Score Recalculation on JD Changes (3 SP) - P0
- 04.5: Manual Score Override (2 SP) - P1
- 04.6: Multi-dimensional Scoring (5 SP) - P2

**Key NFRs:**
- Scoring latency: ≤10 seconds per candidate
- Top-5 accuracy: ≥70%
- Batch scoring: 200 candidates in 5 minutes

### Epic 05: AI Shortlisting & Recommendations
**Goal:** Automated shortlist generation with reasoning

**Stories:**
- 05.1: Generate Shortlist Recommendations (5 SP) - P0
- 05.2: LLM-based Reasoning Generation (5 SP) - P0
- 05.3: Accept/Reject/Defer Actions (2 SP) - P0
- 05.4: Feedback Loop & Learning (5 SP) - P1
- 05.5: Near Miss Candidates Display (3 SP) - P1

**Key NFRs:**
- Generation time: ≤30 seconds for 200 candidates
- Accuracy: Top-5 match ≥70%

### Epic 08: Bias Detection & Explainability
**Goal:** Fair AI with transparent decision-making

**Stories:**
- 08.1: Demographic Proxy Detection (5 SP) - P0
- 08.2: Counterfactual Score Analysis (5 SP) - P0
- 08.3: Bias Flagging System (3 SP) - P0
- 08.4: Field Masking During Scoring (3 SP) - P0
- 08.5: Audit Log Generation (3 SP) - P0
- 08.6: Fairness Metrics Dashboard (5 SP) - P0
- 08.7: Compliance Report Export (3 SP) - P1
- 08.8: Explainability Panel (5 SP) - P0

**Key NFRs:**
- 100% of AI decisions logged
- Bias detection accuracy: ≥85%
- Audit retention: 5 years

---

## Phase 3: Intelligence Layer (Sprints 17-24)

### Epic 06: Recruiter Conversational Assistant
**Goal:** Natural language interface for pipeline queries

**Stories:**
- 06.1: Chat Interface UI (3 SP) - P0
- 06.2: Intent Classification & Tool Routing (5 SP) - P0
- 06.3: Semantic Candidate Search Tool (5 SP) - P0
- 06.4: Pipeline Filter Tool (3 SP) - P0
- 06.5: Candidate Comparison Tool (5 SP) - P0
- 06.6: Action Execution Tool (3 SP) - P1
- 06.7: Conversation Context Management (3 SP) - P0
- 06.8: Response Generation with Links (3 SP) - P0

**Key NFRs:**
- Response latency: ≤3 seconds
- Query success rate: ≥90%
- Concurrent sessions: 1,000

### Epic 07: Interview Kit Generation
**Goal:** Personalized interview questions and rubrics

**Stories:**
- 07.1: Skill Gap Analysis (3 SP) - P0
- 07.2: Technical Question Generation (5 SP) - P0
- 07.3: Behavioral Question Generation (3 SP) - P0
- 07.4: Gap-Probe Question Generation (3 SP) - P0
- 07.5: Scoring Rubric Generation (3 SP) - P1
- 07.6: Kit Review and Edit Interface (3 SP) - P0
- 07.7: PDF Export and Sharing (3 SP) - P1

**Key NFRs:**
- Generation time: ≤15 seconds
- Question relevance: ≥90%

### Epic 09: Pipeline & Workflow Management
**Goal:** Configurable hiring workflows

**Stories:**
- 09.1: Configure Pipeline Stages (3 SP) - P0
- 09.2: Kanban Board View (5 SP) - P0
- 09.3: Drag-and-Drop Stage Movement (3 SP) - P1
- 09.4: Bulk Actions Interface (5 SP) - P0
- 09.5: Stage Automations (5 SP) - P1
- 09.6: RBAC Implementation (3 SP) - P0
- 09.7: Stage Transition Audit Log (2 SP) - P0

**Key NFRs:**
- Pipeline load: ≤2 seconds
- Real-time updates via WebSocket

### Epic 10: Notifications & Communication
**Goal:** Automated candidate and recruiter notifications

**Stories:**
- 10.1: Email Template Management (3 SP) - P0
- 10.2: Candidate Status Change Emails (3 SP) - P0
- 10.3: Recruiter In-App Notifications (3 SP) - P0
- 10.4: Email Queue and Delivery (5 SP) - P0
- 10.5: Gmail/Outlook Integration (5 SP) - P2
- 10.6: Notification Preferences (2 SP) - P1
- 10.7: Unsubscribe Management (2 SP) - P0

**Key NFRs:**
- Email delivery: ≤5 minutes
- Delivery success: ≥99%
- In-app notification: ≤1 second

---

## Phase 4: Analytics & Compliance (Sprints 25-32)

### Epic 11: Reporting & Analytics Dashboard
**Goal:** Data-driven hiring insights

**Stories:**
- 11.1: Overview Dashboard (5 SP) - P0
- 11.2: Time-in-Stage Funnel Chart (3 SP) - P0
- 11.3: AI Scoring Distribution Chart (3 SP) - P0
- 11.4: Source-of-Hire Tracking (3 SP) - P1
- 11.5: Bias Analytics Dashboard (5 SP) - P0
- 11.6: Recruiter Activity Report (3 SP) - P1
- 11.7: CSV/PDF Export (3 SP) - P0

**Key NFRs:**
- Dashboard load: ≤2 seconds
- Report generation: ≤30 seconds
- Data freshness: 5-minute updates

### Epic 13: Data Privacy & Compliance
**Goal:** GDPR, DPDP, EEOC compliance

**Stories:**
- 13.1: PII Field-Level Encryption (5 SP) - P0
- 13.2: Consent Management (3 SP) - P0
- 13.3: Right to Erasure (5 SP) - P0
- 13.4: Data Portability (3 SP) - P0
- 13.5: Retention Policy Enforcement (3 SP) - P0
- 13.6: Data Residency Configuration (3 SP) - P0
- 13.7: Compliance Audit Reports (3 SP) - P0
- 13.8: Candidate Data Request Portal (3 SP) - P1

**Key NFRs:**
- 100% PII encrypted
- Data deletion: ≤30 days
- Zero compliance violations

---

## Phase 5: Integrations & Administration (Sprints 33-44)

### Epic 15: External Integrations
**Goal:** Seamless data flow with LinkedIn, job boards, file storage, and communication tools

**Stories:**
- 15.1: AWS S3 / GCS File Storage (3 SP) - P0
- 15.2: LinkedIn Profile Import (8 SP) - P1
- 15.3: Job Board Webhook Ingestion (8 SP) - P1
- 15.4: Slack Notifications Integration (5 SP) - P3
- 15.5: Gmail / Google Workspace Integration (5 SP) - P3
- 15.6: Outlook / Microsoft 365 Integration (5 SP) - P3

**Key NFRs:**
- S3/GCS upload: ≤5 seconds for files ≤10MB
- Webhook processing: ≤30 seconds end-to-end
- LinkedIn profile import: ≤10 seconds per profile
- Slack notification delivery: ≤5 seconds

### Epic 16: Admin Panel & Platform Configuration
**Goal:** Self-service platform administration with AI governance controls

**Stories:**
- 16.1: User Management (5 SP) - P0
- 16.2: RBAC Configuration (5 SP) - P0
- 16.3: Integration Settings Management (3 SP) - P0
- 16.4: AI Model Settings (5 SP) - P0
- 16.5: AI Ethics & Governance Configuration (5 SP) - P0
- 16.6: Organization Settings (3 SP) - P0
- 16.7: Admin Audit Log (3 SP) - P0

**Key NFRs:**
- Admin page load: ≤2 seconds (P95)
- User provisioning: active within 30 seconds of creation
- AI settings change propagation: ≤60 seconds across all services
- 100% of admin actions logged

---

## BRD Requirements Coverage Matrix

### Functional Requirements Coverage

| BRD Section | Epic(s) | Stories | Coverage |
|-------------|---------|---------|----------|
| 6.1 Job Description Management | Epic 01 | 7 stories | 100% |
| 6.2 Resume Ingestion & Parsing | Epic 02 | 8 stories | 100% |
| 6.3 Candidate Profile Management | Epic 03 | 6 stories | 100% |
| 6.4 AI Candidate Scoring & Ranking | Epic 04 | 6 stories | 100% |
| 6.5 AI Shortlisting & Recommendations | Epic 05 | 5 stories | 100% |
| 6.6 Recruiter Conversational Assistant | Epic 06 | 8 stories | 100% |
| 6.7 Interview Kit Generation | Epic 07 | 7 stories | 100% |
| 6.8 Bias Detection & Explainability | Epic 08 | 8 stories | 100% |
| 6.9 Pipeline & Workflow Management | Epic 09 | 7 stories | 100% |
| 6.10 Notifications & Communication | Epic 10 | 7 stories | 100% |
| 6.11 Reporting & Analytics Dashboard | Epic 11 | 7 stories | 100% |
| 10: External Integrations (S3, LinkedIn, Job Boards, Slack, Gmail, Outlook) | Epic 15 | 6 stories | 100% |
| 11.1 RBAC Configuration | Epic 16 | 2 stories | 100% |
| 11.3 AI Ethics & Governance | Epic 16 | 1 story | 100% |
| 12.1 Admin Panel (User Mgmt, AI Settings, Org Settings) | Epic 16 | 7 stories | 100% |

### Non-Functional Requirements Coverage

| NFR Category | Epic(s) | Key SLAs |
|--------------|---------|----------|
| Performance | All epics | Dashboard: ≤2s, Scoring: ≤10s, Chat: ≤3s |
| Scalability | Epic 14 | 1K users, 10K jobs, 1M+ candidates |
| Availability | Epic 14 | 99.9% uptime |
| Security | Epic 12, 13 | AES-256, TLS 1.3, RBAC, MFA |
| Compliance | Epic 13 | GDPR, DPDP, EEOC, SOC 2 |
| Observability | Epic 14 | Logging, tracing, monitoring |
| External Integrations | Epic 15 | S3 99.99%, webhooks ≤30s, LinkedIn ≤10s |
| AI Governance | Epic 16 | Human-in-the-loop, bias audit, model versioning |
| Administration | Epic 16 | Admin audit log, RBAC config, org settings |

---

## Critical Path Dependencies

```
Epic 12 (Auth) ──┐
                 ├──▶ Epic 01 (Jobs) ──▶ Epic 04 (Scoring) ──▶ Epic 05 (Shortlist)
Epic 14 (Infra) ─┘                              ▲
                                                 │
                    Epic 02 (Parsing) ──▶ Epic 03 (Profiles) ──┘
                                                 │
                                                 ├──▶ Epic 06 (Chat)
                                                 ├──▶ Epic 07 (Interview Kits)
                                                 └──▶ Epic 08 (Bias Detection)

Epic 09 (Pipeline) ──▶ Epic 10 (Notifications)
Epic 11 (Analytics) ──▶ (Depends on all data-generating epics)
Epic 13 (Compliance) ──▶ (Cross-cutting, integrates with all epics)

Epic 12 (Auth) ──▶ Epic 15 (Integrations) ──▶ Epic 02 (file storage for parsing)
                                           └──▶ Epic 10 (email integrations)
Epic 12 (Auth) ──▶ Epic 16 (Admin Panel)
Epic 13 (Compliance) ──▶ Epic 16 (Admin Panel — data residency, governance)
Epic 15 (Integrations) ──▶ Epic 16 (Admin Panel — integration settings)
```

---

## Key Success Metrics by Epic

### Epic 01: Job Description Management
- ✓ 95% of JDs have AI criteria approved with minimal edits
- ✓ Time to create job: 30 min → 10 min

### Epic 02: Resume Ingestion & Parsing
- ✓ Parsing accuracy ≥95%
- ✓ Throughput ≥100 resumes/minute
- ✓ Error rate <5%

### Epic 04: AI Scoring & Ranking
- ✓ Scoring latency ≤10 seconds
- ✓ Top-5 accuracy ≥70%

### Epic 05: AI Shortlisting
- ✓ Time-to-shortlist: 2-3 days → 30 minutes
- ✓ Shortlist-to-offer conversion +25%

### Epic 06: Conversational Assistant
- ✓ Response time ≤3 seconds
- ✓ Query success rate ≥90%
- ✓ 80% weekly active usage

### Epic 08: Bias Detection
- ✓ Demographic score variance reduced by 30%
- ✓ 100% AI decisions logged
- ✓ Zero compliance violations

### Epic 11: Analytics
- ✓ Dashboard load ≤2 seconds
- ✓ 90% weekly dashboard usage

### Epic 15: External Integrations
- ✓ S3 upload success rate ≥99.9%
- ✓ LinkedIn import success rate ≥95%
- ✓ Job board webhook processing ≤30 seconds
- ✓ Zero OAuth token leaks

### Epic 16: Admin Panel & Platform Configuration
- ✓ Admin page load ≤2 seconds
- ✓ 100% of admin actions logged
- ✓ AI governance settings propagate within 60 seconds
- ✓ Zero unauthorized admin access incidents

---

## Technology Stack Summary

### Frontend
- Next.js 14, Tailwind CSS, shadcn/ui
- Zustand, TanStack Query
- Recharts for visualizations

### Backend
- FastAPI (Python) or NestJS (TypeScript)
- Celery + Redis for background jobs
- PostgreSQL + pgvector

### AI/ML
- LLM: Claude Sonnet 4 / GPT-4o
- Embeddings: text-embedding-3-large
- Vector DB: pgvector
- Fairness: Microsoft Fairlearn

### Infrastructure
- AWS (EKS, RDS, S3, SQS)
- Docker + Kubernetes
- GitHub Actions + ArgoCD
- Datadog / OpenTelemetry

---

## Risk Summary

| Risk | Mitigation | Epic |
|------|------------|------|
| Parsing accuracy <95% | Multi-model fallback, human review | Epic 02 |
| LLM hallucination | Constrained prompts, verification | Epic 05, 06, 07 |
| Embedding bias | Bias detection, fairness audits | Epic 08 |
| GDPR non-compliance | DPO review, automated tracking | Epic 13 |
| System downtime | HA architecture, auto-scaling | Epic 14 |

---

## Next Steps

1. **Prioritize Phase 1 epics** for MVP (Foundation)
2. **Set up infrastructure** (Epic 14) in parallel with feature development
3. **Implement authentication** (Epic 12) as first feature epic
4. **Build core ATS features** (Epic 01, 02, 03) 
5. **Add AI intelligence** (Epic 04, 05, 08)
6. **Build integrations and admin panel** (Epic 15, 16)
7. **Iterate based on user feedback**

---

**Document Maintained By:** Product & Engineering  
**Last Updated:** March 18, 2026  
**Next Review:** Weekly during active development
