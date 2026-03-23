# AI-Driven Hiring Intelligence Platform

Monorepo containing the FastAPI backend and Next.js 14 frontend.

## Structure

```
apps/
  api/     — FastAPI backend (Python 3.11)
  web/     — Next.js 14 frontend (TypeScript)
docker-compose.yml
```

## Quick Start

### 1. Start local services

```bash
docker compose up -d postgres redis minio mailpit
```

### 2. Backend setup

```bash
cd apps/api
pip install poetry
poetry install
cp .env .env  # already present
alembic upgrade head
uvicorn app.main:app --reload
# API running at http://localhost:8000
# Docs at http://localhost:8000/docs
```

### 3. Frontend setup

```bash
cd apps/web
npm install
npm run dev
# App running at http://localhost:3000
```

## Running Tests

### Backend

```bash
cd apps/api
# Ensure postgres_test is running: docker compose up -d postgres_test
pytest -v
```

### Frontend

```bash
cd apps/web
npm run test
```

## Local Service URLs

| Service | URL |
|---|---|
| API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |
| Web App | http://localhost:3000 |
| MinIO Console | http://localhost:9001 |
| Mailpit (emails) | http://localhost:8025 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

## Story 01.1 — What's implemented

- `POST /api/v1/jobs` — Create job (saved as draft)
- `GET /api/v1/jobs` — List jobs with status/department filters
- `GET /api/v1/jobs/:id` — Get job detail with assignments
- `PUT /api/v1/jobs/:id` — Update job fields
- `PATCH /api/v1/jobs/:id/status` — State machine transitions
- `POST /api/v1/jobs/:id/assignments` — Assign recruiter/hiring manager
- `DELETE /api/v1/jobs/:id/assignments/:userId` — Remove assignment
- `GET /api/v1/jobs/:id/status-history` — Full audit trail
- Job creation form UI with rich text editor
- 30-second auto-save draft
- Client-side + server-side validation
- State machine: draft → active → paused/closed
- Activation guard: requires recruiter assignment
- Close requires reason
