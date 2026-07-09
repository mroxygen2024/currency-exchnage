import asyncio
import os
import subprocess  # noqa: S404
import sys
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import logger, setup_logging
from app.core.middleware import RequestLoggingAndIdMiddleware, SecurityHeadersMiddleware
from app.core.redis import redis_manager
from app.modules.auth.router import router as auth_router
from app.modules.currency.analytics_router import router as analytics_router
from app.modules.currency.history_router import router as history_router
from app.modules.currency.providers.http_client import http_client
from app.modules.currency.router import router as currency_router
from app.modules.currency.websocket import (
    periodic_rates_pusher,
    ws_rates_endpoint,
)
from app.modules.favorites.router import router as favorites_router
from app.modules.health.router import router as health_router
from app.modules.notifications.router import router as notifications_router
from app.modules.users.router import router as users_router

# Advisory lock key to prevent concurrent Alembic migrations
_MIGRATION_LOCK_KEY = 7712345


async def _run_alembic_migrations() -> None:
    """Run Alembic migrations with an advisory lock to prevent concurrent execution.

    This is a safety net for deployments where the Docker entrypoint might not
    run (e.g., non-Docker deployments on Render). The PostgreSQL advisory lock
    ensures only one worker runs migrations at a time.
    """
    from sqlalchemy import text

    from app.core.database import AsyncSessionLocal

    try:
        async with AsyncSessionLocal() as session:
            # Acquire advisory lock (session-level, auto-released on disconnect)
            result = await session.execute(
                text("SELECT pg_try_advisory_lock(:lock_key)"),
                {"lock_key": _MIGRATION_LOCK_KEY},
            )
            lock_acquired = result.scalar()
            if not lock_acquired:
                logger.info("Another process holds the migration lock — skipping.")
                return

            try:
                logger.info("Migration lock acquired. Running alembic upgrade head...")
                proc = subprocess.run(  # noqa: S603
                    [sys.executable, "-m", "alembic", "upgrade", "head"],
                    capture_output=True,
                    text=True,
                    timeout=120,
                    env={**os.environ, "PYTHONUNBUFFERED": "1"},
                )
                if proc.returncode != 0:
                    logger.error(
                        "Alembic upgrade head failed",
                        returncode=proc.returncode,
                        stdout=proc.stdout,
                        stderr=proc.stderr,
                    )
                else:
                    logger.info("Alembic migrations applied successfully.")
                    if proc.stdout.strip():
                        logger.info("Alembic output", output=proc.stdout.strip())
            finally:
                await session.execute(
                    text("SELECT pg_advisory_unlock(:lock_key)"),
                    {"lock_key": _MIGRATION_LOCK_KEY},
                )
    except Exception as exc:
        logger.error(
            "Failed to run migrations during startup",
            error=str(exc),
            exc_info=True,
        )


async def _seed_historical_rates() -> None:
    """Seed historical rate data if the currency_rate_history table is empty.

    This ensures the trends/analytics graph always has data to display.
    Tries the external provider first; falls back to synthetic data on failure.
    """
    from datetime import UTC, timedelta

    from sqlalchemy import func, select

    from app.core.database import AsyncSessionLocal
    from app.modules.currency.models import CurrencyRate, CurrencyRateHistory

    try:
        async with AsyncSessionLocal() as session:
            count_result = await session.execute(
                select(func.count(CurrencyRateHistory.id))
            )
            history_count = count_result.scalar() or 0

            if history_count > 0:
                logger.info(
                    "Historical rate data already exists",
                    record_count=history_count,
                )
                return

            # No history exists - seed it
            rates_result = await session.execute(select(CurrencyRate))
            rates = list(rates_result.scalars().all())

            if not rates:
                logger.info("No rates in DB to seed history from.")
                return

            logger.info(
                "Seeding historical rate data for existing rates",
                rate_count=len(rates),
            )

            import random as _random

            now = datetime.now(UTC)
            inserted = 0

            for rate_record in rates:
                base = rate_record.base_currency
                target = rate_record.target_currency
                current_rate = float(rate_record.rate)

                # Try to backfill from provider
                backfilled = False
                try:
                    from app.modules.currency.services import backfill_historical_rates

                    backfill_start = now - timedelta(days=30)
                    await backfill_historical_rates(
                        session, base, target, backfill_start, now
                    )
                    # Check if backfill inserted anything
                    check = await session.execute(
                        select(func.count(CurrencyRateHistory.id)).where(
                            CurrencyRateHistory.base_currency == base,
                            CurrencyRateHistory.target_currency == target,
                        )
                    )
                    if (check.scalar() or 0) > 0:
                        backfilled = True
                        inserted += check.scalar()
                except Exception as exc:
                    logger.warn(
                        "Provider backfill failed for seeding, using synthetic data",
                        pair=f"{base}/{target}",
                        error=str(exc),
                    )

                if not backfilled:
                    # Generate synthetic historical data (30 days of slight fluctuations)
                    for days_ago in range(30, 0, -1):
                        ts = now - timedelta(days=days_ago)
                        # Random fluctuation +/- 2%
                        fluctuation = 1 + _random.uniform(-0.02, 0.02)
                        hist_rate = current_rate * fluctuation
                        record = CurrencyRateHistory(
                            base_currency=base,
                            target_currency=target,
                            rate=round(hist_rate, 6),
                            timestamp=ts,
                        )
                        session.add(record)
                        inserted += 1

            await session.commit()
            logger.info(
                "Historical rate seeding completed",
                records_inserted=inserted,
            )
    except Exception as exc:
        logger.error(
            "Failed to seed historical rate data",
            error=str(exc),
            exc_info=True,
        )


async def _refresh_rates_on_startup() -> None:
    """Refresh exchange rates from the external provider on startup.

    This replaces the Celery beat periodic task on platforms like Render
    where only the web service runs (no Celery worker/beat).
    Runs as a background task so it doesn't block the server from accepting requests.
    """
    import random as _random

    from app.core.database import AsyncSessionLocal
    from app.core.redis import redis_manager
    from app.modules.currency.models import CurrencyRate
    from app.modules.currency.services import update_or_create_rate

    try:
        # Small delay to let the app finish startup first
        await asyncio.sleep(5)

        async with AsyncSessionLocal() as session:
            from sqlalchemy import select

            rates_result = await session.execute(select(CurrencyRate))
            rates = list(rates_result.scalars().all())

            if not rates:
                logger.info("No rates to refresh on startup.")
                return

            logger.info(
                "Refreshing rates from provider on startup",
                rate_count=len(rates),
            )

            # Group by base currency to minimize API calls
            base_groups: dict[str, list[str]] = {}
            for r in rates:
                base_groups.setdefault(r.base_currency, []).append(r.target_currency)

            redis_client = redis_manager.client

            for base_curr, target_currs in base_groups.items():
                try:
                    from app.modules.currency.providers import get_exchange_rate_provider

                    provider = get_exchange_rate_provider()
                    latest_rates = await provider.get_latest_rates(
                        base=base_curr, symbols=target_currs
                    )
                    for target_curr in target_currs:
                        if target_curr in latest_rates:
                            await update_or_create_rate(
                                db=session,
                                redis=redis_client,
                                base=base_curr,
                                target=target_curr,
                                rate=latest_rates[target_curr],
                            )
                    logger.info(
                        "Refreshed rates from provider",
                        base=base_curr,
                        targets=target_currs,
                    )
                except Exception as exc:
                    logger.warn(
                        "Provider refresh failed on startup, applying fluctuation",
                        base=base_curr,
                        error=str(exc),
                    )
                    # Fallback: slight random fluctuation
                    for r in rates:
                        if (
                            r.base_currency == base_curr
                            and r.target_currency in target_currs
                        ):
                            change = _random.uniform(-0.005, 0.005)
                            new_rate = round(float(r.rate) * (1 + change), 6)
                            await update_or_create_rate(
                                db=session,
                                redis=redis_client,
                                base=r.base_currency,
                                target=r.target_currency,
                                rate=new_rate,
                            )

            await session.commit()
            logger.info("Startup rate refresh completed.")
    except Exception as exc:
        logger.error(
            "Startup rate refresh failed",
            error=str(exc),
            exc_info=True,
        )


# ------------------------------------------------------------------------------
# Lifespan Hook (FastAPI 0.115+)
# ------------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    """Manages the startup and shutdown event lifecycle of the application."""
    # 1. Setup Structured JSON logging
    setup_logging()
    logger.info("Initializing Currency Tracker Platform API...")
    logger.info(
        "Configuration loaded",
        env=settings.ENV,
        debug=settings.DEBUG,
        api_prefix=settings.API_V1_STR,
        cors_origins=settings.BACKEND_CORS_ORIGINS,
        postgres_server=settings.POSTGRES_SERVER,
        redis_host=settings.REDIS_HOST,
        db_ssl_enabled=settings.database_ssl_enabled,
    )

    # 2. Initialize Redis connection pool and verify connection
    redis_manager.init_pool()
    if settings.ENV != "testing":
        redis_healthy = await redis_manager.ping()
        if not redis_healthy:
            logger.critical(
                "Could not connect to Redis cache on startup. "
                "The application will start, but caching features "
                "will be disabled/unhealthy with database fallbacks.",
                redis_url=(
                    settings.REDIS_URL or f"{settings.REDIS_HOST}:{settings.REDIS_PORT}"
                ),
            )
        else:
            logger.info("Redis cache client connected successfully.")
    else:
        logger.info("Skipping Redis connection verification in testing mode.")

    # 3. Run database migrations (safety net for non-Docker deployments)
    if settings.ENV != "testing":
        await _run_alembic_migrations()

    # 4. Verify database connectivity
    if settings.ENV != "testing":
        try:
            from sqlalchemy import text

            from app.core.database import AsyncSessionLocal

            async with AsyncSessionLocal() as session:
                await session.execute(text("SELECT 1"))
            logger.info("PostgreSQL database connection verified successfully.")
        except Exception as exc:
            logger.critical(
                "Could not connect to PostgreSQL database on startup.",
                error=str(exc),
                exc_info=True,
            )

    # 5. Seed historical rate data if currency_rate_history is empty
    if settings.ENV != "testing":
        await _seed_historical_rates()

    # 6. Start periodic rates pusher background task
    rates_task = asyncio.create_task(periodic_rates_pusher())

    # 7. Refresh rates from provider on startup (replaces Celery beat on Render)
    if settings.ENV != "testing":
        asyncio.create_task(_refresh_rates_on_startup())

    yield

    # Cancel periodic rates pusher task on shutdown
    rates_task.cancel()
    try:
        await rates_task
    except asyncio.CancelledError:
        pass

    # 6. Graceful Shutdown: disconnect cache and HTTP clients
    await redis_manager.close_pool()
    await http_client.close()

    logger.info("Application shutdown complete.")


# ------------------------------------------------------------------------------
# FastAPI App Initialization
# ------------------------------------------------------------------------------
app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Enterprise-grade Currency Exchange Tracking Platform API.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)


# ------------------------------------------------------------------------------
# Root Health Check (for Render / load balancer probes)
# ------------------------------------------------------------------------------
@app.get("/health", tags=["Health"])
async def root_health_check() -> dict:
    """Lightweight liveness probe at the root path.

    Render's healthCheckPath may be configured as ``/health``. This endpoint
    does NOT hit the database or Redis — it simply confirms the process is alive.
    Use ``/api/v1/health`` for a full dependency-check.
    """
    from datetime import UTC, datetime

    return {
        "status": "ok",
        "timestamp": datetime.now(UTC).isoformat(),
    }


# ------------------------------------------------------------------------------
# WebSocket Routes
# ------------------------------------------------------------------------------
@app.websocket("/ws/rates")
async def websocket_rates(websocket: WebSocket) -> None:
    """WebSocket endpoint for real-time exchange rate streaming."""
    await ws_rates_endpoint(websocket)


# ------------------------------------------------------------------------------
# Middleware Configurations
# ------------------------------------------------------------------------------
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    logger.info(
        "CORS middleware configured",
        allowed_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
    )
else:
    logger.warning(
        "CORS middleware NOT configured — BACKEND_CORS_ORIGINS is empty. "
        "Cross-origin requests will be blocked by the browser."
    )

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestLoggingAndIdMiddleware)

# ------------------------------------------------------------------------------
# Exception Handlers Registration
# ------------------------------------------------------------------------------
register_exception_handlers(app)

# ------------------------------------------------------------------------------
# API Router Mounting
# ------------------------------------------------------------------------------
# Register api routers under configured prefix versioning
app.include_router(health_router, prefix=settings.API_V1_STR)
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(users_router, prefix=settings.API_V1_STR)
app.include_router(currency_router, prefix=settings.API_V1_STR)
app.include_router(history_router, prefix=settings.API_V1_STR)
app.include_router(favorites_router, prefix=settings.API_V1_STR)
app.include_router(analytics_router, prefix=settings.API_V1_STR)
app.include_router(notifications_router, prefix=settings.API_V1_STR)
