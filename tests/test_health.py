from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient


@pytest.mark.anyio
async def test_health_check_endpoint(client: AsyncClient) -> None:
    """Verify that the GET /health endpoint correctly reports service statuses."""
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["services"]["database"] == "up"
    assert data["services"]["cache"] == "up"


@pytest.mark.anyio
async def test_health_check_db_failure(client: AsyncClient) -> None:
    """Verify health check reports db down when database query fails."""
    from unittest.mock import AsyncMock

    from app.core.database import get_db
    from app.main import app

    mock_db = AsyncMock()
    mock_db.execute.side_effect = Exception("DB Connection Refused")
    app.dependency_overrides[get_db] = lambda: mock_db

    response = await client.get("/api/v1/health")
    assert response.status_code == 503
    data = response.json()
    assert data["status"] == "unhealthy"
    assert data["services"]["database"] == "down"
    assert data["services"]["cache"] == "up"


@pytest.mark.anyio
async def test_health_check_redis_failure(
    client: AsyncClient, mock_redis: AsyncMock
) -> None:
    """Verify health check reports cache down when Redis throws exception."""
    mock_redis.ping.side_effect = Exception("Redis connection lost")

    response = await client.get("/api/v1/health")
    assert response.status_code == 503
    data = response.json()
    assert data["status"] == "unhealthy"
    assert data["services"]["database"] == "up"
    assert data["services"]["cache"] == "down"


@pytest.mark.anyio
async def test_health_check_redis_ping_false(
    client: AsyncClient, mock_redis: AsyncMock
) -> None:
    """Verify health check reports cache down when Redis ping returns False."""
    mock_redis.ping.return_value = False

    response = await client.get("/api/v1/health")
    assert response.status_code == 503
    data = response.json()
    assert data["status"] == "unhealthy"
    assert data["services"]["database"] == "up"
    assert data["services"]["cache"] == "down"


@pytest.mark.anyio
async def test_health_check_both_failures(
    client: AsyncClient, mock_redis: AsyncMock
) -> None:
    """Verify health check reports both down when both services fail."""
    from unittest.mock import AsyncMock

    from app.core.database import get_db
    from app.main import app

    mock_db = AsyncMock()
    mock_db.execute.side_effect = Exception("DB down")
    app.dependency_overrides[get_db] = lambda: mock_db

    mock_redis.ping.side_effect = Exception("Redis down")

    response = await client.get("/api/v1/health")
    assert response.status_code == 503
    data = response.json()
    assert data["status"] == "unhealthy"
    assert data["services"]["database"] == "down"
    assert data["services"]["cache"] == "down"
