import asyncio
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import logger, setup_logging
from app.core.middleware import RequestLoggingAndIdMiddleware, SecurityHeadersMiddleware
from app.core.redis import redis_manager
from app.modules.currency.providers.http_client import http_client
from app.modules.auth.router import router as auth_router
from app.modules.currency.analytics_router import router as analytics_router
from app.modules.currency.history_router import router as history_router
from app.modules.currency.router import router as currency_router
from app.modules.currency.websocket import (
    periodic_rates_pusher,
    ws_rates_endpoint,
)
from app.modules.favorites.router import router as favorites_router
from app.modules.health.router import router as health_router
from app.modules.notifications.router import router as notifications_router
from app.modules.users.router import router as users_router


# ------------------------------------------------------------------------------
# Lifespan Hook (FastAPI 0.115+)
# ------------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    """Manages the startup and shutdown event lifecycle of the application."""
    # 1. Setup Structured JSON logging
    setup_logging()
    logger.info("Initializing Currency Tracker Platform API...")

    # 2. Initialize Redis connection pool and verify connection
    redis_manager.init_pool()
    if settings.ENV != "testing":
        redis_healthy = await redis_manager.ping()
        if not redis_healthy:
            logger.critical(
                "Could not connect to Redis cache on startup. "
                "The application will start, but caching features "
                "will be disabled/unhealthy with database fallbacks."
            )
        else:
            logger.info("Redis cache client connected successfully.")
    else:
        logger.info("Skipping Redis connection verification in testing mode.")

    # Start periodic rates pusher background task
    rates_task = asyncio.create_task(periodic_rates_pusher())

    yield

    # Cancel periodic rates pusher task on shutdown
    rates_task.cancel()
    try:
        await rates_task
    except asyncio.CancelledError:
        pass

    # 4. Graceful Shutdown: disconnect cache and HTTP clients
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
