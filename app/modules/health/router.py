from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Response, status
from redis.asyncio import Redis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_redis
from app.core.logging import logger

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health_check(
    response: Response,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> dict:
    """Check application health status by checking PostgreSQL and Redis dependencies.

    Returns a 200 OK status if both services are responsive, or 503 Service Unavailable
    if either service fails the connection test.
    """
    db_status = "down"
    redis_status = "down"

    # Test database connectivity
    try:
        # Executes a lightweight constant SELECT to test roundtrip
        await db.execute(text("SELECT 1"))
        db_status = "up"
    except Exception as exc:
        logger.error(
            "Healthcheck failure: PostgreSQL database is unreachable.",
            error=str(exc),
            exc_info=True,
        )

    # Test Redis connectivity
    try:
        ping_success = await redis.ping()
        redis_status = "up" if ping_success else "down"
    except Exception as exc:
        logger.error(
            "Healthcheck failure: Redis cache is unreachable.",
            error=str(exc),
            exc_info=True,
        )

    is_healthy = db_status == "up" and redis_status == "up"

    if not is_healthy:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return {
        "status": "healthy" if is_healthy else "unhealthy",
        "timestamp": datetime.now(UTC).isoformat(),
        "services": {
            "database": db_status,
            "cache": redis_status,
        },
    }
