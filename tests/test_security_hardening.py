from unittest.mock import patch

import pytest
from httpx import AsyncClient

from app.core.config import settings


@pytest.mark.anyio
async def test_request_id_and_security_headers(client: AsyncClient) -> None:
    """Verify that every response has a Request ID and security headers."""
    response = await client.get("/api/v1/health")
    assert response.status_code == 200

    # Request ID
    assert "X-Request-ID" in response.headers
    request_id = response.headers["X-Request-ID"]
    assert len(request_id) > 0

    # Security Headers
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-XSS-Protection"] == "1; mode=block"
    assert response.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"
    assert "Content-Security-Policy" in response.headers
    assert "default-src 'none'" in response.headers["Content-Security-Policy"]


@pytest.mark.anyio
async def test_hsts_header_in_production(client: AsyncClient, monkeypatch) -> None:
    """Verify that Strict-Transport-Security is injected in production."""
    monkeypatch.setattr(settings, "ENV", "production")
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    assert "Strict-Transport-Security" in response.headers
    assert "max-age=63072000" in response.headers["Strict-Transport-Security"]


@pytest.mark.anyio
async def test_global_exception_handler_formatting(client: AsyncClient) -> None:
    """Verify that Starlette HTTPExceptions are formatted as JSON."""
    response = await client.get("/api/v1/non-existent-route-for-testing")
    assert response.status_code == 404
    data = response.json()
    assert data["success"] is False
    assert data["error"]["code"] == "HTTP_404"
    assert "Not Found" in data["error"]["message"]


@pytest.mark.anyio
async def test_rate_limiter_block(client: AsyncClient) -> None:
    """Verify that exceeding the rate limit triggers HTTP 429."""
    headers = {"x-test-rate-limit": "true"}

    # We simulate 11 login requests to exhaust the limit of 10.
    # The first 10 will fail with validation error or unauthorized, not 429.
    for i in range(11):
        response = await client.post(
            "/api/v1/auth/login",
            data={"username": "test@example.com", "password": "password123"},
            headers=headers,
        )
        if i < 10:
            assert response.status_code != 429
        else:
            assert response.status_code == 429
            data = response.json()
            assert data["success"] is False
            assert data["error"]["code"] == "RATE_LIMIT_EXCEEDED"
            assert "retry_after_seconds" in data["error"]["details"]
            assert "Retry-After" in response.headers
            assert int(response.headers["Retry-After"]) > 0


@pytest.mark.anyio
async def test_audit_logging_on_auth_actions(client: AsyncClient) -> None:
    """Verify that authentication operations trigger audit log events."""
    with patch("app.modules.auth.router.log_audit_event") as mock_audit:
        reg_payload = {
            "email": "audit-test@example.com",
            "password": "SecurePassword123!",
            "full_name": "Audit Tester",
        }
        await client.post("/api/v1/auth/register", json=reg_payload)

        assert mock_audit.called
        call_args = mock_audit.call_args_list[0][1]
        assert call_args["action"] == "user.register"
        assert "ip_address" in call_args

    with patch("app.modules.auth.router.log_audit_event") as mock_audit:
        login_payload = {
            "username": "audit-test@example.com",
            "password": "wrong-password",
        }
        await client.post("/api/v1/auth/login", data=login_payload)

        assert mock_audit.called
        call_args = mock_audit.call_args_list[0][1]
        assert call_args["action"] == "user.login"
        assert call_args["actor"] == "audit-test@example.com"
