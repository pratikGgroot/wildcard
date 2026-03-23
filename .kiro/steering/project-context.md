# AI-Driven Hiring Intelligence Platform — Project Context

## What This Project Is
An AI-powered hiring platform (ATS) that automates resume screening, candidate scoring, and shortlisting using LLMs and semantic embeddings. Built with FastAPI (Python) backend and Next.js frontend.

## Tech Stack
- **Backend**: FastAPI + Python 3.12, SQLAlchemy (async), Alembic, Celery + Redis
- **Frontend**: Next.js 14, TanStack Query, Tailwind CSS
- **Database**: PostgreSQL + pgvector (for embeddings)
- **File Storage**: MinIO (S3-compatible)
- **LLM**: Ollama (local) — llama3.2 for text, nomic-embed-text for embeddings
- **Infrastructure**: Docker Compose (local dev)

## Project Structure
```
apps/api/          — FastAPI backend
  app/api/v1/      — Route handlers
  app/models/      — SQLAlchemy ORM models
  app/schemas/     — Pydantic schemas
  app/services/    — Business logic
  app/tasks/       — Celery background tasks
  alembic/versions/— DB migrations

apps/web/          — Next.js frontend
  src/app/         — Pages (App Router)
  src/components/  — UI components
  src/lib/api.ts   — API client (all fetch calls)
```

---

## What Is Already Built — DO NOT RE-IMPLEMENT

### Job Management
- Create/edit/delete job postings with title, description, department, location, type, status
- AI criteria extraction from job description (LLM-powered, via `criteria_service.py`)
- Review, edit, add, delete criteria with weights
- Job templates (save/load)
- AI criteria suggestions
- Job state machine: draft → active → closed → archived
- Files: `app/api/v1/jobs.py`, `app/services/job_service.py`, `app/services/criteria_service.py`, `app/services/template_service.py`

### Resume Ingestion & Parsing
- Public careers page + job detail page with apply form
- Presigned URL upload to MinIO (direct browser → S3)
- Celery background task: text extraction (PDF/DOCX), OCR fallback (Tesseract), LLM entity extraction
- Skill normalization, duplicate detection, parsing error handling
- Files: `app/api/v1/resumes.py`, `app/services/resume_service.py`, `app/tasks/resume_tasks.py`, `app/services/text_extraction_service.py`, `app/services/ocr_service.py`, `app/services/skill_normalizer.py`, `app/services/duplicate_service.py`

### Candidate Profiles
- Candidate profile view with parsed data, AI insights, skills, experience, education
- Notes and tags
- Attached documents
- Files: `app/api/v1/candidates.py`, `app/models/candidate.py`

### AI Scoring & Ranking
- Embedding generation for candidates and jobs (nomic-embed-text via Ollama)
- Fit score calculation (cosine similarity + multi-dimensional: skills, experience, education)
- Score breakdown display
- Score recalculation on job description changes
- Manual score override
- Files: `app/services/fit_score_service.py`, `app/services/embedding_service.py`, `app/tasks/score_tasks.py`

### Infrastructure
- Full Docker Compose setup: postgres, redis, minio, mailpit, api, web, worker
- Alembic migrations (0001–0015)
- Celery worker for background jobs

---

## DB Models (Key Tables)
- `jobs` — job postings
- `job_criteria` — extracted criteria per job
- `job_templates` — reusable job templates
- `resume_uploads` — upload records with status tracking
- `candidates` — parsed candidate profiles
- `candidate_documents` — attached files
- `candidate_notes` — notes and tags
- `candidate_job_embeddings` — vector embeddings
- `fit_scores` — calculated scores per candidate+job
- `parsing_errors` — error queue for failed parses

## API Base URL
All API routes are prefixed: `/api/v1/`

## Key Conventions
- All DB sessions are async (`AsyncSession`) in API routes
- Celery tasks use sync `SyncSessionLocal` (not async)
- Presigned URLs use `S3_PUBLIC_URL` (browser-accessible), internal ops use `S3_ENDPOINT_URL`
- LLM calls go through `app/services/llm_service.py` — do not call Ollama directly
- All new API routes must be registered in `app/main.py`
- Frontend API calls go through `src/lib/api.ts` — add new endpoints there

---

## What Is In Progress
- Epic 05: AI Shortlisting — generating ranked shortlists with LLM reasoning (story 05.1 active)

## What Is NOT Yet Built
- Authentication & RBAC (Epic 12)
- Recruiter chat assistant (Epic 06)
- Interview kit generation (Epic 07)
- Bias detection & explainability (Epic 08)
- Pipeline/Kanban workflow (Epic 09)
- Notifications & email (Epic 10)
- Reporting & analytics (Epic 11)
- Data privacy & compliance (Epic 13)
- External integrations — LinkedIn, job boards, Slack (Epic 15)
- Admin panel (Epic 16)
- Kubernetes, CI/CD, monitoring (Epic 14 partial)


---

## Work Division

### Pratik (Person A)
Owns: Epic 05, Epic 06, Epic 07, Epic 11

**Must Have (P0) — do first:**
- Epic 05: Shortlist generation (05.1, 05.2, 05.3) — in progress
- Epic 06: Chat assistant UI, intent routing, semantic search, pipeline filter, conversation context, response generation (06.1, 06.2, 06.3, 06.4, 06.7, 06.8)
- Epic 07: Skill gap analysis, technical/behavioral/gap-probe question generation, kit review UI (07.1, 07.2, 07.3, 07.4, 07.6)
- Epic 11: Overview dashboard, time-in-stage, scoring distribution, bias analytics, CSV/PDF export (11.1, 11.2, 11.3, 11.5, 11.7)

**Should Have (P1) — do after P0:**
- Epic 05: Feedback loop, near-miss candidates (05.4, 05.5)
- Epic 06: Candidate comparison, action execution (06.5, 06.6)
- Epic 07: Scoring rubric, PDF export (07.5, 07.7)
- Epic 11: Source-of-hire tracking, recruiter activity report (11.4, 11.6)

**Do NOT touch:** Auth models, pipeline/stage models, notification models (Yash's territory)

---

### Yash (Person B)
Owns: Epic 12, Epic 09, Epic 10, Epic 08

**Must Have (P0) — do first:**
- Epic 12: All auth stories — email/password, SSO, MFA, JWT, RBAC middleware, permissions, session, audit log (12.1–12.8)
- Epic 09: Pipeline stage config, bulk actions, RBAC views, stage transition audit (09.1, 09.4, 09.6, 09.7)
- Epic 10: Candidate status emails, in-app notifications, email queue, unsubscribe (10.2, 10.3, 10.4, 10.7)
- Epic 08: Proxy detection, counterfactual analysis, bias flagging, field masking, audit log, fairness dashboard, explainability panel (08.1–08.6, 08.8)

**Should Have (P1) — do after P0:**
- Epic 09: Kanban board, drag-drop, stage automations (09.2, 09.3, 09.5)
- Epic 10: Email templates, notification preferences (10.1, 10.6)
- Epic 08: Compliance report export (08.7)

**Do NOT touch:** Shortlist/scoring models, chat/LLM services, interview kit models (Pratik's territory)

---

### Shared (tackle together after above is done)
- Epic 13: Data privacy & GDPR compliance
- Epic 14: CI/CD, Kubernetes, monitoring (14.2–14.8)
- Epic 15: External integrations (LinkedIn, job boards, Slack)
- Epic 16: Admin panel

### Coordination Rules
- Sync before touching shared files: `app/models/`, `app/main.py`, `src/lib/api.ts`, `alembic/versions/`
- Each person works on a separate Git branch per feature
- Merge via PR — do not push directly to main
- Update this file when a feature is completed so both Kiro instances stay in sync
