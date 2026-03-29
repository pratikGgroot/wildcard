from celery import Celery
from celery.schedules import crontab
from app.core.config import settings

celery_app = Celery(
    "hiring_platform",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.tasks.resume_tasks", "app.tasks.score_tasks", "app.tasks.notification_tasks"],
)
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    beat_schedule={
        "flush-email-queue-every-minute": {
            "task": "app.tasks.notification_tasks.flush_email_queue",
            "schedule": 60.0,  # every 60 seconds
        },
    },
)
