import json
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.modules.auth.models import User
from app.modules.currency.models import CurrencyConversion, CurrencyRate
from app.modules.currency.services import (
    convert_currency,
    delete_history,
    get_analytics,
    get_rate,
    update_or_create_rate,
)
from tests.test_history import create_user_and_get_token


@pytest.mark.anyio
async def test_exchange_rate_caching_and_expiration(
    db_session: AsyncSession, mock_redis: AsyncMock
) -> None:
    """Verify that get_rate caches rates, hits cache subsequently,
    uses 10-minute expiration, and invalidates on update.
    """
    # 1. Seed rate in PostgreSQL
    rate = CurrencyRate(base_currency="USD", target_currency="GBP", rate=0.80)
    db_session.add(rate)
    await db_session.flush()

    # Clear mock calls before starting
    mock_redis.get.reset_mock()
    mock_redis.setex.reset_mock()

    # 2. First call: Cache miss (queries DB and caches the rate)
    res1 = await get_rate(db_session, mock_redis, "USD", "GBP")
    assert res1 is not None
    assert float(res1.rate) == 0.80
    mock_redis.get.assert_called_once_with("rate:USD:GBP")
    # Cache now stores JSON with id, rate, last_updated
    setex_args = mock_redis.setex.call_args
    assert setex_args[0][0] == "rate:USD:GBP"
    assert setex_args[0][1] == settings.CACHE_EXPIRE_SECONDS
    cached_payload = json.loads(setex_args[0][2])
    assert cached_payload["rate"] == 0.80
    assert settings.CACHE_EXPIRE_SECONDS == 600  # 10 minutes

    # Reset mock call counters
    mock_redis.get.reset_mock()
    mock_redis.setex.reset_mock()

    # 3. Update the rate directly in the DB bypass-cache style to test cache hit
    stmt = (
        update(CurrencyRate)
        .where(
            CurrencyRate.base_currency == "USD", CurrencyRate.target_currency == "GBP"
        )
        .values(rate=0.85)
    )
    await db_session.execute(stmt)
    await db_session.flush()

    # 4. Second call: Cache hit (returns the cached value 0.80, not the DB's 0.85)
    res2 = await get_rate(db_session, mock_redis, "USD", "GBP")
    assert res2 is not None
    assert float(res2.rate) == 0.80  # Cached value
    mock_redis.get.assert_called_once_with("rate:USD:GBP")
    mock_redis.setex.assert_not_called()  # Did not rewrite the cache

    # 5. Perform clean update using the service, which updates the cache
    await update_or_create_rate(db_session, mock_redis, "USD", "GBP", 0.90)
    setex_args2 = mock_redis.setex.call_args
    assert setex_args2[0][0] == "rate:USD:GBP"
    assert setex_args2[0][1] == settings.CACHE_EXPIRE_SECONDS
    cached_payload2 = json.loads(setex_args2[0][2])
    assert cached_payload2["rate"] == 0.90

    # 6. Third call: Cache hit with updated value
    res3 = await get_rate(db_session, mock_redis, "USD", "GBP")
    assert res3 is not None
    assert float(res3.rate) == 0.90


@pytest.mark.anyio
async def test_analytics_caching_and_invalidation(
    db_session: AsyncSession, mock_redis: AsyncMock
) -> None:
    """Verify that analytics endpoint caches results, hits cache,
    and invalidates correctly on conversions.
    """
    # Seed a rate and user
    rate = CurrencyRate(base_currency="USD", target_currency="EUR", rate=0.90)
    user = User(
        email="analytics_test@example.com",
        hashed_password="pwd",
        is_active=True,
        role="user",
    )
    db_session.add_all([rate, user])
    await db_session.flush()

    # 1. Perform conversion using service (should write to DB
    # and invalidate analytics cache)
    await convert_currency(db_session, mock_redis, "USD", "EUR", 100.0, user_id=user.id)

    # Reset mock calls
    mock_redis.get.reset_mock()
    mock_redis.setex.reset_mock()

    # 2. Request analytics: Cache miss
    analytics1 = await get_analytics(db_session, mock_redis)
    assert analytics1["total_conversions"] == 1
    assert analytics1["total_volume_by_currency"]["USD"] == 100.0
    mock_redis.get.assert_called_once_with("analytics:global")
    mock_redis.setex.assert_called_once_with(
        "analytics:global", settings.CACHE_EXPIRE_SECONDS, json.dumps(analytics1)
    )

    # Reset mock calls
    mock_redis.get.reset_mock()
    mock_redis.setex.reset_mock()

    # 3. Manually insert another conversion record directly to DB to bypass invalidation
    manual_conv = CurrencyConversion(
        user_id=user.id,
        from_currency="USD",
        to_currency="EUR",
        amount=50.0,
        rate=0.90,
        result=45.0,
    )
    db_session.add(manual_conv)
    await db_session.flush()

    # 4. Request analytics again: Cache hit (returns cached data
    # with 1 conversion, not 2)
    analytics2 = await get_analytics(db_session, mock_redis)
    assert analytics2["total_conversions"] == 1
    mock_redis.get.assert_called_once_with("analytics:global")
    mock_redis.setex.assert_not_called()

    # 5. Perform another conversion through the service (invalidates cache)
    mock_redis.delete.reset_mock()
    await convert_currency(db_session, mock_redis, "USD", "EUR", 10.0, user_id=user.id)
    mock_redis.delete.assert_called_with("analytics:global")

    # 6. Request analytics: Cache miss (recomputes, returning all 3 conversions)
    mock_redis.get.reset_mock()
    analytics3 = await get_analytics(db_session, mock_redis)
    assert analytics3["total_conversions"] == 3
    assert analytics3["total_volume_by_currency"]["USD"] == 160.0  # 100 + 50 + 10

    # 7. Delete conversion through service (invalidates cache)
    mock_redis.delete.reset_mock()
    await delete_history(db_session, mock_redis, manual_conv.id, user)
    mock_redis.delete.assert_called_with("analytics:global")

    # 8. Request analytics: Cache miss (recomputes, returning 2 conversions)
    analytics4 = await get_analytics(db_session, mock_redis)
    assert analytics4["total_conversions"] == 2
    assert analytics4["total_volume_by_currency"]["USD"] == 110.0  # 100 + 10


@pytest.mark.anyio
async def test_graceful_redis_failures(
    db_session: AsyncSession, mock_redis: AsyncMock
) -> None:
    """Verify that Redis connection failures do not break database-backed
    lookups and conversions.
    """
    # Seed rate and user
    rate = CurrencyRate(base_currency="GBP", target_currency="USD", rate=1.25)
    user = User(
        email="redis_fail_test@example.com",
        hashed_password="pwd",
        is_active=True,
        role="user",
    )
    db_session.add_all([rate, user])
    await db_session.flush()

    # Mock Redis raising exceptions for all operations
    mock_redis.get.side_effect = Exception("Redis connection refused")
    mock_redis.setex.side_effect = Exception("Redis connection refused")
    mock_redis.delete.side_effect = Exception("Redis connection refused")

    # 1. Fetch rate: should fall back to DB gracefully
    res_rate = await get_rate(db_session, mock_redis, "GBP", "USD")
    assert res_rate is not None
    assert float(res_rate.rate) == 1.25

    # 2. Perform conversion: should succeed and fall back to DB
    conv = await convert_currency(
        db_session, mock_redis, "GBP", "USD", 10.0, user_id=user.id
    )
    assert conv is not None
    assert float(conv.result) == 12.5

    # 3. Get analytics: should succeed by querying DB directly
    analytics = await get_analytics(db_session, mock_redis)
    assert analytics is not None
    assert analytics["total_conversions"] == 1

    # 4. Delete history: should succeed
    await delete_history(db_session, mock_redis, conv.id, user)
    # Verify indeed deleted
    stmt = select(CurrencyConversion).where(CurrencyConversion.id == conv.id)
    deleted_check = (await db_session.execute(stmt)).scalar_one_or_none()
    assert deleted_check is None


@pytest.mark.anyio
async def test_analytics_api_endpoint(client: AsyncClient) -> None:
    """Integration test: Verify the GET /api/v1/currencies/analytics endpoint."""
    token = await create_user_and_get_token(
        client, "api_analytics@example.com", "password123"
    )
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Access without credentials (should fail with 401)
    resp_unauth = await client.get("/api/v1/currencies/analytics")
    assert resp_unauth.status_code == 401

    # 2. Access with credentials (should succeed with 200)
    resp = await client.get("/api/v1/currencies/analytics", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "total_conversions" in data
    assert "popular_pairs" in data
    assert "total_volume_by_currency" in data
