from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession
from taskiq import TaskiqDepends

from app.core.dependencies import get_db, get_redis
from app.core.logging import logger
from app.modules.currency import services
from app.tasks.broker import broker


@broker.task
async def sync_exchange_rate_task(
    base: str,
    target: str,
    rate: float,
    db: AsyncSession = TaskiqDepends(get_db),
    redis: Redis = TaskiqDepends(get_redis),
) -> None:
    """Asynchronous background task to sync and broadcast exchange rates.

    This task resolves DB and Cache sessions using Taskiq's dependency injector
    (TaskiqDepends) mimicking standard FastAPI depends.
    """
    logger.info(
        "Executing sync_exchange_rate_task background worker.",
        base=base,
        target=target,
        rate=rate,
    )
    try:
        # Business logic executed asynchronously in worker thread/process
        await services.update_or_create_rate(
            db=db, redis=redis, base=base, target=target, rate=rate
        )
        logger.info(
            "sync_exchange_rate_task completed successfully.",
            pair=f"{base}{target}",
        )
    except Exception as exc:
        logger.error(
            "sync_exchange_rate_task failed to update rate.",
            pair=f"{base}{target}",
            error=str(exc),
            exc_info=True,
        )
        raise exc
