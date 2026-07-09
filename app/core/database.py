from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings
from app.core.logging import logger

# ------------------------------------------------------------------------------
# Async Engine & Sessionmaker Creation
# ------------------------------------------------------------------------------
_connect_args: dict = {}
if settings.database_ssl_enabled:
    import ssl as _ssl

    _ssl_ctx = _ssl.create_default_context()
    _ssl_ctx.check_hostname = False
    _ssl_ctx.verify_mode = _ssl.CERT_NONE
    _connect_args["ssl"] = _ssl_ctx

engine = create_async_engine(
    settings.async_database_url,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_pre_ping=settings.DB_POOL_PRE_PING,
    pool_recycle=settings.DB_POOL_RECYCLE,
    future=True,
    echo=False,
    connect_args=_connect_args,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


# ------------------------------------------------------------------------------
# Declarative Base
# ------------------------------------------------------------------------------
class Base(DeclarativeBase):
    """Base class for all SQLAlchemy database models."""

    pass


# Global reference to hold the active transactional session during test execution
CURRENT_TEST_DB: AsyncSession | None = None


# ------------------------------------------------------------------------------
# Context Manager and Dependencies
# ------------------------------------------------------------------------------
@asynccontextmanager
async def get_db_context() -> AsyncGenerator[AsyncSession, None]:
    """Provide a transactional scope around database operations using context managers.

    This ensures that sessions are properly committed, rolled back on error,
    and closed at the end of the operation lifecycle.
    """
    if CURRENT_TEST_DB is not None:
        yield CURRENT_TEST_DB
        return

    session = AsyncSessionLocal()
    try:
        yield session
        await session.commit()
    except Exception as exc:
        await session.rollback()
        logger.error(
            "Database transaction failed. Rolled back session.",
            error=str(exc),
            exc_info=True,
        )
        raise exc
    finally:
        await session.close()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI Dependency providing an asynchronous session.

    This delegates management of the session connection and transactions
    to the get_db_context async context manager.
    """
    async with get_db_context() as session:
        yield session
