import random

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db_context
from app.core.logging import logger
from app.core.redis import redis_manager
from app.modules.currency import services
from app.tasks.celery_app import celery_app, run_async


async def sync_exchange_rate_task(
    base: str,
    target: str,
    rate: float,
    db: AsyncSession | None = None,
    redis: Redis | None = None,
) -> None:
    """Asynchronous background task to sync and broadcast exchange rates."""
    logger.info(
        "Executing sync_exchange_rate_task background worker.",
        base=base,
        target=target,
        rate=rate,
    )

    async def _execute(session: AsyncSession, r_client: Redis):
        await services.update_or_create_rate(
            db=session, redis=r_client, base=base, target=target, rate=rate
        )

    try:
        if db is not None and redis is not None:
            await _execute(db, redis)
        else:
            r_client = redis or redis_manager.client
            async with get_db_context() as session:
                await _execute(session, r_client)
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


# ------------------------------------------------------------------------------
# Celery Task Wrappers and Periodic Tasks
# ------------------------------------------------------------------------------


@celery_app.task(
    bind=True,
    autoretry_for=(Exception,),
    max_retries=3,
    default_retry_delay=5,
    retry_backoff=True,
)
def sync_exchange_rate_celery_task(self, base: str, target: str, rate: float) -> None:
    """Celery background task to sync and broadcast exchange rates."""
    run_async(sync_exchange_rate_task(base, target, rate))


@celery_app.task(
    bind=True,
    autoretry_for=(Exception,),
    max_retries=3,
    default_retry_delay=10,
    retry_backoff=True,
)
def update_rates_task(self) -> None:
    """Periodic task to synchronize rates from the external exchange rate provider.

    Falls back to a slight random fluctuation if the provider is unavailable or fails.
    """
    logger.info("Executing update_rates_task to synchronize/fluctuate exchange rates.")

    async def _run():
        async with get_db_context() as db:
            redis_client = redis_manager.client
            rates = await services.list_rates(db)

            # If no rates exist in DB, seed a default set of rates so the platform works out-of-the-box
            if not rates:
                logger.info("No currency rates found in database. Seeding defaults...")
                default_rates = [
                    ("USD", "EUR", 0.92),
                    ("USD", "GBP", 0.79),
                    ("USD", "JPY", 158.50),
                    ("EUR", "GBP", 0.85),
                    ("USD", "CAD", 1.37),
                    ("USD", "ETB", 115.00),
                ]
                for base, target, rate_val in default_rates:
                    await services.update_or_create_rate(
                        db=db,
                        redis=redis_client,
                        base=base,
                        target=target,
                        rate=rate_val,
                    )
                logger.info("Default currency rates seeded successfully.")
                return

            # Group rates by base currency to make fewer external API calls
            base_groups = {}
            for r in rates:
                base_groups.setdefault(r.base_currency, []).append(r.target_currency)

            from app.modules.currency.providers import get_exchange_rate_provider
            provider = get_exchange_rate_provider()

            for base_curr, target_currs in base_groups.items():
                try:
                    logger.info("Fetching latest rates from provider in background task", base=base_curr, targets=target_currs)
                    latest_rates = await provider.get_latest_rates(base=base_curr, symbols=target_currs)
                    for target_curr in target_currs:
                        if target_curr in latest_rates:
                            rate_val = latest_rates[target_curr]
                            await services.update_or_create_rate(
                                db=db,
                                redis=redis_client,
                                base=base_curr,
                                target=target_curr,
                                rate=rate_val,
                            )
                except Exception as exc:
                    logger.warn(
                        "Provider failed to fetch rates for background update. Applying fluctuation fallback...",
                        base=base_curr,
                        targets=target_currs,
                        error=str(exc),
                    )
                    # Fallback to random fluctuation (-0.5% to +0.5%)
                    for rate in rates:
                        if rate.base_currency == base_curr and rate.target_currency in target_currs:
                            change_percent = random.uniform(-0.005, 0.005)
                            new_rate = float(rate.rate) * (1 + change_percent)
                            new_rate = round(new_rate, 6)

                            await services.update_or_create_rate(
                                db=db,
                                redis=redis_client,
                                base=rate.base_currency,
                                target=rate.target_currency,
                                rate=new_rate,
                            )

    try:
        run_async(_run())
        logger.info("update_rates_task completed successfully.")
    except Exception as exc:
        logger.error("update_rates_task failed.", error=str(exc), exc_info=True)
        raise exc


@celery_app.task(
    bind=True,
    autoretry_for=(Exception,),
    max_retries=3,
    default_retry_delay=10,
    retry_backoff=True,
)
def refresh_cache_task(self) -> None:
    """Periodic task to refresh rates, symbols, supported list, and analytics in Redis to keep the cache warm."""
    logger.info("Executing refresh_cache_task to keep Redis warm.")

    async def _run():
        async with get_db_context() as db:
            redis_client = redis_manager.client
            # 1. Warm rates cache
            rates = await services.list_rates(db)
            for rate in rates:
                cache_key = services._get_cache_key(
                    rate.base_currency, rate.target_currency
                )
                await redis_client.setex(
                    cache_key, settings.EXCHANGE_RATE_API_CACHE_TTL, str(float(rate.rate))
                )

            # 2. Warm supported currencies and symbols cache
            await services.get_supported_currencies(redis_client)
            await services.get_currency_symbols(redis_client)

            # 3. Warm global analytics cache
            await services.get_analytics(db, redis_client)

    try:
        run_async(_run())
        logger.info("refresh_cache_task completed successfully.")
    except Exception as exc:
        logger.error("refresh_cache_task failed.", error=str(exc), exc_info=True)
        raise exc
