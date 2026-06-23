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
