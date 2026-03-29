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

### Pipeline/Kanban Workflow (Epic 09) — ✅ COMPLETED by Yash
- Default stages per job: Applied → Screening → Interview → Offer → Hired / Rejected
- Stage CRUD + reorder per job (recruiter or above)
- Candidate auto-placement: lands in **Applied** on resume upload, moves to **Screening** after parse completes
- Shortlist action auto-moves: **accepted** → Interview, **rejected** → Rejected
- Bulk move: select multiple candidates and move to any stage at once
- Stage transition audit log (`pipeline_stage_audit` table)
- Frontend: Kanban board on Pipeline tab of job detail page — search by name/email, parse status badge (green/grey/red), fit score on card, Move dropdown, bulk select + bulk move
- RBAC: recruiter and above can move candidates; viewer gets 403
- DB migration: `alembic/versions/0019_pipeline_stages.py` — creates `pipeline_stages`, `candidate_pipeline`, `pipeline_stage_audit`
- Files: `app/models/pipeline.py`, `app/services/pipeline_service.py`, `app/api/v1/pipeline.py`, `app/tasks/resume_tasks.py` (auto-placement hook), `app/services/shortlist_service.py` (auto-move on accept/reject), `src/components/jobs/pipeline-panel.tsx`, `src/lib/api.ts` (pipelineApi)
- **IMPORTANT for Pratik**: Do NOT touch `pipeline_stages`, `candidate_pipeline`, `pipeline_stage_audit` tables or `pipeline_service.py`. The pipeline auto-move on shortlist accept/reject is in `shortlist_service.py` `take_action()` — do not remove it.

### Notifications & Email (Epic 10) — ✅ P0 COMPLETED by Yash
- In-app notifications: bell icon in sidebar with unread badge, dropdown panel, mark read/all read
- Email queue: async via Celery, flushes every 60s, sent via SMTP to Mailpit (dev) at http://localhost:8025
- Notification preferences per user: toggle email/in-app per event type, unsubscribe token
- Auto-triggers: pipeline stage move → notify assigned users; shortlist accept/reject → notify assigned users
- DB migration: `alembic/versions/0020_notifications.py` — creates `notifications`, `email_queue`, `notification_preferences`
- Files: `app/services/email_service.py`, `app/services/notification_service.py`, `app/tasks/notification_tasks.py`, `app/api/v1/notifications.py`, `src/components/layout/notification-bell.tsx`, `src/lib/api.ts` (notificationsApi)
- API routes: `GET/POST /notifications`, `GET /notifications/unread-count`, `POST /notifications/{id}/read`, `POST /notifications/read-all`, `GET/PUT /notifications/preferences`, `POST /notifications/unsubscribe`
- P1 remaining: email templates UI (10.1), notification preferences page (10.6)

### Authentication & RBAC (Epic 12) — ✅ COMPLETED by Yash
- Email/password login with bcrypt password hashing (passlib)
- JWT access tokens (15 min) + refresh tokens (7 days) with rotation
- Refresh token hash stored in DB; silent refresh on 401 via axios interceptor
- Role-based access: `viewer`, `recruiter`, `hiring_manager`, `admin` (hierarchy enforced)
- `get_current_user`, `require_role()`, `require_min_role()` FastAPI dependencies in `app/api/deps.py`
- Password reset flow (token-based, hashed in DB)
- Frontend: `AuthProvider` + `useAuth()` hook, `RequireAuth` guard, login page, sidebar shows user name/role/sign-out
- Seed users (from migration 0002, passwords fixed to bcrypt in migration 0018):
  - `admin@hireiq.com` / `password123` — role: `admin`
  - `recruiter@hireiq.com` / `password123` — role: `recruiter`
  - `hiring@hireiq.com` / `password123` — role: `hiring_manager`
- Files: `app/api/v1/auth.py`, `app/api/deps.py`, `app/services/auth_service.py`, `app/models/user.py`, `alembic/versions/0018_auth_rbac.py`, `src/lib/auth-context.tsx`, `src/lib/api.ts` (interceptors), `src/app/login/page.tsx`, `src/components/auth/require-auth.tsx`, `src/components/layout/sidebar.tsx`

### Infrastructure
- Full Docker Compose setup: postgres, redis, minio, mailpit, api, web, worker
- Alembic migrations (0001–0025)
- Celery worker for background jobs
- `OLLAMA_BASE_URL: http://host.docker.internal:11434` set on both `api` and `worker` services in `docker-compose.yml` (required for LLM calls from inside Docker)

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
- `users` — auth users with `hashed_password`, `role`, `refresh_token_hash`, `last_login`, `mfa_secret`, `mfa_enabled`, `password_reset_token`, `password_reset_expires`
- `auth_audit_log` — login/logout/password-change audit trail
- `pipeline_stages` — per-job Kanban stages (name, order, color, is_terminal)
- `candidate_pipeline` — candidate's current stage per job (unique per candidate+job)
- `pipeline_stage_audit` — full history of every stage transitions with who moved and when
- `notifications` — in-app notifications per user (type, title, body, is_read)
- `email_queue` — async email queue (to, subject, html_body, status, attempts)
- `notification_preferences` — per-user email/in-app toggles + unsubscribe token
- `interview_kits` — generated interview kits per candidate+job (status, gap_analysis, criteria_hash)
- `interview_questions` — questions per kit (type: technical/behavioral/gap_probe, rubric JSON, display_order)
- `kit_share_links` — 30-day expiring read-only share tokens for approved kits
- `conversation_sessions` — chat session records
- `conversation_messages` — chat message history per session

## API Base URL
All API routes are prefixed: `/api/v1/`

## Key Conventions
- All DB sessions are async (`AsyncSession`) in API routes
- Celery tasks use sync `SyncSessionLocal` (not async)
- Presigned URLs use `S3_PUBLIC_URL` (browser-accessible), internal ops use `S3_ENDPOINT_URL`
- LLM calls go through `app/services/llm_service.py` — do not call Ollama directly
- All new API routes must be registered in `app/main.py`
- Frontend API calls go through `src/lib/api.ts` — add new endpoints there
- Auth: use `CurrentUser`, `AdminOnly`, `RecruiterOrAbove` from `app/api/deps.py` to protect routes
- All API route handlers must be `async def` — never use sync `Session` in route handlers (use `AsyncSession`)

---

## What Is Completed
- Epic 05: AI Shortlisting — all 5 stories done (05.1 shortlist generation, 05.2 LLM reasoning, 05.3 accept/reject/hold, 05.4 feedback loop & weight optimization, 05.5 near-miss candidates)
- Epic 06: Recruiter chat assistant — all P0 + P1 stories done (06.1 chat UI, 06.2 intent routing, 06.3 semantic search, 06.4 pipeline filter, 06.5 candidate comparison, 06.6 action execution/move candidate with confirmation, 06.7 conversation context, 06.8 response generation with links). Chat assistant uses hybrid approach: rule-based intent routing bypasses LLM for data queries (zero hallucination), LLM used only for open-ended conversational fallback.
- Epic 07: Interview kit generation — fully done (07.1 skill gap analysis, 07.2 technical questions, 07.3 behavioral questions, 07.4 gap-probe questions, 07.5 scoring rubric with LLM generation + per-question display, 07.6 kit review UI with approve/edit/delete/add questions, 07.7 PDF export via print page + share links with 30-day expiry)
- Epic 11: Reporting & Analytics — fully done (11.1 overview KPIs, 11.2 time-in-stage funnel, 11.3 score distribution histogram, 11.4 source-of-hire breakdown, 11.5 bias analytics with proxy-based variance detection, 11.6 recruiter activity report, 11.7 CSV + PDF export). Analytics page at `/analytics`, print page at `/analytics/print`. Backend: `app/api/v1/analytics.py`. Frontend: `src/app/analytics/page.tsx`.
- Epic 12: Authentication & RBAC — fully done (login, JWT, refresh rotation, RBAC deps, frontend auth flow, seed users)
- Epic 09: Pipeline/Kanban workflow — fully done by Yash

## What Is In Progress
- Epic 08: Bias detection & explainability (Yash — next)

## What Is NOT Yet Built
- Bias detection & explainability (Epic 08)
- Notifications & email (Epic 10) — P0 done by Yash, P1 remaining
- Data privacy & compliance (Epic 13)
- External integrations — LinkedIn, job boards, Slack (Epic 15)
- Admin panel (Epic 16)
- Kubernetes, CI/CD, monitoring (Epic 14 partial)


---

## Work Division

### Pratik (Person A)
Owns: Epic 05, Epic 06, Epic 07, Epic 11

**Must Have (P0) — do first:**
- Epic 05: Shortlist generation (05.1, 05.2, 05.3) — ✅ done
- Epic 06: Chat assistant UI, intent routing, semantic search, pipeline filter, conversation context, response generation (06.1, 06.2, 06.3, 06.4, 06.7, 06.8) — ✅ done
- Epic 07: Skill gap analysis, technical/behavioral/gap-probe question generation, kit review UI (07.1, 07.2, 07.3, 07.4, 07.6) — ✅ done
- Epic 11: Overview dashboard, time-in-stage, scoring distribution, bias analytics, CSV/PDF export (11.1, 11.2, 11.3, 11.5, 11.7) — ✅ done
- Epic 11: Source-of-hire tracking, recruiter activity report (11.4, 11.6) — ✅ done

**Should Have (P1) — do after P0:**
- Epic 05: Feedback loop, near-miss candidates (05.4, 05.5) — ✅ done
- Epic 06: Candidate comparison, action execution (06.5, 06.6) — ✅ done
- Epic 07: Scoring rubric, PDF export (07.5, 07.7) — ✅ done
- Epic 11: Source-of-hire tracking, recruiter activity report (11.4, 11.6)

**Do NOT touch:** Auth models, pipeline/stage models, notification models (Yash's territory)

### Interview Kit — Key Files (Epic 07) — ✅ COMPLETED by Pratik
- DB migrations: `alembic/versions/0023_interview_kits.py` (tables), `alembic/versions/0024_interview_kit_rubrics_sharing.py` (rubric column + share links)
- Backend: `app/api/v1/interview_kits.py`, `app/services/interview_kit_service.py`
- Frontend: `src/components/jobs/interview-kit-panel.tsx`, `src/app/interview-kits/print/[kitId]/page.tsx`, `src/app/interview-kits/shared/[token]/page.tsx`
- Tables: `interview_kits`, `interview_questions` (with `rubric` JSON column), `kit_share_links`
- **IMPORTANT for Yash**: Do NOT touch interview kit models, `interview_kit_service.py`, or the `interview_kits`/`interview_questions`/`kit_share_links` tables.

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
