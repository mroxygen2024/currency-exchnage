import json
import re
from datetime import datetime

from redis.asyncio import Redis
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import (
    BadRequestException,
    ForbiddenException,
    NotFoundException,
)
from app.core.logging import logger
from app.modules.auth.models import User
from app.modules.currency.models import (
    CurrencyConversion,
    CurrencyRate,
    CurrencyRateHistory,
)
from app.modules.currency.websocket import ws_manager


def _get_cache_key(base: str, target: str) -> str:
    return f"rate:{base.upper()}:{target.upper()}"


async def get_rate(
    db: AsyncSession, redis: Redis, base: str, target: str
) -> CurrencyRate | None:
    """Retrieve exchange rate for a currency pair, leveraging Redis caching.

    Checks the cache first. On miss, it queries PostgreSQL, populates the cache,
    and returns the record.
    """
    base_upper, target_upper = base.upper(), target.upper()
    cache_key = _get_cache_key(base_upper, target_upper)

    # Attempt cache read
    try:
        cached_rate = await redis.get(cache_key)
        if cached_rate is not None:
            logger.debug(
                "Cache hit for currency rate", pair=f"{base_upper}{target_upper}"
            )
            # Construct a transient model instance using cached rate
            # (last_updated will not represent DB precision, but suffices for reads)
            return CurrencyRate(
                base_currency=base_upper,
                target_currency=target_upper,
                rate=float(cached_rate),
            )
    except Exception as exc:
        logger.error("Failed to query Redis cache", error=str(exc))

    # Cache miss - query Database
    logger.info(
        "Cache miss for currency rate. Querying DB...",
        pair=f"{base_upper}{target_upper}",
    )
    stmt = select(CurrencyRate).where(
        CurrencyRate.base_currency == base_upper,
        CurrencyRate.target_currency == target_upper,
    )
    result = await db.execute(stmt)
    db_rate = result.scalar_one_or_none()

    if db_rate:
        # Populate Cache asynchronously
        try:
            # Cache for 10 minutes (600 seconds)
            await redis.setex(
                cache_key, settings.CACHE_EXPIRE_SECONDS, str(float(db_rate.rate))
            )
        except Exception as exc:
            logger.error("Failed to update Redis cache", error=str(exc))

    return db_rate


async def update_or_create_rate(
    db: AsyncSession, redis: Redis, base: str, target: str, rate: float
) -> CurrencyRate:
    """Create or update a currency pair's exchange rate.

    Updates database state, invalidates/refreshes the cache, and broadcasts
    the updated rates to active WebSocket connections on the corresponding channel.
    """
    base_upper, target_upper = base.upper(), target.upper()
    pair = f"{base_upper}{target_upper}"
    cache_key = _get_cache_key(base_upper, target_upper)

    stmt = select(CurrencyRate).where(
        CurrencyRate.base_currency == base_upper,
        CurrencyRate.target_currency == target_upper,
    )
    result = await db.execute(stmt)
    db_rate = result.scalar_one_or_none()

    if db_rate:
        db_rate.rate = rate
        logger.info("Updated existing currency pair rate in DB", pair=pair, rate=rate)
    else:
        db_rate = CurrencyRate(
            base_currency=base_upper,
            target_currency=target_upper,
            rate=rate,
        )
        db.add(db_rate)
        logger.info("Created new currency pair rate in DB", pair=pair, rate=rate)

    # Record to historical rate log
    db_history = CurrencyRateHistory(
        base_currency=base_upper,
        target_currency=target_upper,
        rate=rate,
    )
    db.add(db_history)

    await db.flush()

    # Refresh Redis Cache and invalidate trends
    try:
        await redis.setex(cache_key, settings.CACHE_EXPIRE_SECONDS, str(rate))
        # Invalidate trend caches in Redis for this pair
        pattern = f"analytics:trends:{base_upper}:{target_upper}:*"
        keys = await redis.keys(pattern)
        if keys:
            await redis.delete(*keys)
            logger.info("Invalidated trends cache", keys_count=len(keys), pair=pair)
    except Exception as exc:
        logger.error(
            "Failed to refresh Redis cache or invalidate trends cache on update",
            error=str(exc),
        )

    # Broadcast update to connected WebSocket clients
    payload = {
        "event": "rate_update",
        "pair": pair,
        "base": base_upper,
        "target": target_upper,
        "rate": rate,
    }
    await ws_manager.broadcast_to_channel(channel=pair, message=payload)

    # Queue threshold alert check task asynchronously
    try:
        from app.modules.notifications.tasks import check_threshold_alerts_task
        await check_threshold_alerts_task.kiq(
            base=base_upper,
            target=target_upper,
            current_rate=rate,
        )
        logger.info("Successfully queued threshold alert checks", pair=pair, rate=rate)
    except Exception as exc:
        logger.error(
            "Failed to queue check_threshold_alerts_task",
            pair=pair,
            error=str(exc),
        )

    return db_rate


async def list_rates(db: AsyncSession) -> list[CurrencyRate]:
    """Retrieve all currency exchange rate records from the database."""
    stmt = select(CurrencyRate).order_by(CurrencyRate.base_currency)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def convert_currency(
    db: AsyncSession,
    redis: Redis,
    from_currency: str,
    to_currency: str,
    amount: float,
    user_id: int | None = None,
) -> CurrencyConversion:
    """Validate currencies and amount, calculate conversion, and save
    details to history.

    Supports:
    - Same currency (rate = 1.0)
    - Direct pair (from_currency -> to_currency)
    - Inverse pair (to_currency -> from_currency)
    - Cross-rate via a common base (e.g., USD or EUR)
    """
    from_upper = from_currency.upper()
    to_upper = to_currency.upper()

    # 1. Validation
    if not re.match(r"^[A-Z]{3}$", from_upper) or not re.match(r"^[A-Z]{3}$", to_upper):
        raise BadRequestException(
            message="Currency codes must be exactly 3-character alphabetic codes."
        )

    if amount <= 0:
        raise BadRequestException(
            message="Conversion amount must be greater than zero."
        )

    # 2. Get Conversion Rate
    if from_upper == to_upper:
        rate = 1.0
    else:
        # Check direct rate
        direct_rate = await get_rate(db, redis, from_upper, to_upper)
        if direct_rate:
            rate = float(direct_rate.rate)
        else:
            # Check inverse rate
            inverse_rate = await get_rate(db, redis, to_upper, from_upper)
            if inverse_rate and float(inverse_rate.rate) > 0:
                rate = 1.0 / float(inverse_rate.rate)
            else:
                # Try cross-rates via USD or EUR
                rate = None
                for base in ["USD", "EUR"]:
                    rate_base_to_from = await get_rate(db, redis, base, from_upper)
                    rate_base_to_to = await get_rate(db, redis, base, to_upper)
                    if rate_base_to_from and rate_base_to_to:
                        r1 = float(rate_base_to_from.rate)
                        r2 = float(rate_base_to_to.rate)
                        if r1 > 0:
                            rate = r2 / r1
                            break
                    # Also try from -> base, base -> to
                    rate_from_to_base = await get_rate(db, redis, from_upper, base)
                    if rate_from_to_base and rate_base_to_to:
                        r1 = float(rate_from_to_base.rate)
                        r2 = float(rate_base_to_to.rate)
                        rate = r1 * r2
                        break

                if rate is None:
                    raise NotFoundException(
                        message=(
                            f"Exchange rate for pair {from_upper}/{to_upper} "
                            "was not found."
                        )
                    )

    # 3. Calculate conversion
    result = amount * rate

    # 4. Save conversion history
    conversion = CurrencyConversion(
        user_id=user_id,
        from_currency=from_upper,
        to_currency=to_upper,
        amount=amount,
        rate=rate,
        result=result,
    )
    db.add(conversion)
    await db.flush()

    # Invalidate global analytics cache
    try:
        await redis.delete("analytics:global")
        logger.info("Invalidated global analytics cache due to new conversion")
    except Exception as exc:
        logger.error(
            "Failed to invalidate global analytics cache on conversion", error=str(exc)
        )

    logger.info(
        "Successfully performed currency conversion and saved to history",
        user_id=user_id,
        from_currency=from_upper,
        to_currency=to_upper,
        amount=amount,
        rate=rate,
        result=result,
    )

    return conversion


async def list_history(
    db: AsyncSession,
    user: User,
    page: int = 1,
    limit: int = 10,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    from_currency: str | None = None,
    to_currency: str | None = None,
    sort_by: str = "converted_at",
    sort_order: str = "desc",
    filter_user_id: int | None = None,
) -> dict:
    """Retrieve paginated and filtered list of currency conversion history.

    - Standard users can only view their own conversions.
    - Admins can view all conversions, or filter by a specific user's ID.
    """
    # 1. Base Query & Authorization Filter
    query = select(CurrencyConversion)
    filters = []

    if user.role == "admin":
        if filter_user_id is not None:
            filters.append(CurrencyConversion.user_id == filter_user_id)
    else:
        filters.append(CurrencyConversion.user_id == user.id)

    # 2. Apply filters
    if from_currency:
        filters.append(CurrencyConversion.from_currency == from_currency.upper())
    if to_currency:
        filters.append(CurrencyConversion.to_currency == to_currency.upper())
    if start_date:
        filters.append(CurrencyConversion.converted_at >= start_date)
    if end_date:
        filters.append(CurrencyConversion.converted_at <= end_date)

    if filters:
        query = query.where(*filters)

    # 3. Sorting
    valid_sort_fields = {"converted_at", "amount", "rate", "result"}
    if sort_by not in valid_sort_fields:
        options = ", ".join(valid_sort_fields)
        raise BadRequestException(
            message=f"Invalid sort field '{sort_by}'. Valid options are: {options}"
        )

    sort_order_lower = sort_order.lower()
    if sort_order_lower not in {"asc", "desc"}:
        raise BadRequestException(
            message="Invalid sort order. Valid options are 'asc' or 'desc'."
        )

    field = getattr(CurrencyConversion, sort_by)
    if sort_order_lower == "desc":
        query = query.order_by(field.desc())
    else:
        query = query.order_by(field.asc())

    # 4. Count total
    count_stmt = select(func.count(CurrencyConversion.id)).where(*filters)
    count_result = await db.execute(count_stmt)
    total = count_result.scalar() or 0

    # 5. Apply pagination
    offset = (page - 1) * limit
    query = query.offset(offset).limit(limit)

    # 6. Execute query
    result = await db.execute(query)
    items = result.scalars().all()

    pages = (total + limit - 1) // limit if total > 0 else 0

    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": pages,
    }


async def get_history_by_id(
    db: AsyncSession,
    conversion_id: int,
    user: User,
) -> CurrencyConversion:
    """Retrieve details of a specific conversion history record.

    Validates that the record exists and that the user is authorized to view it.
    - Admins can view any record.
    - Standard users can only view their own records.
    """
    stmt = select(CurrencyConversion).where(CurrencyConversion.id == conversion_id)
    result = await db.execute(stmt)
    conversion = result.scalar_one_or_none()

    if not conversion:
        raise NotFoundException(
            message=f"Conversion history record with ID {conversion_id} not found."
        )

    # Authorization check
    if user.role != "admin" and conversion.user_id != user.id:
        raise ForbiddenException(
            message="You do not have permission to view this conversion history record."
        )

    return conversion


async def delete_history(
    db: AsyncSession,
    redis: Redis,
    conversion_id: int,
    user: User,
) -> None:
    """Delete a conversion history record.

    - Standard users can only delete their own records.
    - Admins can delete any record.
    """
    conversion = await get_history_by_id(db, conversion_id, user)
    await db.delete(conversion)
    await db.flush()

    # Invalidate global analytics cache
    try:
        await redis.delete("analytics:global")
        logger.info("Invalidated global analytics cache due to conversion deletion")
    except Exception as exc:
        logger.error(
            "Failed to invalidate global analytics cache on deletion", error=str(exc)
        )

    logger.info(
        "Successfully deleted conversion history record",
        id=conversion_id,
        user_id=user.id,
    )


async def get_analytics(db: AsyncSession, redis: Redis) -> dict:
    """Retrieve system-wide currency conversion analytics, leveraging Redis caching.

    Checks the cache first under 'analytics:global'. On miss or Redis failure,
    it queries PostgreSQL to calculate total conversions, popular pairs, and
    total volume, populates the cache, and returns the analytics data.
    """
    cache_key = "analytics:global"

    # 1. Check Redis cache
    try:
        cached_data = await redis.get(cache_key)
        if cached_data is not None:
            logger.info("Cache hit for currency analytics")
            return json.loads(cached_data)
    except Exception as exc:
        logger.error("Failed to query Redis cache for analytics", error=str(exc))

    logger.info("Cache miss for currency analytics. Calculating from DB...")

    # 2. Cache miss - Query PostgreSQL
    # Query A: Total conversions count
    count_stmt = select(func.count(CurrencyConversion.id))
    count_res = await db.execute(count_stmt)
    total_conversions = count_res.scalar() or 0

    # Query B: Popular pairs (grouped by from/to, sorted by count desc, limit 5)
    pairs_stmt = (
        select(
            CurrencyConversion.from_currency,
            CurrencyConversion.to_currency,
            func.count(CurrencyConversion.id).label("count"),
            func.sum(CurrencyConversion.amount).label("total_amount"),
        )
        .group_by(CurrencyConversion.from_currency, CurrencyConversion.to_currency)
        .order_by(func.count(CurrencyConversion.id).desc())
        .limit(5)
    )
    pairs_res = await db.execute(pairs_stmt)
    popular_pairs_rows = pairs_res.all()

    popular_pairs = [
        {
            "from_currency": row.from_currency,
            "to_currency": row.to_currency,
            "count": row.count,
            "total_amount": float(row.total_amount)
            if row.total_amount is not None
            else 0.0,
        }
        for row in popular_pairs_rows
    ]

    # Query C: Total volume by currency
    volume_stmt = select(
        CurrencyConversion.from_currency,
        func.sum(CurrencyConversion.amount).label("total_amount"),
    ).group_by(CurrencyConversion.from_currency)
    volume_res = await db.execute(volume_stmt)
    volume_rows = volume_res.all()

    total_volume_by_currency = {
        row.from_currency: float(row.total_amount)
        if row.total_amount is not None
        else 0.0
        for row in volume_rows
    }

    analytics_data = {
        "total_conversions": total_conversions,
        "popular_pairs": popular_pairs,
        "total_volume_by_currency": total_volume_by_currency,
    }

    # 3. Populate Redis cache asynchronously
    try:
        await redis.setex(
            cache_key,
            settings.CACHE_EXPIRE_SECONDS,
            json.dumps(analytics_data),
        )
        logger.info("Successfully populated Redis cache for analytics")
    except Exception as exc:
        logger.error("Failed to update Redis cache for analytics", error=str(exc))

    return analytics_data


async def get_rate_trends(
    db: AsyncSession,
    redis: Redis,
    base: str,
    target: str,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    page: int = 1,
    limit: int = 30,
) -> dict:
    """Retrieve historical exchange rate trends, statistics, and percentage change.

    Leverages Redis caching. If cache hits, returns the cached trend payload.
    Otherwise queries the PostgreSQL database, computes statistics, paginates
    the trends, and caches the result.
    """
    base_upper = base.upper()
    target_upper = target.upper()

    valid_base = re.match(r"^[A-Z]{3}$", base_upper)
    valid_target = re.match(r"^[A-Z]{3}$", target_upper)
    if not valid_base or not valid_target:
        raise BadRequestException(
            message="Currency codes must be exactly 3-character alphabetic codes."
        )

    # 1. Check Redis cache first
    start_str = start_date.isoformat() if start_date else "none"
    end_str = end_date.isoformat() if end_date else "none"
    cache_key = (
        f"analytics:trends:{base_upper}:{target_upper}:"
        f"{start_str}:{end_str}:{page}:{limit}"
    )

    try:
        cached_data = await redis.get(cache_key)
        if cached_data is not None:
            logger.info("Cache hit for currency rate trends", key=cache_key)
            return json.loads(cached_data)
    except Exception as exc:
        logger.error("Failed to query Redis cache for rate trends", error=str(exc))

    logger.info("Cache miss for rate trends. Querying database...", key=cache_key)

    # 2. Database queries
    filters = [
        CurrencyRateHistory.base_currency == base_upper,
        CurrencyRateHistory.target_currency == target_upper,
    ]
    if start_date:
        filters.append(CurrencyRateHistory.timestamp >= start_date)
    if end_date:
        filters.append(CurrencyRateHistory.timestamp <= end_date)

    # Get statistics: Average, Min, Max, Count
    stats_stmt = select(
        func.avg(CurrencyRateHistory.rate).label("avg_rate"),
        func.min(CurrencyRateHistory.rate).label("min_rate"),
        func.max(CurrencyRateHistory.rate).label("max_rate"),
        func.count(CurrencyRateHistory.id).label("total_count")
    ).where(*filters)

    stats_res = await db.execute(stats_stmt)
    avg_rate, min_rate, max_rate, total = stats_res.one()
    total = total or 0

    if total == 0:
        empty_res = {
            "base_currency": base_upper,
            "target_currency": target_upper,
            "trends": [],
            "total": 0,
            "page": page,
            "limit": limit,
            "pages": 0,
            "stats": {
                "average_rate": 0.0,
                "percentage_change": 0.0,
                "min_rate": 0.0,
                "max_rate": 0.0,
            }
        }
        return empty_res

    # Query oldest rate in the period
    oldest_stmt = (
        select(CurrencyRateHistory.rate)
        .where(*filters)
        .order_by(CurrencyRateHistory.timestamp.asc())
        .limit(1)
    )
    oldest_rate = (await db.execute(oldest_stmt)).scalar_one_or_none()

    # Query latest rate in the period
    latest_stmt = (
        select(CurrencyRateHistory.rate)
        .where(*filters)
        .order_by(CurrencyRateHistory.timestamp.desc())
        .limit(1)
    )
    latest_rate = (await db.execute(latest_stmt)).scalar_one_or_none()

    # Calculate percentage change
    percentage_change = 0.0
    if (
        oldest_rate is not None
        and latest_rate is not None
        and float(oldest_rate) > 0
    ):
        diff = float(latest_rate) - float(oldest_rate)
        percentage_change = (diff / float(oldest_rate)) * 100.0

    # Paginate trends list
    offset = (page - 1) * limit
    trends_stmt = (
        select(CurrencyRateHistory)
        .where(*filters)
        .order_by(CurrencyRateHistory.timestamp.desc())
        .offset(offset)
        .limit(limit)
    )
    trends_res = await db.execute(trends_stmt)
    items = trends_res.scalars().all()

    trends = [
        {
            "rate": float(item.rate),
            "timestamp": item.timestamp.isoformat()
        }
        for item in items
    ]

    pages = (total + limit - 1) // limit if total > 0 else 0

    result_data = {
        "base_currency": base_upper,
        "target_currency": target_upper,
        "trends": trends,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": pages,
        "stats": {
            "average_rate": float(avg_rate) if avg_rate is not None else 0.0,
            "percentage_change": float(percentage_change),
            "min_rate": float(min_rate) if min_rate is not None else 0.0,
            "max_rate": float(max_rate) if max_rate is not None else 0.0,
        }
    }

    # 3. Cache the result in Redis
    try:
        await redis.setex(
            cache_key,
            settings.CACHE_EXPIRE_SECONDS,
            json.dumps(result_data)
        )
        logger.info("Successfully populated Redis cache for rate trends", key=cache_key)
    except Exception as exc:
        logger.error("Failed to populate Redis cache for rate trends", error=str(exc))

    return result_data

