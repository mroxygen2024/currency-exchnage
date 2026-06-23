from datetime import datetime

from fastapi import APIRouter, Depends, Query, status
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.redis import get_redis
from app.modules.auth.dependencies import get_current_active_user
from app.modules.auth.models import User
from app.modules.currency import schemas, services

router = APIRouter(prefix="/history", tags=["Conversion History"])


@router.get("", response_model=schemas.PaginatedHistory)
async def get_conversion_history(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=100, description="Items per page"),
    start_date: datetime | None = Query(
        None, description="Start datetime filter (inclusive)"
    ),
    end_date: datetime | None = Query(
        None, description="End datetime filter (inclusive)"
    ),
    from_currency: str | None = Query(
        None,
        min_length=3,
        max_length=3,
        description="Source 3-letter currency code filter",
    ),
    to_currency: str | None = Query(
        None,
        min_length=3,
        max_length=3,
        description="Target 3-letter currency code filter",
    ),
    sort_by: str = Query(
        "converted_at",
        description="Field to sort by (converted_at, amount, rate, result)",
    ),
    sort_order: str = Query("desc", description="Sort order (asc, desc)"),
    user_id: int | None = Query(None, description="Admin-only: filter by user ID"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> schemas.PaginatedHistory:
    """Retrieve conversion history log with filtering, sorting, and pagination.

    - Standard users can only view their own history.
    - Admins can query any user's history or view global history.
    """
    return await services.list_history(
        db=db,
        user=current_user,
        page=page,
        limit=limit,
        start_date=start_date,
        end_date=end_date,
        from_currency=from_currency,
        to_currency=to_currency,
        sort_by=sort_by,
        sort_order=sort_order,
        filter_user_id=user_id,
    )


@router.get("/{id}", response_model=schemas.CurrencyConversionOut)
async def get_conversion_history_record(
    id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> schemas.CurrencyConversionOut:
    """Retrieve details of a specific conversion history record.

    - Standard users can only view their own records.
    - Admins can view any record.
    """
    return await services.get_history_by_id(
        db=db,
        conversion_id=id,
        user=current_user,
    )


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversion_history_record(
    id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> None:
    """Delete a specific conversion history record.

    - Standard users can only delete their own records.
    - Admins can delete any record.
    """
    await services.delete_history(
        db=db,
        redis=redis,
        conversion_id=id,
        user=current_user,
    )
