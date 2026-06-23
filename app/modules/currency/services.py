from typing import List, Optional
import re
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestException, NotFoundException
from app.core.logging import logger
from app.modules.currency.models import CurrencyRate, CurrencyConversion
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


async def convert_currency(
    db: AsyncSession, redis: Redis, from_currency: str, to_currency: str, amount: float
) -> CurrencyConversion:
    """Validate currencies and amount, calculate conversion, and save details to history.

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
                        message=f"Exchange rate for pair {from_upper}/{to_upper} was not found."
                    )

    # 3. Calculate conversion
    result = amount * rate

    # 4. Save conversion history
    conversion = CurrencyConversion(
        from_currency=from_upper,
        to_currency=to_upper,
        amount=amount,
        rate=rate,
        result=result,
    )
    db.add(conversion)
    await db.flush()

    logger.info(
        "Successfully performed currency conversion and saved to history",
        from_currency=from_upper,
        to_currency=to_upper,
        amount=amount,
        rate=rate,
        result=result,
    )

    return conversion

