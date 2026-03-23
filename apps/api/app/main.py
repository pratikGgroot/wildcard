from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.jobs import router as jobs_router
from app.api.v1.users import router as users_router
from app.api.v1.templates import router as templates_router, jobs_router as template_jobs_router
from app.api.v1.resumes import router as resumes_router
from app.api.v1.parsing_errors import router as parsing_errors_router
from app.api.v1.duplicates import router as duplicates_router, jobs_router as duplicate_jobs_router
from app.api.v1.candidates import router as candidates_router
from app.api.v1.shortlist import router as shortlist_router
from app.core.config import settings
from app.services.llm_service import LLMService

app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(jobs_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(templates_router, prefix="/api/v1")
app.include_router(template_jobs_router, prefix="/api/v1")
app.include_router(resumes_router, prefix="/api/v1")
app.include_router(parsing_errors_router, prefix="/api/v1")
app.include_router(duplicates_router, prefix="/api/v1")
app.include_router(duplicate_jobs_router, prefix="/api/v1")
app.include_router(candidates_router, prefix="/api/v1")
app.include_router(shortlist_router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "service": settings.APP_NAME}


@app.get("/health/llm")
async def health_llm():
    """Check LLM provider connectivity and model availability."""
    result = await LLMService().health_check()
    return result
