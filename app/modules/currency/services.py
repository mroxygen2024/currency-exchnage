from typing import List, Optional
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import logger
from app.modules.currency.models import CurrencyRate
from app.modules.currency.websocket import ws_manager


def _get_cache_key(base: str, target: str) -> str:
    return f"rate:{base.upper()}:{target.upper()}"


async def get_rate(
    db: AsyncSession, redis: Redis, base: str, target: str
) -> Optional[CurrencyRate]:
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
            # Cache for 1 hour (3600 seconds)
            await redis.setex(cache_key, 3600, str(float(db_rate.rate)))
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

    await db.flush()

    # Refresh Redis Cache
    try:
        await redis.setex(cache_key, 3600, str(rate))
    except Exception as exc:
        logger.error("Failed to refresh Redis cache on update", error=str(exc))

    # Broadcast update to connected WebSocket clients
    payload = {
        "event": "rate_update",
        "pair": pair,
        "base": base_upper,
        "target": target_upper,
        "rate": rate,
    }
    await ws_manager.broadcast_to_channel(channel=pair, message=payload)

    return db_rate


async def list_rates(db: AsyncSession) -> List[CurrencyRate]:
    """Retrieve all currency exchange rate records from the database."""
    stmt = select(CurrencyRate).order_by(CurrencyRate.base_currency)
    result = await db.execute(stmt)
    return list(result.scalars().all())
