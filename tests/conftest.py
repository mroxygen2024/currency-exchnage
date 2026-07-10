from collections.abc import AsyncGenerator
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Force environment to 'testing' for all tests
from app.core.config import settings

settings.ENV = "testing"

from app.core.database import Base, get_db  # noqa: E402
from app.core.redis import get_redis  # noqa: E402
from app.main import app  # noqa: E402

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
        # Mock session.commit to perform session.flush instead,
        # preventing permanent commits during tests and isolating
        # all database changes to the current test case.
        original_commit = session.commit

        async def mock_commit():
            await session.flush()

        session.commit = mock_commit

        import app.core.database

        app.core.database.CURRENT_TEST_DB = session
        try:
            yield session
        finally:
            app.core.database.CURRENT_TEST_DB = None
            session.commit = original_commit
            await session.rollback()


@pytest.fixture(autouse=True)
def mock_exchange_rate_provider(monkeypatch) -> None:  # noqa: E501
    """Mock the exchange rate provider factory for all tests."""
    from app.modules.currency.providers.base import BaseExchangeRateProvider

    class MockProvider(BaseExchangeRateProvider):  # noqa: ARG001
        async def get_latest_rates(
            self, base: str, symbols: list[str] | None = None
        ) -> dict[str, float]:
            _ = base, symbols
            return {}

        async def get_historical_rates(
            self, date: str, base: str, symbols: list[str] | None = None
        ) -> dict[str, float]:
            _ = date, base, symbols
            return {}

        async def convert(
            self,
            from_currency: str,
            to_currency: str,
            amount: float,
            date: str | None = None,
        ) -> dict:
            _ = from_currency, to_currency, amount, date
            raise Exception("Mock conversion rate not found")

        async def get_timeseries(
            self,
            start_date: str,
            end_date: str,
            base: str,
            symbols: list[str] | None = None,
        ) -> dict[str, dict[str, float]]:
            _ = start_date, end_date, base, symbols
            return {}

        async def get_supported_currencies(self) -> dict[str, str]:
            return {
                "USD": "United States Dollar",
                "EUR": "Euro",
                "GBP": "British Pound Sterling",
                "JPY": "Japanese Yen",
                "CAD": "Canadian Dollar",
                "ETB": "Ethiopian Birr",
            }

    monkeypatch.setattr(
        "app.modules.currency.providers.get_exchange_rate_provider",
        lambda: MockProvider(),
    )
    monkeypatch.setattr(
        "app.modules.currency.services.get_exchange_rate_provider",
        lambda: MockProvider(),
    )


@pytest.fixture(autouse=True)
def mock_celery_delay(monkeypatch) -> None:
    """Monkeypatch Celery .delay methods to run synchronously."""
    from app.modules.notifications.tasks import (
        check_threshold_alerts_celery_task,
        check_threshold_alerts_task,
        send_alert_email_celery_task,
        send_alert_email_task,
        send_daily_summary_celery_task,
        send_daily_summary_task,
    )
    from app.tasks.celery_app import run_async

    def mock_delay_send_alert(
        recipient_email: str,
        base: str,
        target: str,
        current_rate: float,
        threshold: float,
        condition: str,
    ):
        run_async(
            send_alert_email_task(
                recipient_email=recipient_email,
                base=base,
                target=target,
                current_rate=current_rate,
                threshold=threshold,
                condition=condition,
            )
        )

    def mock_delay_send_daily(
        recipient_email: str,
        pairs_data: list[dict],
    ):
        run_async(
            send_daily_summary_task(
                recipient_email=recipient_email,
                pairs_data=pairs_data,
            )
        )

    def mock_delay_check_alerts(
        base: str,
        target: str,
        current_rate: float,
    ):
        import app.core.database

        run_async(
            check_threshold_alerts_task(
                base=base,
                target=target,
                current_rate=current_rate,
                db=app.core.database.CURRENT_TEST_DB,
            )
        )

    monkeypatch.setattr(send_alert_email_celery_task, "delay", mock_delay_send_alert)
    monkeypatch.setattr(send_daily_summary_celery_task, "delay", mock_delay_send_daily)
    monkeypatch.setattr(
        check_threshold_alerts_celery_task, "delay", mock_delay_check_alerts
    )


class MockPipeline:
    """Mock Redis pipeline for simulating transaction blocks in tests."""

    def __init__(self, cache_store: dict):
        self.cache_store = cache_store
        self.commands = []

    def incr(self, key: str):
        self.commands.append(("incr", key))
        return self

    def ttl(self, key: str):
        self.commands.append(("ttl", key))
        return self

    async def execute(self):
        results = []
        for cmd, key in self.commands:
            if cmd == "incr":
                val = self.cache_store.get(key, 0)
                if isinstance(val, str):
                    try:
                        val = int(val)
                    except ValueError:
                        val = 0
                val += 1
                self.cache_store[key] = str(val)
                results.append(val)
            elif cmd == "ttl":
                # Return a default mock TTL of 60 seconds (or -1 if first time)
                # For rate limit, if it is the first increment (making it 1),
                # we simulate -1 so the code sets the expiration.
                val = int(self.cache_store.get(key, 0))
                results.append(-1 if val <= 1 else 60)
        self.commands = []
        return results

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass


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

    async def expire_val(_key: str, _seconds: int) -> bool:
        return True

    redis.get.side_effect = get_val
    redis.setex.side_effect = setex_val
    redis.delete.side_effect = delete_val
    redis.expire.side_effect = expire_val
    from unittest.mock import MagicMock

    redis.pipeline = MagicMock()
    redis.pipeline.side_effect = lambda **_kw: MockPipeline(cache_store)
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
        transport=ASGITransport(app=app, raise_app_exceptions=False),
        base_url="http://testserver",
    ) as ac:
        from app.core.redis import redis_manager

        original_client = redis_manager.client
        redis_manager.client = mock_redis
        try:
            yield ac
        finally:
            redis_manager.client = original_client

    app.dependency_overrides.clear()
