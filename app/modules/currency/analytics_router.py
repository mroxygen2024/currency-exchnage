from datetime import datetime

from fastapi import APIRouter, Depends, Query
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.redis import get_redis
from app.modules.auth.dependencies import get_current_active_user
from app.modules.auth.models import User
from app.modules.currency import schemas, services

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/trends", response_model=schemas.CurrencyTrendsOut)
async def get_rate_trends(
    base: str = Query(
        ...,
        min_length=3,
        max_length=3,
        description="Base 3-letter currency code (e.g. USD)",
    ),
    target: str = Query(
        ...,
        min_length=3,
        max_length=3,
        description="Target 3-letter currency code (e.g. EUR)",
    ),
    start_date: datetime | None = Query(
        None, description="Start datetime filter (inclusive)"
    ),
    end_date: datetime | None = Query(
        None, description="End datetime filter (inclusive)"
    ),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(30, ge=1, le=100, description="Items per page"),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
    _current_user: User = Depends(get_current_active_user),
) -> schemas.CurrencyTrendsOut:
    """Retrieve historical exchange rate trends, statistics, and percentage change.

    Validates authenticated user, then queries cached analytics trends
    or fallback database.
    """
    return await services.get_rate_trends(
        db=db,
        redis=redis,
        base=base,
        target=target,
        start_date=start_date,
        end_date=end_date,
        page=page,
        limit=limit,
    )
