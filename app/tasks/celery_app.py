import asyncio
from collections.abc import Coroutine
from typing import Any

from celery import Celery
from celery.schedules import crontab

from app.core.config import settings
from app.core.logging import logger

# Initialize Redis Connection Pool on Celery startup
from app.core.redis import redis_manager

if redis_manager.pool is None:
    try:
        redis_manager.init_pool()
    except Exception as exc:
        logger.error(
            "Failed to initialize Redis pool on Celery module import", error=str(exc)
        )

# Construct Celery app
celery_app = Celery(
    "currency_tracker",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

# Premium Celery Configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    # Configure task routing to separate performance/notification queues
    task_routes={
        "app.modules.notifications.tasks.*": {"queue": "notifications"},
        "app.modules.currency.tasks.*": {"queue": "default"},
        "app.modules.auth.tasks.*": {"queue": "default"},
    },
)

# Configure Celery Beat Periodic Scheduling
celery_app.conf.beat_schedule = {
    "update-rates-every-5-minutes": {
        "task": "app.modules.currency.tasks.update_rates_task",
        "schedule": 300.0,  # 5 minutes in seconds
    },
    "refresh-cache-every-10-minutes": {
        "task": "app.modules.currency.tasks.refresh_cache_task",
        "schedule": 600.0,  # 10 minutes in seconds
    },
    "clean-expired-tokens-daily": {
        "task": "app.modules.auth.tasks.clean_expired_tokens_task",
        "schedule": crontab(hour=0, minute=0),  # Daily at midnight
    },
    "daily-summaries-daily": {
        "task": "app.modules.notifications.tasks.daily_summaries_scheduler_task",
        "schedule": crontab(hour=0, minute=5),  # Daily at 12:05 AM
    },
}

# Auto-discover task modules
celery_app.autodiscover_tasks(
    [
        "app.modules.currency",
        "app.modules.notifications",
        "app.modules.auth",
    ]
)


def run_async(coro: Coroutine[Any, Any, Any]) -> Any:
    """Helper to execute async coroutines inside synchronous Celery worker processes."""
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    if loop.is_running():
        import nest_asyncio

        nest_asyncio.apply()

    return loop.run_until_complete(coro)
