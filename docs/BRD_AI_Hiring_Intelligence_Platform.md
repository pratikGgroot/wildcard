# Business Requirements Document (BRD)
## AI-Driven Hiring Intelligence Platform
### (Greenhouse-like ATS with Embedded AI Agents)

---

**Document Version:** 1.0  
**Status:** Draft  
**Prepared By:** Product & Engineering  
**Date:** March 18, 2026  
**Classification:** Internal — Confidential

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Business Context & Problem Statement](#2-business-context--problem-statement)
3. [Goals & Success Metrics](#3-goals--success-metrics)
4. [Stakeholders](#4-stakeholders)
5. [Scope](#5-scope)
6. [Functional Requirements](#6-functional-requirements)
   - 6.1 Job Description Management
   - 6.2 Resume Ingestion & Parsing
   - 6.3 Candidate Profile Management
   - 6.4 AI Candidate Scoring & Ranking
   - 6.5 AI Shortlisting & Recommendations
   - 6.6 Recruiter Conversational Assistant
   - 6.7 Interview Kit Generation
   - 6.8 Bias Detection & Explainability
   - 6.9 Pipeline & Workflow Management
   - 6.10 Notifications & Communication
   - 6.11 Reporting & Analytics Dashboard
7. [Non-Functional Requirements](#7-non-functional-requirements)
8. [AI / ML Requirements (Core)](#8-ai--ml-requirements-core)
   - 8.1 Resume Parsing & Skill Extraction
   - 8.2 Semantic Embeddings & Fit Scoring
   - 8.3 Candidate Summarization Agent
   - 8.4 Shortlisting & Ranking Agent
   - 8.5 Conversational Recruiter Assistant
   - 8.6 Interview Question Generator
   - 8.7 Bias Detection Module
   - 8.8 Explainability Layer (XAI)
9. [Data Requirements](#9-data-requirements)
10. [Integration Requirements](#10-integration-requirements)
11. [Security & Compliance Requirements](#11-security--compliance-requirements)
12. [UX / UI Requirements](#12-ux--ui-requirements)
13. [Good-to-Have (Future Phase) Requirements](#13-good-to-have-future-phase-requirements)
14. [System Architecture Overview](#14-system-architecture-overview)
15. [Tech Stack Recommendations](#15-tech-stack-recommendations)
16. [Risks & Mitigations](#16-risks--mitigations)
17. [Milestones & Delivery Phases](#17-milestones--delivery-phases)
18. [Glossary](#18-glossary)

---

## 1. Executive Summary

Modern Applicant Tracking Systems (ATS) such as Greenhouse, Lever, and Workday act primarily as **passive tracking databases**. They store candidate data but offer limited intelligence — leaving the cognitive burden of screening, ranking, and deciding on recruiters and hiring managers.

This document defines the requirements for an **AI-Driven Hiring Intelligence Platform** — a next-generation ATS that embeds AI agents directly into the hiring workflow. The platform will:

- Automatically parse resumes and extract structured candidate data
- Score and rank candidates against job requirements using semantic AI
- Generate shortlist recommendations with transparent reasoning
- Provide a conversational recruiter assistant for natural language queries
- Automatically generate interview kits tailored to each candidate
- Detect and flag potential bias in hiring recommendations

The **expected outcome** is a prototype ATS that measurably reduces recruiter time-to-shortlist, improves candidate-job match quality, and increases decision confidence through AI-augmented insights.

---

## 2. Business Context & Problem Statement

### 2.1 Market Context

The global ATS market is valued at over $2.5B and growing. Despite widespread adoption, recruiters consistently report:

- Spending **60–70% of their time** on manual resume screening
- High **false-negative rates** in screening (qualified candidates missed)
- **Inconsistent evaluation criteria** across recruiters for the same role
- Slow **time-to-hire** due to manual shortlisting bottlenecks
- **Bias** introduced by inconsistent human judgment at screening stages

### 2.2 Problem Statement

> *Build an AI-powered hiring platform that augments recruiter decision-making by automatically analyzing candidate data, ranking applicants, and streamlining the hiring workflow — transforming the ATS from a passive tracker into an active intelligent hiring assistant.*

### 2.3 Opportunity

By embedding AI agents at every stage of the hiring funnel, the platform can:

| Stage | Manual Today | AI-Augmented Future |
|---|---|---|
| Resume review | 6–10 min/resume | < 5 sec/resume |
| Shortlisting 200 applicants | 2–3 days | < 30 minutes |
| Writing interview questions | 30–60 min/candidate | Instant, personalized |
| Reporting pipeline health | Ad-hoc, manual | Real-time dashboards |

---

## 3. Goals & Success Metrics

### 3.1 Primary Goals

| Goal | Description |
|---|---|
| G1 — Reduce recruiter effort | Cut manual screening time by ≥ 60% |
| G2 — Improve candidate quality | Increase shortlist-to-offer conversion by ≥ 25% |
| G3 — Accelerate time-to-hire | Reduce average time-to-shortlist by ≥ 50% |
| G4 — Bias reduction | Reduce demographically correlated score variance by ≥ 30% |
| G5 — Recruiter satisfaction | Achieve NPS ≥ 40 among recruiter users |

### 3.2 Key Performance Indicators (KPIs)

- **Parsing accuracy:** ≥ 95% field extraction accuracy on structured and unstructured resumes
- **Ranking precision:** Top-5 AI shortlist matches recruiter final picks ≥ 70% of the time
- **Latency:** AI scoring pipeline completes within 10 seconds per resume
- **Chat response time:** Conversational assistant responds within 3 seconds
- **System uptime:** 99.9% availability SLA
- **Data privacy compliance:** 100% GDPR / DPDP Act (India) compliant

---

## 4. Stakeholders

| Stakeholder | Role | Interest |
|---|---|---|
| Recruiters | Primary users | Efficient screening, shortlisting, scheduling |
| Hiring Managers | Secondary users | Reviewing shortlists, giving feedback |
| HR Admins | Platform admins | Configuration, user management, reports |
| Candidates | Indirect users | Smooth application experience |
| Compliance Officer | Reviewer | Bias, fairness, legal compliance |
| Engineering Team | Builders | Technical feasibility, architecture |
| Product Team | Owners | Roadmap, prioritization |
| C-Suite / Business | Sponsors | ROI, competitive advantage |

---

## 5. Scope

### 5.1 In-Scope (Phase 1 — MVP)

- Job description upload and AI-based criteria extraction
- Resume ingestion (PDF, DOCX, LinkedIn import)
- Structured candidate profile creation via AI parsing
- Candidate-job fit scoring using semantic embeddings
- AI shortlist recommendations with reasoning
- Recruiter conversational assistant (chat interface)
- AI-generated interview question kits
- Bias detection and explainability layer
- Basic pipeline stage management (Applied → Screened → Interviewing → Offer → Hired/Rejected)
- Admin dashboard and reporting

### 5.2 Out-of-Scope (Phase 1)

- Video interview analysis
- Automated calendar scheduling (Phase 2)
- Offer letter generation (Phase 2)
- Third-party HRIS sync (SAP, Workday) — Phase 2
- Mobile native application — Phase 2

---

## 6. Functional Requirements

### 6.1 Job Description Management

| ID | Requirement | Priority |
|---|---|---|
| FR-JD-01 | Recruiter can create a job posting with free-text job description | Must Have |
| FR-JD-02 | System automatically extracts screening criteria from JD (skills, experience, qualifications) using AI | Must Have |
| FR-JD-03 | Recruiter can review and edit AI-extracted criteria before activating the job | Must Have |
| FR-JD-04 | Support for job templates to speed up repetitive role postings | Should Have |
| FR-JD-05 | AI suggests additional screening criteria based on similar historical job postings | Should Have |
| FR-JD-06 | Ability to weight criteria (e.g., "Python skills" = High, "AWS certification" = Medium) | Must Have |
| FR-JD-07 | Jobs can be assigned to specific recruiter(s) and hiring manager(s) | Must Have |
| FR-JD-08 | Job postings can be set as active, paused, or closed | Must Have |

### 6.2 Resume Ingestion & Parsing

| ID | Requirement | Priority |
|---|---|---|
| FR-RP-01 | Support bulk resume upload (ZIP, individual PDF/DOCX files) | Must Have |
| FR-RP-02 | Parse resumes using AI to extract: name, contact, education, work history, skills, certifications, projects | Must Have |
| FR-RP-03 | Handle unstructured / free-text resume formats with ≥ 95% field extraction accuracy | Must Have |
| FR-RP-04 | Support LinkedIn profile URL import as a resume source | Should Have |
| FR-RP-05 | Deduplicate candidates who apply to the same role multiple times | Must Have |
| FR-RP-06 | Flag parsing errors and allow manual correction | Must Have |
| FR-RP-07 | Extract implicit skills (e.g., infer "distributed systems" experience from listed job titles) | Should Have |
| FR-RP-08 | Normalize skill names (e.g., "React.js", "ReactJS", "React" → canonical form) | Must Have |

### 6.3 Candidate Profile Management

| ID | Requirement | Priority |
|---|---|---|
| FR-CP-01 | Create a structured candidate profile from parsed resume data | Must Have |
| FR-CP-02 | Recruiter can add notes, tags, and custom fields to profiles | Must Have |
| FR-CP-03 | Display candidate's AI fit score, summary, and skill match breakdown | Must Have |
| FR-CP-04 | Maintain full application history (which jobs applied to, stages reached) | Must Have |
| FR-CP-05 | Support attaching documents (cover letter, portfolio, certificates) | Should Have |
| FR-CP-06 | Candidate profiles are searchable and filterable across all active pipelines | Must Have |

### 6.4 AI Candidate Scoring & Ranking

| ID | Requirement | Priority |
|---|---|---|
| FR-SC-01 | Generate a fit score (0–100) for each candidate against a specific job | Must Have |
| FR-SC-02 | Score is derived from semantic similarity between candidate profile embedding and JD embedding | Must Have |
| FR-SC-03 | Score breakdown shows contribution of each criterion (skills, experience, education) | Must Have |
| FR-SC-04 | Scores are recalculated if the JD criteria are updated | Must Have |
| FR-SC-05 | Recruiter can override or adjust scores with justification | Should Have |
| FR-SC-06 | Support multi-dimensional scoring (technical fit, culture fit, growth potential) | Good to Have |

### 6.5 AI Shortlisting & Recommendations

| ID | Requirement | Priority |
|---|---|---|
| FR-SL-01 | AI recommends a shortlist of top N candidates (configurable) with reasoning | Must Have |
| FR-SL-02 | Reasoning is displayed in plain English (e.g., "Strong Python background, 4 years relevant experience, lacks AWS exposure") | Must Have |
| FR-SL-03 | Recruiter can accept, reject, or defer each shortlist recommendation | Must Have |
| FR-SL-04 | System learns from recruiter accept/reject feedback to improve future shortlists | Should Have |
| FR-SL-05 | Show "near miss" candidates who narrowly missed shortlist threshold | Should Have |

### 6.6 Recruiter Conversational Assistant

| ID | Requirement | Priority |
|---|---|---|
| FR-CA-01 | Provide a chat interface where recruiters can query the candidate pipeline in natural language | Must Have |
| FR-CA-02 | Support queries like "Show top backend engineers with Kubernetes experience" | Must Have |
| FR-CA-03 | Support queries like "Which candidates applied in the last 7 days for the ML Engineer role?" | Must Have |
| FR-CA-04 | Support comparative queries like "Compare the top 3 candidates for the Data Scientist role" | Should Have |
| FR-CA-05 | Assistant can trigger actions (e.g., "Move candidate X to interview stage") | Should Have |
| FR-CA-06 | Assistant maintains conversational context across multi-turn interactions | Must Have |
| FR-CA-07 | Responses include references/links to candidate profiles | Must Have |

### 6.7 Interview Kit Generation

| ID | Requirement | Priority |
|---|---|---|
| FR-IK-01 | Generate a tailored interview kit for each candidate based on their profile + JD | Must Have |
| FR-IK-02 | Kit includes: role-specific technical questions, behavioral questions, skill-gap probe questions | Must Have |
| FR-IK-03 | Questions are tagged by competency area and difficulty level | Should Have |
| FR-IK-04 | Provide a suggested scoring rubric for each question | Should Have |
| FR-IK-05 | Interviewer can edit / approve the kit before use | Must Have |
| FR-IK-06 | Kit is exportable as PDF or shareable via link | Should Have |
| FR-IK-07 | AI flags areas where candidate data is weak and suggests deeper probing questions | Should Have |

### 6.8 Bias Detection & Explainability

| ID | Requirement | Priority |
|---|---|---|
| FR-BD-01 | Analyze AI scores across demographic proxies (name patterns, gender-coded language, institutions) | Must Have |
| FR-BD-02 | Flag if a demographic proxy appears to significantly influence a score | Must Have |
| FR-BD-03 | Provide bias risk score per job pipeline | Must Have |
| FR-BD-04 | Mask or suppress known demographic proxy fields during scoring (name, photo, address) | Must Have |
| FR-BD-05 | Audit log of every AI decision with explainability data | Must Have |
| FR-BD-06 | Compliance report exportable for HR legal review | Should Have |

### 6.9 Pipeline & Workflow Management

| ID | Requirement | Priority |
|---|---|---|
| FR-PL-01 | Support configurable hiring stages per job role | Must Have |
| FR-PL-02 | Drag-and-drop kanban board for moving candidates across stages | Should Have |
| FR-PL-03 | Bulk actions: move, reject, email candidates | Must Have |
| FR-PL-04 | Stage-level automations (e.g., auto-send rejection email after 30 days in Applied stage) | Should Have |
| FR-PL-05 | Role-based access control (recruiter vs hiring manager vs admin views) | Must Have |

### 6.10 Notifications & Communication

| ID | Requirement | Priority |
|---|---|---|
| FR-NC-01 | Send automated email notifications to candidates on status changes | Must Have |
| FR-NC-02 | Recruiter receives in-app alerts for new applications and AI shortlist readiness | Must Have |
| FR-NC-03 | Email templates configurable per stage and per role | Should Have |
| FR-NC-04 | Integration with Gmail / Outlook for sending emails directly from the platform | Good to Have |

### 6.11 Reporting & Analytics Dashboard

| ID | Requirement | Priority |
|---|---|---|
| FR-DA-01 | Dashboard showing: open roles, total applicants, shortlisted, in-interview, offers made | Must Have |
| FR-DA-02 | Time-in-stage funnel chart per role | Must Have |
| FR-DA-03 | AI scoring distribution chart (spread of candidate scores per role) | Must Have |
| FR-DA-04 | Source-of-hire tracking (job boards, referrals, direct) | Should Have |
| FR-DA-05 | Bias analytics overview: demographic parity metrics per role | Must Have |
| FR-DA-06 | Recruiter activity report (actions taken per day/week) | Should Have |
| FR-DA-07 | Export reports as CSV / PDF | Must Have |

---

## 7. Non-Functional Requirements

### 7.1 Performance

| ID | Requirement | Target |
|---|---|---|
| NFR-P-01 | Resume parsing throughput | ≥ 100 resumes/minute (batch) |
| NFR-P-02 | AI scoring latency per candidate | ≤ 10 seconds end-to-end |
| NFR-P-03 | Chat assistant response latency | ≤ 3 seconds |
| NFR-P-04 | Dashboard page load time | ≤ 2 seconds (P95) |
| NFR-P-05 | Bulk upload (500 resumes) processing time | ≤ 10 minutes |

### 7.2 Scalability

- System must handle up to **1,000 concurrent users**
- Platform must support up to **10,000 active job postings** simultaneously
- Must scale to **1M+ candidate profiles** in the database
- Embedding store must support vector search at low latency with 10M+ vectors

### 7.3 Availability & Reliability

- **Uptime SLA:** 99.9% (< 8.7 hours downtime/year)
- Background AI pipelines must be resilient to partial failures with automatic retry
- Graceful degradation: if AI service fails, manual recruiter workflows remain functional

### 7.4 Security

- All data encrypted at rest (AES-256) and in transit (TLS 1.3)
- Role-Based Access Control (RBAC) enforced at API and UI layer
- OAuth 2.0 / SSO support (Google Workspace, Okta, Azure AD)
- Zero-trust architecture for internal service communication
- Regular penetration testing (quarterly)

### 7.5 Observability

- Full application logging (structured JSON logs)
- Distributed tracing for AI pipeline steps
- Real-time alerting on error spikes and latency regressions
- AI model performance monitoring (score distribution drift detection)

---

## 8. AI / ML Requirements (Core)

### 8.1 Resume Parsing & Skill Extraction

**Objective:** Convert unstructured resume documents into structured JSON candidate profiles.

**Approach:**
- Use a fine-tuned LLM (e.g., Claude / GPT-4o) with structured output (JSON schema enforcement) for entity extraction
- Alternatively, use a combination of: spaCy NER for initial extraction + LLM for refinement and inference
- Skills normalization using a curated ontology (e.g., ESCO skills taxonomy or a custom skill graph)

**Fields to extract:**

```
{
  "personal": { "name", "email", "phone", "location", "linkedin_url" },
  "education": [{ "institution", "degree", "field", "start_date", "end_date", "gpa" }],
  "experience": [{ "company", "title", "start_date", "end_date", "responsibilities[]", "inferred_skills[]" }],
  "skills": { "explicit": [], "inferred": [], "normalized": [] },
  "certifications": [{ "name", "issuer", "date" }],
  "projects": [{ "name", "description", "technologies[]" }],
  "total_years_experience": <int>,
  "highest_degree": <string>
}
```

**Model Requirements:**
- Must handle PDF (native text + scanned OCR), DOCX, and plain text formats
- OCR pipeline using Tesseract or AWS Textract for scanned PDFs
- Confidence scores per extracted field for quality control flagging

---

### 8.2 Semantic Embeddings & Fit Scoring

**Objective:** Produce a continuous fit score (0–100) that reflects how semantically well a candidate's profile matches a job description.

**Approach:**
- Embed candidate profiles and JD criteria using a high-quality text embedding model
  - **Recommended:** `text-embedding-3-large` (OpenAI) or `voyage-large-2` (Voyage AI) or `bge-large-en-v1.5` (open-source)
- Store embeddings in a **vector database** (Pinecone, Weaviate, or pgvector on PostgreSQL)
- Compute cosine similarity between candidate embedding and JD embedding as the base fit score
- Apply weighted scoring:

```
fit_score = Σ (weight_i × cosine_sim(candidate_skill_embedding_i, jd_criterion_embedding_i))
            normalized to [0, 100]
```

**Scoring Dimensions:**

| Dimension | Weight (default) | Description |
|---|---|---|
| Technical Skills Match | 40% | Overlap between required and candidate skills |
| Experience Relevance | 30% | Semantic match of job history to JD requirements |
| Education Fit | 15% | Degree level and field relevance |
| Project / Certification Bonus | 15% | Relevant side projects and certs |

- Weights are configurable per job role by the recruiter
- Score version-controlled: re-scoring triggered on model update or JD change

---

### 8.3 Candidate Summarization Agent

**Objective:** Generate a concise 3–5 sentence natural language summary of each candidate relative to the specific job they applied for.

**Approach:**
- LLM-based summarization with structured prompt:

```
Prompt Template:
"You are a senior recruiter assistant. Given the following candidate profile and job requirements, 
write a 3-5 sentence objective summary highlighting: 
(1) key strengths relevant to the role, 
(2) potential gaps or concerns, 
(3) overall recommendation (Strong Match / Moderate Match / Weak Match).
Candidate Profile: {profile_json}
Job Requirements: {jd_criteria_json}"
```

- Output cached per (candidate_id, job_id) pair and invalidated on profile/JD changes
- Summary displayed inline on candidate card in pipeline view

---

### 8.4 Shortlisting & Ranking Agent

**Objective:** Automatically recommend the top-N candidates for a role with transparent reasoning.

**Approach:**
- Rank candidates by composite fit score (from 8.2)
- Apply configurable threshold (default: top 15% of applicants or top 20 candidates)
- For each shortlisted candidate, generate a reasoning note using LLM:
  - Key strengths for this specific role
  - Identified gaps
  - Confidence level (High / Medium / Low)
- Near-miss candidates (just below threshold) flagged with explanation
- Feedback loop: recruiter accept/reject actions stored and used to fine-tune scoring weights via RLHF-lite approach (preference learning)

---

### 8.5 Conversational Recruiter Assistant

**Objective:** Enable recruiters to query and interact with candidate pipelines using natural language.

**Approach:**
- LLM with tool-calling capabilities (function calling / ReAct agent pattern)
- Available tools:
  - `search_candidates(query, job_id, filters)` — semantic search over candidate profiles
  - `filter_pipeline(stage, date_range, score_range)` — structured pipeline filtering
  - `compare_candidates(candidate_ids[])` — side-by-side comparison generation
  - `move_candidate(candidate_id, stage)` — pipeline action
  - `get_pipeline_summary(job_id)` — aggregate stats
- Conversation history maintained per session (last 20 turns in context)
- RAG (Retrieval-Augmented Generation) pattern: retrieve relevant candidate chunks before generating response
- Guardrails: assistant must not make final hiring decisions; always frames as recommendations

**Example Interactions:**

```
Recruiter: "Show me the top 5 backend engineers who know Kubernetes and have worked at startups"
Assistant: [Calls search_candidates] → Returns ranked list with profile snippets and scores

Recruiter: "Compare the top 2"
Assistant: [Calls compare_candidates] → Structured side-by-side comparison table

Recruiter: "Move the first one to interview stage"
Assistant: [Calls move_candidate] → Confirms action taken
```

---

### 8.6 Interview Question Generator

**Objective:** Generate personalized interview kits tailored to each candidate's profile and the job requirements.

**Approach:**
- Prompt engineering with LLM to generate:
  - **Technical questions** targeting the required skills (with difficulty level: Easy / Medium / Hard)
  - **Gap-probe questions** targeting identified weaknesses in the candidate's background
  - **Behavioral questions** (STAR-format) mapped to role competencies
  - **Culture/values alignment questions** (configurable per company)
- Suggested evaluation rubric per question (What to look for, Red flags, Green flags)
- Questions tagged with: competency, type, difficulty
- Output structured as JSON, rendered as editable form in UI

---

### 8.7 Bias Detection Module

**Objective:** Identify and flag when demographic proxies may be influencing AI scoring in a discriminatory way.

**Approach:**

**Step 1 — Proxy Detection:**
- Identify demographic proxies in profiles: name (gender/ethnicity inference), university prestige, address/zip code, graduation year (age proxy)
- Use a fairness library (e.g., Fairlearn, AIF360) to compute disparate impact ratio

**Step 2 — Score Audit:**
- Run counterfactual analysis: rescore profile with proxy fields masked/altered
- If score delta > threshold (e.g., ±10 points), flag as potentially biased

**Step 3 — Reporting:**
- Per-job bias risk score (Low / Medium / High)
- Flagged candidates highlighted in UI with explanation
- Demographic parity and equalized odds metrics in analytics dashboard

**Mitigation Options:**
- Auto-mask name, address, photo fields during initial screening (blind review mode)
- Recruiter configurable: opt-in to blind mode per job

---

### 8.8 Explainability Layer (XAI)

**Objective:** Every AI score or recommendation must be explainable to the recruiter in plain English.

**Requirements:**

| Explanation Type | Method |
|---|---|
| Fit score breakdown | Weighted feature attribution (SHAP-like for embedding scores) |
| Shortlist reasoning | LLM-generated rationale narrative |
| Bias flag explanation | Counterfactual delta explanation |
| Interview question rationale | LLM maps each question to specific profile gap or requirement |

- Full audit trail: every AI output logged with model version, input hash, and timestamp
- "Why this score?" button on every candidate card → opens explanation panel

---

## 9. Data Requirements

### 9.1 Core Data Entities

```
Job
├── id, title, department, location, type (full-time/contract)
├── description (raw text)
├── extracted_criteria[] (AI-generated + recruiter-edited)
├── criteria_weights{}
├── embedding_vector
├── status (active/paused/closed)
└── assigned_recruiters[], hiring_manager_id

Candidate
├── id, personal_info (masked for scoring)
├── raw_resume_text, resume_file_url
├── parsed_profile (structured JSON)
├── embedding_vector
├── applications[] → Application[]
└── created_at, source

Application
├── id, candidate_id, job_id
├── fit_score, score_breakdown{}
├── ai_summary, shortlist_status
├── pipeline_stage, stage_history[]
├── interview_kit_id
├── bias_flags[]
├── recruiter_notes[], tags[]
└── timestamps

InterviewKit
├── id, application_id
├── technical_questions[], behavioral_questions[], gap_questions[]
├── generated_at, approved_by, approved_at
└── export_url

BiasAuditLog
├── id, application_id, job_id
├── proxy_fields_detected[]
├── score_with_proxy, score_without_proxy, delta
├── risk_level, flagged_at
└── reviewed_by, resolution

ConversationSession
├── id, recruiter_id
├── messages[] { role, content, tool_calls[], timestamp }
└── session_start, last_active
```

### 9.2 Data Retention Policy

- Candidate data: retained for 2 years after last application activity (GDPR / DPDP compliant)
- Audit logs: retained for 5 years
- AI model outputs: versioned and retained for model lineage tracking
- Deleted candidates: soft-delete with 30-day recovery window

### 9.3 Data Privacy

- PII fields (name, email, phone, address) encrypted at field level in the database
- Candidate right-to-erasure (GDPR Article 17) supported via API
- Data residency: support for region-specific data storage (EU, India)

---

## 10. Integration Requirements

| Integration | Type | Priority |
|---|---|---|
| LinkedIn Import | OAuth + Profile API | Should Have |
| Gmail / Google Workspace | OAuth, email sending | Good to Have |
| Outlook / Microsoft 365 | OAuth, email sending | Good to Have |
| Calendar (Google/Outlook) | OAuth, availability + scheduling | Phase 2 |
| AWS S3 / GCS | File storage for resumes | Must Have |
| Slack | Recruiter notifications | Good to Have |
| Job Boards (Indeed, Naukri, LinkedIn Jobs) | Inbound application webhook | Should Have |
| Workday / SAP SuccessFactors | HRIS data sync | Phase 2 |
| DocuSign | Offer letter signing | Phase 2 |

---

## 11. Security & Compliance Requirements

### 11.1 Authentication & Authorization

- SSO via SAML 2.0 / OIDC (Okta, Google Workspace, Azure AD)
- MFA enforced for admin accounts
- JWT-based API authentication with short expiry (15 min access token)
- RBAC: Admin > Recruiter > Hiring Manager > Read-Only Viewer

### 11.2 Regulatory Compliance

| Regulation | Requirement |
|---|---|
| GDPR (EU) | Consent management, right to erasure, data portability, DPA |
| DPDP Act 2023 (India) | Data principal rights, consent, grievance redressal |
| EEOC (US, if applicable) | Non-discriminatory AI, adverse impact monitoring |
| SOC 2 Type II | Security, availability, confidentiality controls audit |
| ISO 27001 | Information security management (target certification) |

### 11.3 AI Ethics & Governance

- AI model version control and change management process
- Human-in-the-loop: all AI recommendations require explicit recruiter action before stage transitions
- No fully automated rejection without human review
- Regular bias audits (quarterly) by an independent reviewer
- Candidate transparency: optional disclosure that AI is used in screening (configurable per org)

---

## 12. UX / UI Requirements

### 12.1 Core Screens

| Screen | Description |
|---|---|
| Dashboard | Overview of all active roles, key metrics, recent activity |
| Job Board | List of all job postings with status and applicant counts |
| Job Detail + Pipeline | Kanban-style candidate pipeline for a specific job |
| Candidate Card | Detailed view: profile, fit score, AI summary, interview kit |
| AI Shortlist View | Dedicated view showing recommended shortlist with reasoning |
| Chat Assistant | Side-panel chat interface accessible from any screen |
| Analytics | Role-level and org-level reporting dashboards |
| Admin Panel | User management, RBAC, integrations, AI settings |

### 12.2 Design Principles

- **AI-first but human-led:** AI surfaces recommendations; humans make decisions
- **Transparency by default:** Scores always show breakdown; recommendations always show reasoning
- **Speed:** Keyboard shortcuts for power-user actions (accept/reject shortlist, move stage)
- **Mobile-responsive:** Works on tablet for hiring managers reviewing on the go
- **Accessible:** WCAG 2.1 AA compliance

---

## 13. Good-to-Have (Future Phase) Requirements

These are **not in scope for Phase 1** but are strategically important and should be architecturally planned for.

| Feature | Description | Phase |
|---|---|---|
| Video Interview Analysis | AI analysis of recorded video interviews for communication skills, confidence, verbal clarity | 3 |
| Automated Calendar Scheduling | AI schedules interviews based on interviewer + candidate availability | 2 |
| Candidate Self-Service Portal | Candidates can check status, complete assessments, upload documents | 2 |
| Skills Assessment Integration | Auto-send coding tests (HackerRank, Codility) and score integration | 2 |
| Offer Letter Generation | AI drafts offer letters based on role, candidate, and comp band | 2 |
| Predictive Attrition Scoring | Predict likelihood of candidate accepting offer and staying 12+ months | 3 |
| Multi-language Resume Support | Parse and score resumes in non-English languages | 2 |
| Culture Fit Scoring | AI scores alignment to company values using culture survey + profile | 3 |
| Diversity Hiring Goals Tracker | Set D&I hiring targets per role and track AI-assisted pipeline health | 2 |
| Browser Extension | Import LinkedIn profiles directly from browser | 2 |
| API Platform | Public API for customers to build custom integrations | 3 |
| Talent Pool / CRM | Maintain and nurture a pool of past candidates for future roles | 3 |

---

## 14. System Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                        Frontend (React / Next.js)            │
│  Dashboard | Pipeline | Chat | Analytics | Admin             │
└────────────────────────┬─────────────────────────────────────┘
                         │ REST / GraphQL / WebSocket
┌────────────────────────▼─────────────────────────────────────┐
│                     API Gateway (Kong / AWS API GW)          │
│              Auth (JWT/SSO), Rate Limiting, Routing          │
└──┬─────────────┬──────────────┬──────────┬───────────────────┘
   │             │              │          │
┌──▼───┐  ┌─────▼────┐  ┌──────▼──┐  ┌───▼────────┐
│ Job  │  │ Candidate│  │  AI     │  │  Chat      │
│ Svc  │  │   Svc    │  │ Pipeline│  │  Agent Svc │
└──┬───┘  └─────┬────┘  └──────┬──┘  └───┬────────┘
   │             │              │          │
┌──▼─────────────▼──────────────▼──────────▼────────┐
│              Message Queue (AWS SQS / Kafka)       │
│    Resume Parsing Jobs | Scoring Jobs | Events     │
└──┬────────────┬──────────────┬─────────────────────┘
   │            │              │
┌──▼──┐  ┌──────▼──────┐  ┌───▼────────────────────┐
│ LLM │  │  Embedding  │  │  Bias Detection        │
│Agent│  │  Model Svc  │  │  & XAI Svc             │
│(API)│  │(text-emb-3) │  │  (Fairlearn / AIF360)  │
└──┬──┘  └──────┬──────┘  └───────────────────────┘
   │             │
┌──▼─────────────▼───────────────────────────────────┐
│              Data Layer                             │
│  PostgreSQL (relational) + pgvector (embeddings)   │
│  Redis (cache, sessions)                           │
│  S3 / GCS (resume files, exports)                  │
│  OpenSearch / Elasticsearch (full-text search)     │
└────────────────────────────────────────────────────┘
```

---

## 15. Tech Stack Recommendations

### 15.1 Frontend

| Component | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| UI Library | Tailwind CSS + shadcn/ui |
| State Management | Zustand / TanStack Query |
| Charts | Recharts / Nivo |
| Chat UI | Custom with WebSocket |

### 15.2 Backend

| Component | Technology |
|---|---|
| API Framework | FastAPI (Python) or NestJS (TypeScript) |
| Background Jobs | Celery + Redis (Python) or BullMQ (Node) |
| Message Queue | AWS SQS or Apache Kafka |
| ORM | SQLAlchemy (Python) or Prisma (Node) |

### 15.3 AI / ML

| Component | Technology |
|---|---|
| LLM Provider | Anthropic Claude API (claude-sonnet-4) / OpenAI GPT-4o |
| Embeddings | OpenAI text-embedding-3-large or Voyage AI voyage-large-2 |
| Vector DB | pgvector (PostgreSQL extension) or Pinecone |
| Resume OCR | AWS Textract or Google Document AI |
| NLP/NER | spaCy (en_core_web_trf) for entity extraction |
| Bias/Fairness | Microsoft Fairlearn, IBM AIF360 |
| LLM Orchestration | LangChain or LlamaIndex |
| Agent Framework | LangGraph (multi-tool ReAct agent) |

### 15.4 Infrastructure

| Component | Technology |
|---|---|
| Cloud | AWS (primary) or GCP |
| Containers | Docker + Kubernetes (EKS/GKE) |
| CI/CD | GitHub Actions + ArgoCD |
| Observability | Datadog / OpenTelemetry + Grafana |
| Secret Management | AWS Secrets Manager / HashiCorp Vault |
| CDN | CloudFront |

---

## 16. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Resume parsing accuracy below 95% for non-standard formats | Medium | High | Multi-model fallback; human-review flag for low-confidence extractions |
| LLM hallucination in candidate summaries | Medium | High | Constrained prompts with grounding; recruiter verification step |
| Embedding model bias embedded in scores | High | High | Bias detection module + regular fairness audits; diverse test sets |
| AI assistant performing harmful actions (deleting candidates) | Low | Critical | Tool-level guardrails; write actions require confirmation; audit log |
| GDPR/DPDP non-compliance on candidate data | Low | Critical | DPO review pre-launch; automated consent tracking; legal sign-off |
| Vendor LLM API rate limits causing pipeline delays | Medium | Medium | Queue + retry architecture; multiple LLM provider fallback |
| Recruiters over-relying on AI, reducing critical judgment | Medium | Medium | UX design emphasizes AI-as-assistant; training program for users |
| Model drift over time reducing score quality | Low | Medium | Scheduled model evaluation jobs; score distribution monitoring |

---

## 17. Milestones & Delivery Phases

### Phase 1 — Foundation 

- [ ] Core ATS: job postings, candidate profiles, pipeline stages
- [ ] Resume ingestion + AI parsing pipeline (PDF/DOCX)
- [ ] Structured candidate profiles
- [ ] Admin dashboard and RBAC
- [ ] Basic email notifications

### Phase 2 — AI Core

- [ ] Semantic embedding pipeline + fit scoring
- [ ] AI shortlisting with reasoning
- [ ] Candidate summary generation
- [ ] Bias detection module (MVP)
- [ ] Explainability panel ("Why this score?")

### Phase 3 — Intelligence Layer

- [ ] Recruiter conversational assistant (chat)
- [ ] Interview kit generation
- [ ] Advanced analytics dashboard
- [ ] Feedback loop (recruiter signals → score refinement)
- [ ] Full bias audit reports and compliance exports

### Phase 4 — Scale & Integrations

- [ ] LinkedIn import
- [ ] Job board integrations
- [ ] Calendar scheduling
- [ ] Performance optimization for 1M+ profiles
- [ ] SOC 2 Type II audit preparation
- [ ] Mobile-responsive polish

---

## 18. Glossary

| Term | Definition |
|---|---|
| ATS | Applicant Tracking System — software for managing recruitment pipelines |
| Fit Score | AI-generated 0–100 score representing how well a candidate matches a job |
| Embedding | A numerical vector representation of text in high-dimensional semantic space |
| Cosine Similarity | Measure of angular similarity between two embedding vectors (0 to 1) |
| RAG | Retrieval-Augmented Generation — technique of retrieving context before generating LLM response |
| ReAct | Reasoning + Acting — LLM agent pattern combining thought steps with tool calls |
| SHAP | SHapley Additive exPlanations — method for explaining ML model feature contributions |
| XAI | Explainable AI — subset of AI focused on making model decisions interpretable |
| RLHF | Reinforcement Learning from Human Feedback — fine-tuning using human preference signals |
| PII | Personally Identifiable Information |
| RBAC | Role-Based Access Control |
| EEOC | U.S. Equal Employment Opportunity Commission |
| DPDP | Digital Personal Data Protection Act (India, 2023) |
| NER | Named Entity Recognition — NLP task to extract entities (names, orgs, dates) from text |

---

*End of Document*

---
**Document Owner:** Product Management  
**Next Review Date:** April 18, 2026  
**Approval Required From:** Head of Product, CTO, Chief Compliance Officer
