from collections.abc import AsyncGenerator
from unittest.mock import AsyncMock

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Force environment to 'testing' for all tests
from app.core.config import settings
settings.ENV = "testing"

from app.core.database import Base, get_db
from app.core.redis import get_redis
from app.main import app

# In-memory SQLite connection string for rapid unit testing
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture(scope="session")
def anyio_backend() -> str:
    """Configure anyio backend for async tests."""
    return "asyncio"


@pytest_asyncio.fixture(scope="session")
async def test_engine() -> AsyncGenerator[any, None]:
    """Create in-memory SQLite engine and initialize tables."""
    engine = create_async_engine(TEST_DATABASE_URL, future=True)
    async with engine.begin() as conn:
        # Create all tables defined in Base models (Users, CurrencyRates)
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """Provide a clean transactional session for each test case.

    Automatically rolls back transactions after each test completes.
    """
    session_factory = async_sessionmaker(
        bind=test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )
    async with session_factory() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def mock_redis() -> AsyncMock:
    """Mock Redis client to isolate caching behavior in testing."""
    redis = AsyncMock()
    redis.ping.return_value = True

    # Simple in-memory storage simulating cache behaviors
    cache_store = {}

    async def get_val(key: str) -> str | None:
        return cache_store.get(key)

    async def setex_val(key: str, _time: int, value: str) -> bool:
        cache_store[key] = value
        return True

    async def delete_val(*keys: str) -> int:
        count = 0
        for key in keys:
            if key in cache_store:
                del cache_store[key]
                count += 1
        return count

    redis.get.side_effect = get_val
    redis.setex.side_effect = setex_val
    redis.delete.side_effect = delete_val
    return redis


@pytest_asyncio.fixture
async def client(
    db_session: AsyncSession, mock_redis: AsyncMock
) -> AsyncGenerator[AsyncClient, None]:
    """HTTPX AsyncClient configured with overridden dependencies.

    Forces dependency injection calls to resolve to our test database
    session and mock Redis client rather than production pools.
    """
    app.dependency_overrides[get_db] = lambda: db_session
    app.dependency_overrides[get_redis] = lambda: mock_redis

    # ASGI Transport allows testing endpoints in-process without network overhead
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://testserver"
    ) as ac:
        yield ac

    app.dependency_overrides.clear()
