from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import jwt
import pytest
from fastapi import Request, Response
from httpx import AsyncClient
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.dependencies import get_current_user_id, get_optional_user_id
from app.core.exceptions import (
    DatabaseException,
    ForbiddenException,
    UnauthorizedException,
)
from app.core.middleware import RequestLoggingAndIdMiddleware
from app.core.rate_limit import RateLimiter, get_client_identifier
from app.core.redis import get_redis, redis_manager
from app.core.security import (
    create_access_token,
    decode_access_token,
    verify_password,
)
from app.modules.auth.models import User
from app.modules.currency.models import CurrencyRate
from app.modules.currency.tasks import (
    refresh_cache_task,
    sync_exchange_rate_celery_task,
    sync_exchange_rate_task,
    update_rates_task,
)
from app.modules.notifications.email_service import EmailService
from app.modules.notifications.tasks import (
    check_threshold_alerts_celery_task,
    daily_summaries_scheduler_celery_task,
    send_alert_email_celery_task,
    send_daily_summary_celery_task,
)
from app.modules.users.dependencies import require_role

# ==============================================================================
# 1. SMTP & EMAIL SERVICE TESTS (Mocking External network calls)
# ==============================================================================


@pytest.mark.anyio
async def test_email_service_smtp_ssl_flow() -> None:
    """Verify SMTP SSL sending path when settings.ENV != 'testing'."""
    with (
        patch.object(settings, "ENV", "development"),
        patch.object(settings, "SMTP_SECURE", True),
        patch.object(settings, "EMAILS_FROM_EMAIL", "test-from@example.com"),
        patch.object(settings, "EMAILS_FROM_NAME", "Test Sender"),
        patch.object(settings, "SMTP_HOST", "mail.example.com"),
        patch.object(settings, "SMTP_PORT", 465),
        patch.object(settings, "SMTP_USER", "testuser"),
        patch.object(settings, "SMTP_PASSWORD", "testpass"),
        patch("smtplib.SMTP_SSL") as mock_smtp_ssl,
    ):
        mock_server = MagicMock()
        mock_smtp_ssl.return_value = mock_server

        await EmailService.send_email(
            to_email="recipient@example.com",
            subject="Test Subject",
            html_content="<p>Test HTML</p>",
        )

        mock_smtp_ssl.assert_called_once_with("mail.example.com", 465, timeout=10)
        mock_server.login.assert_called_once_with("testuser", "testpass")
        mock_server.sendmail.assert_called_once()
        mock_server.quit.assert_called_once()


@pytest.mark.anyio
async def test_email_service_smtp_tls_flow() -> None:
    """Verify SMTP TLS sending path when settings.ENV != 'testing'."""
    with (
        patch.object(settings, "ENV", "development"),
        patch.object(settings, "SMTP_SECURE", False),
        patch.object(settings, "SMTP_HOST", "mail.example.com"),
        patch.object(settings, "SMTP_PORT", 587),
        patch.object(settings, "SMTP_USER", None),
        patch.object(settings, "SMTP_PASSWORD", None),
        patch("smtplib.SMTP") as mock_smtp,
    ):
        mock_server = MagicMock()
        mock_smtp.return_value = mock_server

        await EmailService.send_email(
            to_email="recipient@example.com",
            subject="Test Subject",
            html_content="<p>Test HTML</p>",
        )

        mock_smtp.assert_called_once_with("mail.example.com", 587, timeout=10)
        mock_server.starttls.assert_called_once()
        mock_server.login.assert_not_called()
        mock_server.sendmail.assert_called_once()
        mock_server.quit.assert_called_once()


@pytest.mark.anyio
async def test_email_service_smtp_tls_starttls_error() -> None:
    """Verify SMTP TLS sending path handles starttls exceptions gracefully."""
    with (
        patch.object(settings, "ENV", "development"),
        patch.object(settings, "SMTP_SECURE", False),
        patch("smtplib.SMTP") as mock_smtp,
    ):
        mock_server = MagicMock()
        mock_server.starttls.side_effect = Exception("Starttls failed")
        mock_smtp.return_value = mock_server

        await EmailService.send_email(
            to_email="recipient@example.com",
            subject="Test Subject",
            html_content="<p>Test HTML</p>",
        )

        mock_server.starttls.assert_called_once()
        mock_server.sendmail.assert_called_once()


@pytest.mark.anyio
async def test_email_service_smtp_error_propagation() -> None:
    """Verify that SMTP failures propagate correctly."""
    with (
        patch.object(settings, "ENV", "development"),
        patch("smtplib.SMTP") as mock_smtp,
    ):
        mock_smtp.side_effect = Exception("Connection refused")
        with pytest.raises(Exception) as exc:
            await EmailService.send_email(
                to_email="recipient@example.com",
                subject="Test Subject",
                html_content="<p>Test HTML</p>",
            )
        assert "Connection refused" in str(exc.value)


# ==============================================================================
# 2. CELERY TASKS & WRAPPER EXECUTION
# ==============================================================================


@pytest.mark.anyio
async def test_sync_exchange_rate_task_db_none(
    db_session: AsyncSession, mock_redis: AsyncMock
) -> None:
    """Verify sync_exchange_rate_task runs successfully with db=None and redis=None."""
    # Seed db with test rate so it updates it
    rate = CurrencyRate(base_currency="USD", target_currency="ZAR", rate=18.5)
    db_session.add(rate)
    await db_session.commit()

    import app.core.database

    app.core.database.CURRENT_TEST_DB = db_session

    with (
        patch("app.core.redis.redis_manager.client", new=mock_redis),
        patch("app.modules.currency.tasks.get_db_context") as mock_db_ctx,
    ):
        # Set up context manager mock to yield the test db session
        @patch("app.modules.currency.tasks.get_db_context")
        class MockDBContext:
            async def __aenter__(self):
                return db_session

            async def __aexit__(self, exc_type, exc_val, exc_tb):
                pass

        mock_db_ctx.return_value = MockDBContext()

        await sync_exchange_rate_task("USD", "ZAR", 18.9, db=None, redis=None)

    app.core.database.CURRENT_TEST_DB = None


@pytest.mark.anyio
async def test_sync_exchange_rate_task_failure_path() -> None:
    """Verify sync_exchange_rate_task propagates internal exceptions."""
    with pytest.raises(Exception):  # noqa: B017
        await sync_exchange_rate_task("USD", "EUR", 0.92, db=None, redis=None)


@pytest.mark.anyio
async def test_celery_task_wrappers_execution() -> None:
    """Verify all Celery task wrappers can be called without errors."""
    with (
        patch(
            "app.modules.currency.tasks.sync_exchange_rate_task",
            new_callable=AsyncMock,
        ) as mock_sync,
        patch(
            "app.modules.notifications.tasks.check_threshold_alerts_task",
            new_callable=AsyncMock,
        ) as mock_check,
        patch(
            "app.modules.notifications.tasks.send_alert_email_task",
            new_callable=AsyncMock,
        ) as mock_send_email,
        patch(
            "app.modules.notifications.tasks.send_daily_summary_task",
            new_callable=AsyncMock,
        ) as mock_send_daily,
        patch(
            "app.modules.notifications.tasks.daily_summaries_scheduler_task",
            new_callable=AsyncMock,
        ) as mock_sched,
    ):
        sync_exchange_rate_celery_task("USD", "EUR", 0.92)
        mock_sync.assert_called_once()

        check_threshold_alerts_celery_task("USD", "EUR", 0.92)
        mock_check.assert_called_once()

        send_alert_email_celery_task("test@test.com", "USD", "EUR", 0.92, 0.90, "above")
        mock_send_email.assert_called_once()

        send_daily_summary_celery_task("test@test.com", [])
        mock_send_daily.assert_called_once()

        daily_summaries_scheduler_celery_task()
        mock_sched.assert_called_once()


@pytest.mark.anyio
async def test_periodic_tasks_failure_paths() -> None:
    """Verify Celery periodic tasks propagate exceptions when they fail internally."""
    with (
        patch(
            "app.modules.currency.tasks.services.list_rates",
            side_effect=Exception("DB Error"),
        ),
        pytest.raises(Exception),  # noqa: B017
    ):
        update_rates_task()

    with (
        patch(
            "app.modules.currency.tasks.services.list_rates",
            side_effect=Exception("DB Error"),
        ),
        pytest.raises(Exception),  # noqa: B017
    ):
        refresh_cache_task()


# ==============================================================================
# 3. ROUTER EXCEPTION HANDLING & AUDIT LOGS
# ==============================================================================


@pytest.mark.anyio
async def test_auth_router_register_exception(client: AsyncClient) -> None:
    """Verify exceptions in auth router /register route are handled and log audits."""
    with patch(
        "app.modules.auth.service.AuthService.register_user",
        side_effect=Exception("Register fail"),
    ):
        resp = await client.post(
            "/api/v1/auth/register",
            json={"email": "fail_reg@example.com", "password": "pwd"},
        )
        assert resp.status_code == 500
        assert resp.json()["error"]["code"] == "INTERNAL_SERVER_ERROR"


@pytest.mark.anyio
async def test_auth_router_login_exception(client: AsyncClient) -> None:
    """Verify exceptions in auth router /login route are handled."""
    with patch(
        "app.modules.auth.service.AuthService.authenticate_user",
        side_effect=Exception("Login fail"),
    ):
        resp = await client.post(
            "/api/v1/auth/login",
            data={"username": "fail_log@example.com", "password": "pwd"},
        )
        assert resp.status_code == 500
        assert resp.json()["error"]["code"] == "INTERNAL_SERVER_ERROR"


@pytest.mark.anyio
async def test_auth_router_refresh_exception(client: AsyncClient) -> None:
    """Verify exceptions in auth router /refresh route are handled."""
    with patch(
        "app.modules.auth.service.AuthService.rotate_refresh_token",
        side_effect=Exception("Refresh fail"),
    ):
        resp = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": "some_token"},
        )
        assert resp.status_code == 500
        assert resp.json()["error"]["code"] == "INTERNAL_SERVER_ERROR"


@pytest.mark.anyio
async def test_auth_router_logout_exception(client: AsyncClient) -> None:
    """Verify exceptions in auth router /logout route are handled."""
    with patch(
        "app.modules.auth.service.AuthService.revoke_refresh_token",
        side_effect=Exception("Logout fail"),
    ):
        resp = await client.post(
            "/api/v1/auth/logout",
            json={"refresh_token": "some_token"},
        )
        assert resp.status_code == 500
        assert resp.json()["error"]["code"] == "INTERNAL_SERVER_ERROR"


@pytest.mark.anyio
async def test_auth_router_sqlalchemy_exception_handler(
    client: AsyncClient,
) -> None:
    """Verify SQLAlchemyExceptions are formatted correctly by handler."""
    with patch(
        "app.modules.auth.service.AuthService.register_user",
        side_effect=SQLAlchemyError("DB Disconnected"),
    ):
        resp = await client.post(
            "/api/v1/auth/register",
            json={"email": "fail_db@example.com", "password": "pwd"},
        )
        assert resp.status_code == 500
        assert resp.json()["error"]["code"] == "DATABASE_DISCONNECT_OR_ERROR"


# ==============================================================================
# 4. SECURITY & EXCEPTION HANDLING TESTS
# ==============================================================================


def test_verify_password_invalid_hash() -> None:
    """Verify verify_password returns False for invalid hash format."""
    assert verify_password("pwd", "invalid_hash_value") is False


def test_create_access_token_default_expiry() -> None:
    """Verify create_access_token sets default expiry when expires_delta is None."""
    token = create_access_token("test_user_id")
    payload = jwt.decode(
        token,
        settings.SECRET_KEY,
        algorithms=[settings.ALGORITHM],
        options={"require": ["exp", "sub", "iat"]},
    )
    assert payload["sub"] == "test_user_id"
    # expiration should be roughly now + ACCESS_TOKEN_EXPIRE_MINUTES
    exp = datetime.fromtimestamp(payload["exp"], UTC)
    now = datetime.now(UTC)
    diff = exp - now
    assert abs(diff.total_seconds() - settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60) < 60


def test_decode_access_token_expired() -> None:
    """Verify decode_access_token raises UnauthorizedException for expired token."""
    expired_token = create_access_token(
        "test_user_id", expires_delta=timedelta(minutes=-5)
    )
    with pytest.raises(UnauthorizedException) as exc:
        decode_access_token(expired_token)
    assert exc.value.code == "UNAUTHORIZED"
    assert "TOKEN_EXPIRED" in exc.value.details["error_code"]


def test_decode_access_token_invalid() -> None:
    """Verify decode_access_token raises UnauthorizedException for invalid token."""
    with pytest.raises(UnauthorizedException) as exc:
        decode_access_token("invalid.token.value")
    assert exc.value.code == "UNAUTHORIZED"
    assert "INVALID_TOKEN" in exc.value.details["error_code"]


@pytest.mark.anyio
async def test_get_current_user_id_missing_sub() -> None:
    """Verify get_current_user_id raises UnauthorizedException if 'sub' is missing."""
    with patch("app.core.dependencies.decode_access_token") as mock_decode:
        mock_decode.return_value = {"other": "claim"}
        with pytest.raises(UnauthorizedException) as exc:
            await get_current_user_id("token")
        assert exc.value.details["error_code"] == "SUBJECT_MISSING"


@pytest.mark.anyio
async def test_get_optional_user_id_missing_sub() -> None:
    """Verify get_optional_user_id raises UnauthorizedException if 'sub' is missing."""
    with patch("app.core.dependencies.decode_access_token") as mock_decode:
        mock_decode.return_value = {"other": "claim"}
        with pytest.raises(UnauthorizedException) as exc:
            await get_optional_user_id("token")
        assert exc.value.details["error_code"] == "SUBJECT_MISSING"


@pytest.mark.anyio
async def test_get_optional_user_id_none() -> None:
    """Verify get_optional_user_id returns None for empty token."""
    res = await get_optional_user_id(None)
    assert res is None


@pytest.mark.anyio
async def test_require_role_rbac() -> None:
    """Verify require_role utility raises ForbiddenException or returns user."""
    mock_user = User(id=1, email="test@test.com", role="user", is_active=True)

    # 1. Access forbidden
    dep = require_role(["admin"])
    with pytest.raises(ForbiddenException) as exc:
        await dep(mock_user)
    assert exc.value.details["error_code"] == "INSUFFICIENT_PERMISSIONS"

    # 2. Access allowed
    dep_ok = require_role(["user", "admin"])
    res = await dep_ok(mock_user)
    assert res == mock_user


# ==============================================================================
# 5. REDIS MANAGER & RATE LIMITER TESTS
# ==============================================================================


@pytest.mark.anyio
async def test_redis_manager_ping_and_get_redis() -> None:
    """Verify redis_manager ping error paths and get_redis RuntimeError."""
    # 1. client is None
    with patch.object(redis_manager, "client", None):
        assert await redis_manager.ping() is False
        with pytest.raises(RuntimeError) as exc:
            await get_redis()
        assert "not initialized" in str(exc.value)

    # 2. ping raises exception
    mock_client = AsyncMock()
    mock_client.ping.side_effect = Exception("Redis connection refused")
    with patch.object(redis_manager, "client", mock_client):
        assert await redis_manager.ping() is False


@pytest.mark.anyio
async def test_get_client_identifier_token_cases() -> None:
    """Verify get_client_identifier parses auth header token or falls back to IP."""
    # 1. Valid token
    mock_req = MagicMock(spec=Request)
    mock_req.headers = {"authorization": "Bearer valid_token"}
    with patch("app.core.security.decode_access_token") as mock_decode:
        mock_decode.return_value = {"sub": "123"}
        res = await get_client_identifier(mock_req)
        assert res == "user:123"

    # 2. Invalid token (decode raises exception)
    mock_req_invalid = MagicMock(spec=Request)
    mock_req_invalid.headers = {"authorization": "Bearer invalid_token"}
    mock_req_invalid.client = MagicMock()
    mock_req_invalid.client.host = "127.0.0.1"
    with patch(
        "app.core.security.decode_access_token", side_effect=Exception("Invalid")
    ):
        res = await get_client_identifier(mock_req_invalid)
        assert res == "ip:127.0.0.1"

    # 3. x-forwarded-for header
    mock_req_forwarded = MagicMock(spec=Request)
    mock_req_forwarded.headers = {"x-forwarded-for": "10.0.0.1, 10.0.0.2"}
    res = await get_client_identifier(mock_req_forwarded)
    assert res == "ip:10.0.0.1"


@pytest.mark.anyio
async def test_rate_limiter_fail_open_scenarios() -> None:
    """Verify RateLimiter fails open when Redis is unavailable or errors out."""
    limiter = RateLimiter(limit=5, window=60)
    mock_req = MagicMock(spec=Request)
    mock_req.headers = {"x-test-rate-limit": "true"}
    mock_req.url.path = "/test"
    mock_resp = MagicMock(spec=Response)

    # 1. redis_manager.client is None
    with patch.object(redis_manager, "client", None):
        await limiter(mock_req, mock_resp)  # Should return without exception

    # 2. Redis pipeline raises Exception
    mock_client = MagicMock()
    mock_client.pipeline.side_effect = Exception("Redis error")
    with patch.object(redis_manager, "client", mock_client):
        # Should fail open and return without exception
        await limiter(mock_req, mock_resp)


# ==============================================================================
# 6. MIDDLEWARE TESTS
# ==============================================================================


@pytest.mark.anyio
async def test_request_logging_middleware_exception_path() -> None:
    """Verify RequestLoggingAndIdMiddleware logs and reraises internal exceptions."""
    mw = RequestLoggingAndIdMiddleware(app=MagicMock())
    mock_req = MagicMock(spec=Request)
    mock_req.headers = {"X-Request-ID": "test-req-id"}
    mock_req.client = MagicMock()
    mock_req.client.host = "192.168.1.1"
    mock_req.method = "GET"
    mock_req.url.path = "/api"
    mock_req.query_params = {}

    async def mock_call_next(_req):  # noqa: ARG001
        raise ValueError("Something went wrong inside the app")

    with pytest.raises(ValueError) as exc:
        await mw.dispatch(mock_req, mock_call_next)
    assert "Something went wrong inside the app" in str(exc.value)


@pytest.mark.anyio
async def test_request_logging_middleware_forwarded_ip() -> None:
    """Verify middleware extracts IP from x-forwarded-for header."""
    mw = RequestLoggingAndIdMiddleware(app=MagicMock())
    mock_req = MagicMock(spec=Request)
    mock_req.headers = {"x-forwarded-for": "172.16.0.1"}
    mock_req.client = MagicMock()
    mock_req.client.host = "192.168.1.1"
    mock_req.method = "GET"
    mock_req.url.path = "/api"
    mock_req.query_params = {}

    async def mock_call_next(_req):  # noqa: ARG001
        resp = MagicMock(spec=Response)
        resp.headers = {}
        return resp

    resp = await mw.dispatch(mock_req, mock_call_next)
    assert resp.headers["X-Request-ID"] is not None


# ==============================================================================
# 7. ROUTER EDGE CASES & COVERAGE BOOSTERS
# ==============================================================================


@pytest.mark.anyio
async def test_currency_router_rates_invalid_length(client: AsyncClient) -> None:
    """Verify that requesting exchange rate with invalid code lengths returns 400."""
    # Base too long
    resp = await client.get("/api/v1/currencies/rates/USDD/EUR")
    assert resp.status_code == 400
    assert "exactly 3-character" in resp.json()["error"]["message"]

    # Target too short
    resp2 = await client.get("/api/v1/currencies/rates/USD/EU")
    assert resp2.status_code == 400
    assert "exactly 3-character" in resp2.json()["error"]["message"]


@pytest.mark.anyio
async def test_currency_router_rates_not_found(client: AsyncClient) -> None:
    """Verify that requesting non-existent exchange rate returns 404."""
    resp = await client.get("/api/v1/currencies/rates/XYZ/ABC")
    assert resp.status_code == 404
    assert "was not found" in resp.json()["error"]["message"]


@pytest.mark.anyio
async def test_currency_router_list_all_rates(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Verify list_all_rates endpoint returns rates from DB."""
    # Seed DB with a rate
    rate = CurrencyRate(base_currency="USD", target_currency="NZD", rate=1.65)
    db_session.add(rate)
    await db_session.commit()

    resp = await client.get("/api/v1/currencies/rates")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    pairs = {(r["base_currency"], r["target_currency"]) for r in data}
    assert ("USD", "NZD") in pairs


@pytest.mark.anyio
async def test_users_router_me_unauthenticated(client: AsyncClient) -> None:
    """Verify accessing /users/me without authentication returns 401."""
    resp = await client.get("/api/v1/users/me")
    assert resp.status_code == 401


# ==============================================================================
# 8. EXCEPTIONS & ERROR HANDLERS (DatabaseException & HTTP Handlers)
# ==============================================================================


def test_database_exception_instantiation() -> None:
    """Verify DatabaseException sets properties correctly."""
    exc = DatabaseException(message="Custom DB error message", details={"err": 1})
    assert exc.status_code == 500
    assert exc.code == "DATABASE_ERROR"
    assert exc.message == "Custom DB error message"
    assert exc.details == {"err": 1}
