from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import logger, setup_logging
from app.core.redis import redis_manager
from app.modules.auth.router import router as auth_router
from app.modules.currency.history_router import router as history_router
from app.modules.currency.router import router as currency_router
from app.modules.favorites.router import router as favorites_router
from app.modules.health.router import router as health_router
from app.modules.users.router import router as users_router
from app.tasks.broker import broker


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
            logger.critical("Could not connect to Redis cache on startup.")
            raise RuntimeError("Redis connection failed.")
        logger.info("Redis cache client connected successfully.")
    else:
        logger.info("Skipping Redis connection verification in testing mode.")

    # 3. Initialize Taskiq background worker broker
    try:
        await broker.startup()
        logger.info("Taskiq broker started successfully.")
    except Exception as exc:
        logger.error("Failed to start Taskiq broker", error=str(exc))

    yield

    # 4. Graceful Shutdown: disconnect cache and task brokers
    await redis_manager.close_pool()
    try:
        await broker.shutdown()
        logger.info("Taskiq broker shut down successfully.")
    except Exception as exc:
        logger.error("Failed to cleanly shut down Taskiq broker", error=str(exc))

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
