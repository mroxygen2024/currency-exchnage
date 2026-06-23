import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.currency.models import CurrencyConversion, CurrencyRate


@pytest.mark.anyio
async def test_convert_same_currency(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Verify that converting to the same currency yields a 1.0 rate and records it."""
    response = await client.get("/api/v1/currencies/convert?from=USD&to=USD&amount=100")
    assert response.status_code == 200
    data = response.json()
    assert data["from_currency"] == "USD"
    assert data["to_currency"] == "USD"
    assert data["amount"] == 100.0
    assert data["rate"] == 1.0
    assert data["result"] == 100.0

    # Verify database conversion history record
    stmt = select(CurrencyConversion).where(CurrencyConversion.id == data["id"])
    result = await db_session.execute(stmt)
    conversion = result.scalar_one()
    assert conversion.from_currency == "USD"
    assert conversion.to_currency == "USD"
    assert conversion.amount == 100.0
    assert conversion.rate == 1.0
    assert conversion.result == 100.0


@pytest.mark.anyio
async def test_convert_direct_rate(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Verify that a direct rate lookup is used for conversion and recorded."""
    # Seed direct rate
    rate = CurrencyRate(base_currency="USD", target_currency="EUR", rate=0.92)
    db_session.add(rate)
    await db_session.flush()

    response = await client.get("/api/v1/currencies/convert?from=USD&to=EUR&amount=100")
    assert response.status_code == 200
    data = response.json()
    assert data["from_currency"] == "USD"
    assert data["to_currency"] == "EUR"
    assert data["amount"] == 100.0
    assert data["rate"] == 0.92
    assert data["result"] == 92.0

    # Verify database conversion history record
    stmt = select(CurrencyConversion).where(CurrencyConversion.id == data["id"])
    result = await db_session.execute(stmt)
    conversion = result.scalar_one()
    assert conversion.from_currency == "USD"
    assert conversion.to_currency == "EUR"
    assert conversion.amount == 100.0
    assert float(conversion.rate) == 0.92
    assert float(conversion.result) == 92.0


@pytest.mark.anyio
async def test_convert_inverse_rate(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Verify that the inverse rate is calculated and used if direct rate is missing."""
    # Seed USD to EUR rate (0.8)
    rate = CurrencyRate(base_currency="USD", target_currency="EUR", rate=0.8)
    db_session.add(rate)
    await db_session.flush()

    # Convert EUR to USD (inverse rate should be 1.0 / 0.8 = 1.25)
    response = await client.get("/api/v1/currencies/convert?from=EUR&to=USD&amount=80")
    assert response.status_code == 200
    data = response.json()
    assert data["from_currency"] == "EUR"
    assert data["to_currency"] == "USD"
    assert data["amount"] == 80.0
    assert data["rate"] == 1.25
    assert data["result"] == 100.0

    # Verify database conversion history record
    stmt = select(CurrencyConversion).where(CurrencyConversion.id == data["id"])
    result = await db_session.execute(stmt)
    conversion = result.scalar_one()
    assert float(conversion.rate) == 1.25
    assert float(conversion.result) == 100.0


@pytest.mark.anyio
async def test_convert_cross_rate(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Verify cross-rate calculation via common base currencies."""
    # Seed USD -> EUR (0.9), USD -> ETB (110.0)
    rate1 = CurrencyRate(base_currency="USD", target_currency="EUR", rate=0.9)
    rate2 = CurrencyRate(base_currency="USD", target_currency="ETB", rate=110.0)
    db_session.add_all([rate1, rate2])
    await db_session.flush()

    # Convert EUR to ETB (rate = 110.0 / 0.9 = 122.222222)
    response = await client.get("/api/v1/currencies/convert?from=EUR&to=ETB&amount=90")
    assert response.status_code == 200
    data = response.json()
    assert data["from_currency"] == "EUR"
    assert data["to_currency"] == "ETB"
    assert data["amount"] == 90.0
    assert abs(data["rate"] - 122.222222) < 1e-5
    assert abs(data["result"] - 11000.0) < 1e-5


@pytest.mark.anyio
async def test_convert_validation_errors(client: AsyncClient) -> None:
    """Verify parameter validations (e.g. amount, format) trigger 422 errors."""
    # Test negative amount
    response = await client.get("/api/v1/currencies/convert?from=USD&to=EUR&amount=-50")
    assert response.status_code == 422

    # Test short currency code
    response = await client.get("/api/v1/currencies/convert?from=US&to=EUR&amount=100")
    assert response.status_code == 422

    # Test currency code containing numbers
    response = await client.get("/api/v1/currencies/convert?from=USD&to=EU1&amount=100")
    assert response.status_code == 422


@pytest.mark.anyio
async def test_convert_rate_not_found(client: AsyncClient) -> None:
    """Verify that a 404 is returned if no rate path is found between currencies."""
    response = await client.get("/api/v1/currencies/convert?from=USD&to=ETB&amount=100")
    assert response.status_code == 404
    data = response.json()
    assert data["success"] is False
    assert data["error"]["code"] == "NOT_FOUND"


@pytest.mark.anyio
async def test_get_rate_redis_failure(db_session: AsyncSession) -> None:
    """Verify get_rate handles Redis failures gracefully by falling back to DB."""
    from unittest.mock import AsyncMock

    from app.modules.currency.models import CurrencyRate
    from app.modules.currency.services import get_rate

    # Seed DB
    rate = CurrencyRate(base_currency="GBP", target_currency="USD", rate=1.25)
    db_session.add(rate)
    await db_session.flush()

    # Mock Redis failing on get
    mock_redis = AsyncMock()
    mock_redis.get.side_effect = Exception("Redis get failed")

    # Mock Redis setex succeeding
    mock_redis.setex.return_value = True

    res = await get_rate(db_session, mock_redis, "GBP", "USD")
    assert res is not None
    assert float(res.rate) == 1.25
    mock_redis.get.assert_called_once()


@pytest.mark.anyio
async def test_get_rate_redis_setex_failure(db_session: AsyncSession) -> None:
    """Verify get_rate handles Redis cache update failures gracefully."""
    from unittest.mock import AsyncMock

    from app.modules.currency.models import CurrencyRate
    from app.modules.currency.services import get_rate

    # Seed DB
    rate = CurrencyRate(base_currency="GBP", target_currency="EUR", rate=1.15)
    db_session.add(rate)
    await db_session.flush()

    # Mock Redis get returns None (miss), setex raises exception
    mock_redis = AsyncMock()
    mock_redis.get.return_value = None
    mock_redis.setex.side_effect = Exception("Redis setex failed")

    res = await get_rate(db_session, mock_redis, "GBP", "EUR")
    assert res is not None
    assert float(res.rate) == 1.15
    mock_redis.setex.assert_called_once()


@pytest.mark.anyio
async def test_update_or_create_rate_existing_and_redis_failure(
    db_session: AsyncSession,
) -> None:
    """Verify update_or_create_rate updates DB and handles Redis setex failure."""
    from unittest.mock import AsyncMock

    from app.modules.currency.models import CurrencyRate
    from app.modules.currency.services import update_or_create_rate

    # Seed DB
    rate = CurrencyRate(base_currency="JPY", target_currency="USD", rate=0.007)
    db_session.add(rate)
    await db_session.flush()

    # Mock Redis failing on setex
    mock_redis = AsyncMock()
    mock_redis.setex.side_effect = Exception("Redis setex failed")

    res = await update_or_create_rate(db_session, mock_redis, "JPY", "USD", 0.008)
    assert res is not None
    assert float(res.rate) == 0.008

    # Verify updated in DB
    from sqlalchemy import select

    stmt = select(CurrencyRate).where(
        CurrencyRate.base_currency == "JPY", CurrencyRate.target_currency == "USD"
    )
    db_res = (await db_session.execute(stmt)).scalar_one()
    assert float(db_res.rate) == 0.008


@pytest.mark.anyio
async def test_sync_exchange_rate_task_success(db_session: AsyncSession) -> None:
    """Verify sync_exchange_rate_task executes successfully."""
    from unittest.mock import AsyncMock

    from sqlalchemy import select

    from app.modules.currency.models import CurrencyRate
    from app.modules.currency.tasks import sync_exchange_rate_task

    mock_redis = AsyncMock()
    mock_redis.setex.return_value = True

    await sync_exchange_rate_task("USD", "CAD", 1.35, db_session, mock_redis)

    # Verify rate is in DB
    stmt = select(CurrencyRate).where(
        CurrencyRate.base_currency == "USD", CurrencyRate.target_currency == "CAD"
    )
    db_res = (await db_session.execute(stmt)).scalar_one()
    assert float(db_res.rate) == 1.35


@pytest.mark.anyio
async def test_sync_exchange_rate_task_failure() -> None:
    """Verify sync_exchange_rate_task raises exception if service fails."""
    from unittest.mock import AsyncMock

    from app.modules.currency.tasks import sync_exchange_rate_task

    mock_redis = AsyncMock()
    mock_db = AsyncMock()
    mock_db.execute.side_effect = Exception("DB Flush error")

    with pytest.raises(Exception) as excinfo:
        await sync_exchange_rate_task("USD", "CAD", 1.35, mock_db, mock_redis)
    assert "DB Flush error" in str(excinfo.value)


@pytest.mark.anyio
async def test_websocket_broadcast_failure() -> None:
    """Verify WebSocketManager handles send_json exceptions by disconnecting client."""
    from unittest.mock import AsyncMock

    from app.modules.currency.websocket import ws_manager

    mock_ws = AsyncMock()
    mock_ws.send_json.side_effect = Exception("Send failed")

    # Connect client
    ws_manager.active_connections["TESTPAIR"] = {mock_ws}

    # Broadcast
    await ws_manager.broadcast_to_channel("TESTPAIR", {"test": "data"})

    # Verify disconnected
    assert "TESTPAIR" not in ws_manager.active_connections


@pytest.mark.anyio
async def test_currency_service_get_rate_cache_hit(db_session: AsyncSession) -> None:
    """Verify get_rate returns cached rate directly on cache hit."""
    from unittest.mock import AsyncMock

    from app.modules.currency.services import get_rate

    mock_redis = AsyncMock()
    mock_redis.get.return_value = "1.50"

    res = await get_rate(db_session, mock_redis, "EUR", "USD")
    assert res is not None
    assert res.base_currency == "EUR"
    assert res.target_currency == "USD"
    assert float(res.rate) == 1.50
    mock_redis.get.assert_called_once()


@pytest.mark.anyio
async def test_currency_service_list_rates(db_session: AsyncSession) -> None:
    """Verify list_rates returns all records in DB."""
    from app.modules.currency.models import CurrencyRate
    from app.modules.currency.services import list_rates

    rate1 = CurrencyRate(base_currency="USD", target_currency="EUR", rate=0.92)
    rate2 = CurrencyRate(base_currency="EUR", target_currency="GBP", rate=0.85)
    db_session.add_all([rate1, rate2])
    await db_session.flush()

    res = await list_rates(db_session)
    assert len(res) >= 2
    currencies = [(r.base_currency, r.target_currency) for r in res]
    assert ("USD", "EUR") in currencies
    assert ("EUR", "GBP") in currencies


@pytest.mark.anyio
async def test_currency_service_convert_currency_validations(
    db_session: AsyncSession,
) -> None:
    """Verify convert_currency validation errors."""
    from unittest.mock import AsyncMock

    from app.core.exceptions import BadRequestException
    from app.modules.currency.services import convert_currency

    mock_redis = AsyncMock()

    # Invalid code format
    with pytest.raises(BadRequestException) as excinfo:
        await convert_currency(db_session, mock_redis, "US", "EUR", 100.0)
    assert "exactly 3-character" in excinfo.value.message

    # Invalid amount
    with pytest.raises(BadRequestException) as excinfo:
        await convert_currency(db_session, mock_redis, "USD", "EUR", -5.0)
    assert "greater than zero" in excinfo.value.message


@pytest.mark.anyio
async def test_currency_service_convert_currency_cross_rates(
    db_session: AsyncSession,
) -> None:
    """Verify cross rates logic and inverse rates directly."""
    from unittest.mock import AsyncMock

    from app.modules.currency.models import CurrencyRate
    from app.modules.currency.services import convert_currency

    mock_redis = AsyncMock()
    mock_redis.get.return_value = None

    # Seed cross-rate USD -> EUR (0.9), USD -> GBP (0.8)
    rate1 = CurrencyRate(base_currency="USD", target_currency="EUR", rate=0.9)
    rate2 = CurrencyRate(base_currency="USD", target_currency="GBP", rate=0.8)
    db_session.add_all([rate1, rate2])
    await db_session.flush()

    res = await convert_currency(db_session, mock_redis, "EUR", "GBP", 90.0)
    assert res.from_currency == "EUR"
    assert res.to_currency == "GBP"
    assert abs(res.rate - (0.8 / 0.9)) < 1e-5


@pytest.mark.anyio
async def test_currency_service_history_operations(db_session: AsyncSession) -> None:
    """Verify list_history, get_history_by_id, and delete_history operations."""
    from unittest.mock import AsyncMock

    from app.core.exceptions import (
        BadRequestException,
        ForbiddenException,
        NotFoundException,
    )
    from app.modules.auth.models import User
    from app.modules.currency.models import CurrencyRate
    from app.modules.currency.services import (
        convert_currency,
        delete_history,
        get_history_by_id,
        list_history,
    )

    mock_redis = AsyncMock()
    mock_redis.get.return_value = None

    # Seed user and rate
    user = User(
        email="history_user@example.com",
        hashed_password="pwd",
        is_active=True,
        role="user",
    )
    admin = User(
        email="history_admin@example.com",
        hashed_password="pwd",
        is_active=True,
        role="admin",
    )
    other_user = User(
        email="other_user@example.com",
        hashed_password="pwd",
        is_active=True,
        role="user",
    )

    rate = CurrencyRate(base_currency="USD", target_currency="JPY", rate=150.0)
    db_session.add_all([user, admin, other_user, rate])
    await db_session.flush()

    # Create history entry
    conv1 = await convert_currency(
        db_session, mock_redis, "USD", "JPY", 10.0, user_id=user.id
    )
    await convert_currency(
        db_session, mock_redis, "USD", "JPY", 20.0, user_id=other_user.id
    )

    # 1. List history for standard user (only own)
    history_res = await list_history(db_session, user)
    assert history_res["total"] == 1
    assert history_res["items"][0].id == conv1.id

    # 2. List history for admin (all)
    admin_history_res = await list_history(db_session, admin)
    assert admin_history_res["total"] == 2

    # 2b. List history with filter
    filtered_history = await list_history(db_session, admin, filter_user_id=user.id)
    assert filtered_history["total"] == 1

    # 2c. List history with sorting options
    with pytest.raises(BadRequestException):
        await list_history(db_session, user, sort_by="invalid_field")
    with pytest.raises(BadRequestException):
        await list_history(db_session, user, sort_order="invalid_order")

    sorted_history = await list_history(
        db_session, user, sort_by="amount", sort_order="asc"
    )
    assert sorted_history["total"] == 1

    # 3. Get history by ID success (owner)
    get_res = await get_history_by_id(db_session, conv1.id, user)
    assert get_res.id == conv1.id

    # 4. Get history by ID success (admin)
    admin_get_res = await get_history_by_id(db_session, conv1.id, admin)
    assert admin_get_res.id == conv1.id

    # 5. Get history by ID Forbidden (not owner)
    with pytest.raises(ForbiddenException):
        await get_history_by_id(db_session, conv1.id, other_user)

    # 6. Get history by ID Not Found
    with pytest.raises(NotFoundException):
        await get_history_by_id(db_session, 99999, user)

    # 7. Delete history Forbidden (not owner)
    with pytest.raises(ForbiddenException):
        await delete_history(db_session, conv1.id, other_user)

    # 8. Delete history success
    await delete_history(db_session, conv1.id, user)
    with pytest.raises(NotFoundException):
        await get_history_by_id(db_session, conv1.id, user)
