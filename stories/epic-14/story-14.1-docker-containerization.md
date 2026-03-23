# Story 14.1: Docker Containerization

## User Story
**As a** developer  
**I want to** run all services in Docker containers  
**So that** the application is portable, reproducible, and environment-agnostic

## BRD Requirements Covered
- BRD Section 15.4: Containers — Docker + Kubernetes (EKS/GKE)

## Acceptance Criteria
1. **Given** the codebase  
   **When** I run `docker compose up`  
   **Then** all services start (API, frontend, workers, DB, Redis, vector DB) within 2 minutes

2. **Given** a Docker image is built  
   **When** it is scanned  
   **Then** no critical CVEs are present in the base image or dependencies

3. **Given** a service container starts  
   **When** it is healthy  
   **Then** it passes its health check endpoint within 30 seconds

4. **Given** environment variables are needed  
   **When** the container starts  
   **Then** they are injected via environment (not baked into the image)

5. **Given** a production image is built  
   **When** it is compared to development  
   **Then** it uses a multi-stage build with a minimal runtime image (no dev dependencies)

## Priority
**P0 — Must Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **Base Images:** Python 3.12-slim (API/workers), Node 20-alpine (frontend)
- **Multi-stage:** Build stage + minimal runtime stage
- **Image Size:** Production images ≤ 500MB
- **Security:** Non-root user in containers; read-only filesystem where possible
- **Health Checks:** All services expose `/health` endpoint

## Technical Design

### Dockerfile (API)
```dockerfile
# Build stage
FROM python:3.12-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Runtime stage
FROM python:3.12-slim AS runtime
WORKDIR /app
RUN useradd -m -u 1000 appuser
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --chown=appuser:appuser . .
USER appuser
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s CMD curl -f http://localhost:8000/health || exit 1
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### docker-compose.yml Services
```yaml
services:
  api: { build: ./api, ports: ["8000:8000"] }
  frontend: { build: ./frontend, ports: ["3000:3000"] }
  worker: { build: ./api, command: celery worker }
  postgres: { image: pgvector/pgvector:pg16 }
  redis: { image: redis:7-alpine }
```

## Sub-Tasks
- [ ] 14.1.a — Write Dockerfiles for API, frontend, and worker services
- [ ] 14.1.b — Write docker-compose.yml for local development
- [ ] 14.1.c — Implement health check endpoints for all services
- [ ] 14.1.d — Configure non-root users and minimal permissions
- [ ] 14.1.e — Set up image vulnerability scanning in CI

## Testing Strategy
- Build: All images build without errors
- Security: No critical CVEs in production images
- Functional: `docker compose up` starts all services successfully

## Dependencies
- Story 14.3 (CI/CD — builds and pushes Docker images)
