from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.currency.models import CurrencyRateHistory
from tests.test_history import create_user_and_get_token


@pytest.mark.anyio
async def test_trends_endpoint_unauthenticated(client: AsyncClient) -> None:
    """Verify that the trends endpoint returns 401 Unauthorized when unauthenticated."""
    resp = await client.get("/api/v1/analytics/trends?base=USD&target=EUR")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.anyio
async def test_trends_endpoint_success(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Verify rate trends retrieval, statistical summary, and percentage change.

    Validates calculations on database rate history logs.
    """
    token = await create_user_and_get_token(
        client, "trends_user@example.com", "password123"
    )
    headers = {"Authorization": f"Bearer {token}"}

    # Seed historical rates: 0.90 -> 0.95 -> 0.92
    now = datetime.now(UTC)
    rate1 = CurrencyRateHistory(
        base_currency="USD",
        target_currency="EUR",
        rate=0.90,
        timestamp=now - timedelta(days=2),
    )
    rate2 = CurrencyRateHistory(
        base_currency="USD",
        target_currency="EUR",
        rate=0.95,
        timestamp=now - timedelta(days=1),
    )
    rate3 = CurrencyRateHistory(
        base_currency="USD",
        target_currency="EUR",
        rate=0.92,
        timestamp=now,
    )
    db_session.add_all([rate1, rate2, rate3])
    await db_session.flush()

    # Query trends
    resp = await client.get(
        "/api/v1/analytics/trends?base=USD&target=EUR", headers=headers
    )
    assert resp.status_code == 200
    data = resp.json()

    assert data["base_currency"] == "USD"
    assert data["target_currency"] == "EUR"
    assert data["total"] == 3
    assert len(data["trends"]) == 3

    # Check trends list sorted by timestamp desc
    assert data["trends"][0]["rate"] == 0.92
    assert data["trends"][1]["rate"] == 0.95
    assert data["trends"][2]["rate"] == 0.90

    # Check stats
    stats = data["stats"]
    assert stats["min_rate"] == 0.90
    assert stats["max_rate"] == 0.95
    # Average rate is (0.90 + 0.95 + 0.92) / 3 = 0.9233333333333333
    assert abs(stats["average_rate"] - 0.923333) < 1e-5
    # Percentage change = ((0.92 - 0.90) / 0.90) * 100 = (0.02 / 0.90) * 100 = 2.222222%
    assert abs(stats["percentage_change"] - 2.222222) < 1e-5


@pytest.mark.anyio
async def test_trends_endpoint_date_filtering(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Verify trends endpoint respects date range filtering parameters."""
    token = await create_user_and_get_token(
        client, "trends_date@example.com", "password123"
    )
    headers = {"Authorization": f"Bearer {token}"}

    now = datetime.now(UTC)
    rate_old = CurrencyRateHistory(
        base_currency="USD",
        target_currency="EUR",
        rate=0.88,
        timestamp=now - timedelta(days=10),
    )
    rate_mid = CurrencyRateHistory(
        base_currency="USD",
        target_currency="EUR",
        rate=0.90,
        timestamp=now - timedelta(days=5),
    )
    rate_new = CurrencyRateHistory(
        base_currency="USD",
        target_currency="EUR",
        rate=0.92,
        timestamp=now - timedelta(days=1),
    )
    db_session.add_all([rate_old, rate_mid, rate_new])
    await db_session.flush()

    # Filter for the last 7 days (should exclude rate_old)
    start_date = (now - timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%SZ")
    resp = await client.get(
        f"/api/v1/analytics/trends?base=USD&target=EUR&start_date={start_date}",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    assert len(data["trends"]) == 2
    assert data["trends"][0]["rate"] == 0.92
    assert data["trends"][1]["rate"] == 0.90

    # Oldest in range is 0.90, latest is 0.92.
    # Percentage change = ((0.92 - 0.90) / 0.90) * 100 = 2.222222%
    assert abs(data["stats"]["percentage_change"] - 2.222222) < 1e-5


@pytest.mark.anyio
async def test_trends_endpoint_pagination(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Verify pagination returns correct subset of trend items."""
    token = await create_user_and_get_token(
        client, "trends_page@example.com", "password123"
    )
    headers = {"Authorization": f"Bearer {token}"}

    now = datetime.now(UTC)
    rates = [
        CurrencyRateHistory(
            base_currency="USD",
            target_currency="EUR",
            rate=0.90 + (i * 0.01),
            timestamp=now - timedelta(days=10 - i),
        )
        for i in range(5)
    ]
    db_session.add_all(rates)
    await db_session.flush()

    # Request page 1 with limit 2 (newest 2 rates)
    resp = await client.get(
        "/api/v1/analytics/trends?base=USD&target=EUR&page=1&limit=2",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 5
    assert len(data["trends"]) == 2
    assert data["page"] == 1
    assert data["limit"] == 2
    assert data["pages"] == 3

    # Request page 2 with limit 2
    resp = await client.get(
        "/api/v1/analytics/trends?base=USD&target=EUR&page=2&limit=2",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["trends"]) == 2
    assert data["page"] == 2


@pytest.mark.anyio
async def test_trends_endpoint_empty_db(client: AsyncClient) -> None:
    """Verify trends endpoint returns structured default values.

    Handles the scenario when no historical data matches query.
    """
    token = await create_user_and_get_token(
        client, "trends_empty@example.com", "password123"
    )
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.get(
        "/api/v1/analytics/trends?base=USD&target=EUR", headers=headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 0
    assert len(data["trends"]) == 0
    assert data["stats"]["average_rate"] == 0.0
    assert data["stats"]["percentage_change"] == 0.0


@pytest.mark.anyio
async def test_trends_endpoint_validation_errors(client: AsyncClient) -> None:
    """Verify parameter validations (e.g. currency length, numeric page bounds)."""
    token = await create_user_and_get_token(
        client, "trends_val@example.com", "password123"
    )
    headers = {"Authorization": f"Bearer {token}"}

    # Short currency code (422 validation error)
    resp = await client.get(
        "/api/v1/analytics/trends?base=US&target=EUR", headers=headers
    )
    assert resp.status_code == 422

    # Negative page parameter
    resp = await client.get(
        "/api/v1/analytics/trends?base=USD&target=EUR&page=-1", headers=headers
    )
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_trends_endpoint_caching_and_invalidation(
    client: AsyncClient, db_session: AsyncSession, mock_redis: AsyncMock
) -> None:
    """Verify caching responses in Redis and invalidating them on rate update."""
    token = await create_user_and_get_token(
        client, "trends_cache@example.com", "password123"
    )
    headers = {"Authorization": f"Bearer {token}"}

    cache_store = {}

    async def mock_get(key: str) -> str | None:
        return cache_store.get(key)

    async def mock_setex(key: str, _time: int, value: str) -> bool:
        cache_store[key] = value
        return True

    async def mock_delete(*keys: str) -> int:
        count = 0
        for k in keys:
            if k in cache_store:
                del cache_store[k]
                count += 1
        return count

    import fnmatch

    async def mock_keys_func(pattern: str) -> list[str]:
        return [k for k in cache_store.keys() if fnmatch.fnmatch(k, pattern)]

    mock_redis.get.side_effect = mock_get
    mock_redis.setex.side_effect = mock_setex
    mock_redis.delete.side_effect = mock_delete
    mock_redis.keys.side_effect = mock_keys_func

    now = datetime.now(UTC)
    rate = CurrencyRateHistory(
        base_currency="USD",
        target_currency="EUR",
        rate=0.91,
        timestamp=now,
    )
    db_session.add(rate)
    await db_session.flush()

    # 1. First request triggers cache miss and populates cache
    resp1 = await client.get(
        "/api/v1/analytics/trends?base=USD&target=EUR", headers=headers
    )
    assert resp1.status_code == 200
    data1 = resp1.json()
    assert data1["trends"][0]["rate"] == 0.91

    # 2. Modify rate directly in DB (simulate cache read from Redis returns old value)
    rate.rate = 0.99
    await db_session.flush()

    # Second request should be a Cache Hit and return old rate (0.91)
    resp2 = await client.get(
        "/api/v1/analytics/trends?base=USD&target=EUR", headers=headers
    )
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2["trends"][0]["rate"] == 0.91

    # 3. Update rate using POST /api/v1/currencies/rates (triggers cache invalidation)
    update_resp = await client.post(
        "/api/v1/currencies/rates",
        json={"base_currency": "USD", "target_currency": "EUR", "rate": 0.95},
        headers=headers,
    )
    assert update_resp.status_code == 200

    # 4. Third request should be a Cache Miss and return updated state (0.95)
    resp3 = await client.get(
        "/api/v1/analytics/trends?base=USD&target=EUR", headers=headers
    )
    assert resp3.status_code == 200
    data3 = resp3.json()
    # The newest history log entry added during post is 0.95
    assert data3["trends"][0]["rate"] == 0.95
