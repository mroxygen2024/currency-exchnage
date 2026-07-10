import csv
import io
import json
import re
from collections.abc import AsyncGenerator
from datetime import datetime, timedelta

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
from app.modules.currency.providers import get_exchange_rate_provider
from app.modules.currency.providers.exceptions import (
    ExchangeRateProviderException,
    InvalidApiKeyException,
    ProviderDowntimeException,
    RateLimitExceededException,
)
from app.modules.currency.websocket import ws_manager


def _get_cache_key(base: str, target: str) -> str:
    return f"rate:{base.upper()}:{target.upper()}"


async def get_rate(
    db: AsyncSession, redis: Redis, base: str, target: str
) -> CurrencyRate | None:
    """Retrieve exchange rate for a currency pair, leveraging Redis caching.

    Checks the cache first. On miss, it queries PostgreSQL, populates the cache,
    and returns the record. If the database also misses, fetches from the
    external provider and updates cache and database.
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
            # Cache may contain either a plain float (legacy) or a JSON object
            # with id/last_updated for richer responses.
            try:
                cached_data = json.loads(cached_rate)
                if isinstance(cached_data, dict):
                    return CurrencyRate(
                        id=cached_data.get("id"),
                        base_currency=base_upper,
                        target_currency=target_upper,
                        rate=float(cached_data["rate"]),
                        last_updated=cached_data.get("last_updated"),
                    )
            except (json.JSONDecodeError, TypeError):
                pass
            # Legacy plain-float cache entry
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
        # Populate Cache asynchronously with full rate data
        try:
            cache_payload = json.dumps(
                {
                    "id": db_rate.id,
                    "rate": float(db_rate.rate),
                    "last_updated": (
                        db_rate.last_updated.isoformat()
                        if db_rate.last_updated
                        else None
                    ),
                }
            )
            await redis.setex(
                cache_key,
                settings.EXCHANGE_RATE_API_CACHE_TTL,
                cache_payload,
            )
        except Exception as exc:
            logger.error("Failed to update Redis cache", error=str(exc))
        return db_rate

    # DB Miss - fetch from external provider dynamically
    logger.info(
        "DB miss for currency rate. Fetching from external provider...",
        pair=f"{base_upper}{target_upper}",
    )
    try:
        provider = get_exchange_rate_provider()
        rates = await provider.get_latest_rates(base=base_upper, symbols=[target_upper])
        if target_upper in rates:
            rate_val = rates[target_upper]
            # Save new rate to DB and cache via update_or_create_rate
            db_rate = await update_or_create_rate(
                db, redis, base_upper, target_upper, rate_val
            )
            return db_rate
    except InvalidApiKeyException as exc:
        logger.error(
            "Exchange rate API key is invalid or missing. "
            "Set EXCHANGE_RATE_API_KEY in your environment.",
            base=base_upper,
            target=target_upper,
            error=str(exc),
        )
        raise
    except RateLimitExceededException as exc:
        logger.warn(
            "Exchange rate API rate limit exceeded",
            base=base_upper,
            target=target_upper,
            error=str(exc),
        )
        raise
    except ProviderDowntimeException as exc:
        logger.error(
            "Exchange rate provider is unreachable",
            base=base_upper,
            target=target_upper,
            error=str(exc),
        )
        raise
    except ExchangeRateProviderException as exc:
        logger.error(
            "Exchange rate provider error",
            base=base_upper,
            target=target_upper,
            error_code=exc.code,
            error=str(exc),
        )
        raise
    except Exception as exc:
        logger.error(
            "Failed to fetch rate from external provider on cache/DB miss",
            base=base_upper,
            target=target_upper,
            error=str(exc),
            exc_info=True,
        )

    return None


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
    from datetime import UTC

    db_history = CurrencyRateHistory(
        base_currency=base_upper,
        target_currency=target_upper,
        rate=rate,
        timestamp=datetime.now(UTC),
    )
    db.add(db_history)

    await db.flush()

    # Refresh Redis Cache and invalidate trends
    try:
        cache_payload = json.dumps(
            {
                "id": db_rate.id,
                "rate": float(db_rate.rate),
                "last_updated": db_rate.last_updated.isoformat()
                if db_rate.last_updated
                else None,
            }
        )
        await redis.setex(
            cache_key, settings.EXCHANGE_RATE_API_CACHE_TTL, cache_payload
        )
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
        from app.modules.notifications.tasks import check_threshold_alerts_celery_task

        check_threshold_alerts_celery_task.delay(
            base=base_upper,
            target=target_upper,
            current_rate=rate,
        )
        logger.info("Successfully queued threshold alert checks", pair=pair, rate=rate)
    except Exception as exc:
        logger.error(
            "Failed to queue check_threshold_alerts_celery_task",
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
    - Caching and external provider dynamic lookup.
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

    # Validate currencies against supported list from provider
    supported = await get_supported_currencies(redis)
    if from_upper not in supported or to_upper not in supported:
        raise BadRequestException(
            message=(
                f"One or both currency codes "
                f"({from_upper}, {to_upper}) are not supported."
            )
        )

    # 2. Check Conversion Cache
    cache_key = f"conversion:{from_upper}:{to_upper}:{amount}"
    rate = None
    result = None

    try:
        cached_val = await redis.get(cache_key)
        if cached_val:
            logger.info("Cache hit for currency conversion details", key=cache_key)
            cached_data = json.loads(cached_val)
            rate = float(cached_data["rate"])
            result = float(cached_data["result"])
    except Exception as exc:
        logger.error("Failed to query Redis cache for conversion", error=str(exc))

    if rate is None or result is None:
        # 3. Get Conversion Rate
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
                        # Call provider convert fallback
                        try:
                            provider = get_exchange_rate_provider()
                            conv_data = await provider.convert(
                                from_upper, to_upper, amount
                            )
                            rate = float(conv_data["rate"])
                            result = float(conv_data["result"])
                        except ExchangeRateProviderException:
                            raise
                        except Exception as exc:
                            logger.error(
                                "External provider conversion failed",
                                from_currency=from_upper,
                                to_currency=to_upper,
                                error=str(exc),
                                exc_info=True,
                            )
                            raise NotFoundException(
                                message=(
                                    f"Exchange rate for pair "
                                    f"{from_upper}/{to_upper} "
                                    "was not found. The external "
                                    "rate provider may be "
                                    "unavailable or the API key "
                                    "may be invalid."
                                )
                            ) from exc

        if result is None:
            # Calculate conversion
            result = amount * rate

        # Cache conversion result
        try:
            await redis.setex(
                cache_key,
                settings.EXCHANGE_RATE_API_CACHE_TTL,
                json.dumps({"rate": rate, "result": result}),
            )
        except Exception as exc:
            logger.error("Failed to cache conversion result", error=str(exc))

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


class CSVStreamer:
    """Helper to write CSV rows to an in-memory buffer and retrieve the string."""

    def __init__(self) -> None:
        self.buffer = io.StringIO()
        self.writer = csv.writer(self.buffer)

    def write_row(self, row: list) -> str:
        self.writer.writerow(row)
        data = self.buffer.getvalue()
        self.buffer.seek(0)
        self.buffer.truncate(0)
        return data


async def stream_history_csv(
    user: User,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    from_currency: str | None = None,
    to_currency: str | None = None,
    filter_user_id: int | None = None,
) -> AsyncGenerator[str, None]:
    """Generate CSV rows of currency conversion history for streaming.

    - Standard users can only stream their own conversions.
    - Admins can stream all conversions or filter by user ID.
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

    # Order by converted_at desc (newest first)
    query = query.order_by(CurrencyConversion.converted_at.desc())

    # 3. Stream from Database using context manager
    from app.core.database import get_db_context

    async with get_db_context() as db:
        streamer = CSVStreamer()
        # Header row
        yield streamer.write_row(["Date", "Currency Pair", "Amount", "Result"])

        # Stream result from SQLAlchemy session
        result_stream = await db.stream_scalars(query)
        async for conversion in result_stream:
            pair = f"{conversion.from_currency}/{conversion.to_currency}"
            yield streamer.write_row(
                [
                    conversion.converted_at.isoformat(),
                    pair,
                    float(conversion.amount),
                    float(conversion.result),
                ]
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
            "total_amount": (
                float(row.total_amount) if row.total_amount is not None else 0.0
            ),
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
        row.from_currency: (
            float(row.total_amount) if row.total_amount is not None else 0.0
        )
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


async def backfill_historical_rates(
    db: AsyncSession, base: str, target: str, start_date: datetime, end_date: datetime
) -> None:
    """Query provider for timeseries/historical rates and backfill the DB history."""
    from datetime import UTC

    try:
        provider = get_exchange_rate_provider()

        start_str = (
            start_date.date().isoformat()
            if hasattr(start_date, "date")
            else start_date.isoformat()[:10]
        )
        end_str = (
            end_date.date().isoformat()
            if hasattr(end_date, "date")
            else end_date.isoformat()[:10]
        )

        logger.info(
            "Backfilling historical rates from external provider",
            base=base,
            target=target,
            start_date=start_str,
            end_date=end_str,
        )

        # Fetch timeseries data
        ts_data = await provider.get_timeseries(
            start_date=start_str,
            end_date=end_str,
            base=base,
            symbols=[target],
        )

        inserted = 0
        for date_str, rates in ts_data.items():
            if target in rates:
                rate_val = rates[target]
                timestamp = datetime.combine(
                    datetime.fromisoformat(date_str).date(),
                    datetime.min.time(),
                    tzinfo=UTC,
                )

                # Check if this record already exists to avoid duplicates
                check_stmt = select(CurrencyRateHistory).where(
                    CurrencyRateHistory.base_currency == base,
                    CurrencyRateHistory.target_currency == target,
                    CurrencyRateHistory.timestamp == timestamp,
                )
                existing = (await db.execute(check_stmt)).scalar_one_or_none()
                if not existing:
                    db_history = CurrencyRateHistory(
                        base_currency=base,
                        target_currency=target,
                        rate=rate_val,
                        timestamp=timestamp,
                    )
                    db.add(db_history)
                    inserted += 1
        await db.flush()
        logger.info(
            "Backfill completed",
            base=base,
            target=target,
            records_inserted=inserted,
        )
    except Exception as exc:
        logger.error(
            "Failed to backfill historical rates from provider",
            base=base,
            target=target,
            error=str(exc),
            exc_info=True,
        )


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
    the trends, and caches the result. Backfills history from the provider on DB miss.
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
        func.count(CurrencyRateHistory.id).label("total_count"),
    ).where(*filters)

    stats_res = await db.execute(stats_stmt)
    avg_rate, min_rate, max_rate, total = stats_res.one()
    total = total or 0

    # Backfill history if total count in DB is zero
    if total == 0:
        from datetime import UTC

        backfill_start = start_date or (datetime.now(UTC) - timedelta(days=30))
        backfill_end = end_date or datetime.now(UTC)
        await backfill_historical_rates(
            db, base_upper, target_upper, backfill_start, backfill_end
        )

        # Re-execute stats query
        stats_res = await db.execute(stats_stmt)
        avg_rate, min_rate, max_rate, total = stats_res.one()
        total = total or 0

    if total == 0:
        # Fallback: use the current live rate from currency_rates table
        # so the graph always has at least one data point.
        from datetime import UTC

        current_stmt = select(CurrencyRate).where(
            CurrencyRate.base_currency == base_upper,
            CurrencyRate.target_currency == target_upper,
        )
        current_rate = (await db.execute(current_stmt)).scalar_one_or_none()
        if current_rate:
            now = datetime.now(UTC)
            return {
                "base_currency": base_upper,
                "target_currency": target_upper,
                "trends": [
                    {
                        "rate": float(current_rate.rate),
                        "timestamp": now.isoformat(),
                    }
                ],
                "total": 1,
                "page": page,
                "limit": limit,
                "pages": 1,
                "stats": {
                    "average_rate": float(current_rate.rate),
                    "percentage_change": 0.0,
                    "min_rate": float(current_rate.rate),
                    "max_rate": float(current_rate.rate),
                },
            }

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
            },
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
    if oldest_rate is not None and latest_rate is not None and float(oldest_rate) > 0:
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
        {"rate": float(item.rate), "timestamp": item.timestamp.isoformat()}
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
        },
    }

    # 3. Cache the result in Redis
    try:
        await redis.setex(
            cache_key, settings.EXCHANGE_RATE_API_CACHE_TTL, json.dumps(result_data)
        )
        logger.info("Successfully populated Redis cache for rate trends", key=cache_key)
    except Exception as exc:
        logger.error("Failed to populate Redis cache for rate trends", error=str(exc))

    return result_data


async def get_supported_currencies(redis: Redis) -> list[str]:
    """Retrieve list of supported currency codes, using Redis caching."""
    cache_key = "currencies:supported"
    try:
        cached = await redis.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception as exc:
        logger.error("Failed to query Redis for supported currencies", error=str(exc))

    # Fetch from provider
    try:
        provider = get_exchange_rate_provider()
        symbols_map = await provider.get_supported_currencies()
        supported = sorted(symbols_map.keys())

        # Cache in Redis
        try:
            await redis.setex(
                cache_key,
                settings.EXCHANGE_RATE_API_CACHE_TTL,
                json.dumps(supported),
            )
        except Exception as exc:
            logger.error(
                "Failed to cache supported currencies in Redis",
                error=str(exc),
            )
        return supported
    except Exception as exc:
        logger.error(
            "Failed to fetch supported currencies from provider",
            error=str(exc),
        )
        # Fallback list of major currencies if provider is down
        fallback = ["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "CNY", "ETB"]
        return sorted(fallback)


async def get_currency_symbols(redis: Redis) -> dict[str, str]:
    """Retrieve currency symbols/descriptions, using Redis caching."""
    cache_key = "currencies:symbols"
    try:
        cached = await redis.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception as exc:
        logger.error("Failed to query Redis for currency symbols", error=str(exc))

    # Fetch from provider
    try:
        provider = get_exchange_rate_provider()
        symbols_map = await provider.get_supported_currencies()

        # Cache in Redis
        try:
            await redis.setex(
                cache_key,
                settings.EXCHANGE_RATE_API_CACHE_TTL,
                json.dumps(symbols_map),
            )
        except Exception as exc:
            logger.error(
                "Failed to cache currency symbols in Redis",
                error=str(exc),
            )
        return symbols_map
    except Exception as exc:
        logger.error("Failed to fetch currency symbols from provider", error=str(exc))
        # Fallback dict of major currencies if provider is down
        fallback = {
            "USD": "United States Dollar",
            "EUR": "Euro",
            "GBP": "British Pound Sterling",
            "JPY": "Japanese Yen",
            "CAD": "Canadian Dollar",
            "AUD": "Australian Dollar",
            "CHF": "Swiss Franc",
            "CNY": "Chinese Yuan",
            "ETB": "Ethiopian Birr",
        }
        return fallback
