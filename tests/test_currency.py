import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.currency.models import CurrencyRate, CurrencyConversion


@pytest.mark.anyio
async def test_convert_same_currency(client: AsyncClient, db_session: AsyncSession) -> None:
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
async def test_convert_direct_rate(client: AsyncClient, db_session: AsyncSession) -> None:
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
async def test_convert_inverse_rate(client: AsyncClient, db_session: AsyncSession) -> None:
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
async def test_convert_cross_rate(client: AsyncClient, db_session: AsyncSession) -> None:
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
