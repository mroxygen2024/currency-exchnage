import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    BadRequestException,
    NotFoundException,
)
from app.modules.auth.models import User
from app.modules.currency.models import CurrencyRate
from app.modules.favorites.models import FavoritePair
from app.modules.notifications.email_service import TEST_OUTBOX
from app.modules.notifications.models import NotificationSubscription
from app.modules.notifications.schemas import NotificationSubscriptionCreate
from app.modules.notifications.service import NotificationsService
from app.modules.notifications.tasks import (
    check_threshold_alerts_task,
    daily_summaries_scheduler_task,
)

# Global reference to current test database session for taskiq dependency resolution
CURRENT_TEST_DB: AsyncSession | None = None


@pytest.fixture(autouse=True)
def setup_test_db(db_session: AsyncSession) -> None:
    """Fixture to store active DB session for mock taskiq execution."""
    global CURRENT_TEST_DB
    CURRENT_TEST_DB = db_session
    yield
    CURRENT_TEST_DB = None


@pytest.fixture(autouse=True)
def clear_outbox() -> None:
    """Clear the global test outbox before and after each test case."""
    TEST_OUTBOX.clear()
    yield
    TEST_OUTBOX.clear()


@pytest.mark.anyio
async def test_notifications_unauthenticated(client: AsyncClient) -> None:
    """Verify that accessing endpoints without authentication returns 401."""
    # POST
    resp_post = await client.post(
        "/api/v1/notifications/subscribe",
        json={
            "base_currency": "USD",
            "target_currency": "ETB",
            "threshold": 150.0,
            "condition": "above",
        },
    )
    assert resp_post.status_code == 401

    # GET
    resp_get = await client.get("/api/v1/notifications")
    assert resp_get.status_code == 401

    # DELETE
    resp_delete = await client.delete("/api/v1/notifications/1")
    assert resp_delete.status_code == 401


@pytest.mark.anyio
async def test_subscribe_success(client: AsyncClient) -> None:
    """Verify successfully subscribing to a currency threshold alert."""
    # 1. Register & Login
    email = "sub_user@example.com"
    password = "password123"
    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password},
    )
    login_resp = await client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": password},
    )
    access_token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}

    # 2. Subscribe
    resp = await client.post(
        "/api/v1/notifications/subscribe",
        json={
            "base_currency": "usd",
            "target_currency": "etb",
            "threshold": 150.0,
            "condition": "above",
        },
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["base_currency"] == "USD"
    assert data["target_currency"] == "ETB"
    assert data["threshold"] == 150.0
    assert data["condition"] == "above"
    assert data["is_active"] is True
    assert "id" in data
    assert "user_id" in data


@pytest.mark.anyio
async def test_subscribe_validation(client: AsyncClient) -> None:
    """Verify schema-level validation for threshold alert subscriptions."""
    # 1. Register & Login
    email = "sub_val_user@example.com"
    password = "password123"
    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password},
    )
    login_resp = await client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": password},
    )
    access_token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}

    # Same currencies
    resp_same = await client.post(
        "/api/v1/notifications/subscribe",
        json={
            "base_currency": "USD",
            "target_currency": "usd",
            "threshold": 1.0,
            "condition": "above",
        },
        headers=headers,
    )
    assert resp_same.status_code == 422

    # Invalid code length
    resp_short = await client.post(
        "/api/v1/notifications/subscribe",
        json={
            "base_currency": "US",
            "target_currency": "EUR",
            "threshold": 1.0,
            "condition": "above",
        },
        headers=headers,
    )
    assert resp_short.status_code == 422

    # Negative threshold
    resp_neg = await client.post(
        "/api/v1/notifications/subscribe",
        json={
            "base_currency": "USD",
            "target_currency": "EUR",
            "threshold": -5.0,
            "condition": "above",
        },
        headers=headers,
    )
    assert resp_neg.status_code == 422

    # Invalid condition
    resp_cond = await client.post(
        "/api/v1/notifications/subscribe",
        json={
            "base_currency": "USD",
            "target_currency": "EUR",
            "threshold": 1.0,
            "condition": "somewhere",
        },
        headers=headers,
    )
    assert resp_cond.status_code == 422


@pytest.mark.anyio
async def test_subscribe_duplicate_error(client: AsyncClient) -> None:
    """Verify that adding exact same subscription twice returns 400."""
    # 1. Register & Login
    email = "sub_dup_user@example.com"
    password = "password123"
    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password},
    )
    login_resp = await client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": password},
    )
    access_token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}

    payload = {
        "base_currency": "USD",
        "target_currency": "ETB",
        "threshold": 150.0,
        "condition": "above",
    }

    # First subscribe
    resp1 = await client.post(
        "/api/v1/notifications/subscribe",
        json=payload,
        headers=headers,
    )
    assert resp1.status_code == 201

    # Second subscribe
    resp2 = await client.post(
        "/api/v1/notifications/subscribe",
        json=payload,
        headers=headers,
    )
    assert resp2.status_code == 400
    assert resp2.json()["error"]["code"] == "BAD_REQUEST"


@pytest.mark.anyio
async def test_list_subscriptions(client: AsyncClient) -> None:
    """Verify fetching list of subscriptions for the authenticated user."""
    # 1. Register & Login
    email = "sub_list_user@example.com"
    password = "password123"
    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password},
    )
    login_resp = await client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": password},
    )
    access_token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}

    # Subscribe to 2 alerts
    await client.post(
        "/api/v1/notifications/subscribe",
        json={
            "base_currency": "USD",
            "target_currency": "ETB",
            "threshold": 150.0,
            "condition": "above",
        },
        headers=headers,
    )
    await client.post(
        "/api/v1/notifications/subscribe",
        json={
            "base_currency": "EUR",
            "target_currency": "USD",
            "threshold": 1.05,
            "condition": "below",
        },
        headers=headers,
    )

    resp = await client.get("/api/v1/notifications", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    pairs = {(sub["base_currency"], sub["target_currency"]) for sub in data}
    assert ("USD", "ETB") in pairs
    assert ("EUR", "USD") in pairs


@pytest.mark.anyio
async def test_delete_subscription(client: AsyncClient) -> None:
    """Verify deleting subscription and permissions checks."""
    # 1. Register & Login User 1 & User 2
    await client.post(
        "/api/v1/auth/register",
        json={"email": "u1_sub@example.com", "password": "password123"},
    )
    login_u1 = await client.post(
        "/api/v1/auth/login",
        data={"username": "u1_sub@example.com", "password": "password123"},
    )
    headers_u1 = {"Authorization": f"Bearer {login_u1.json()['access_token']}"}

    await client.post(
        "/api/v1/auth/register",
        json={"email": "u2_sub@example.com", "password": "password123"},
    )
    login_u2 = await client.post(
        "/api/v1/auth/login",
        data={"username": "u2_sub@example.com", "password": "password123"},
    )
    headers_u2 = {"Authorization": f"Bearer {login_u2.json()['access_token']}"}

    # 2. User 1 subscribes
    add_resp = await client.post(
        "/api/v1/notifications/subscribe",
        json={
            "base_currency": "USD",
            "target_currency": "ETB",
            "threshold": 150.0,
            "condition": "above",
        },
        headers=headers_u1,
    )
    sub_id = add_resp.json()["id"]

    # 3. User 2 attempts to delete User 1's subscription -> 403 Forbidden
    del_fail = await client.delete(
        f"/api/v1/notifications/{sub_id}", headers=headers_u2
    )
    assert del_fail.status_code == 403

    # 4. User 1 deletes successfully -> 200 OK
    del_ok = await client.delete(f"/api/v1/notifications/{sub_id}", headers=headers_u1)
    assert del_ok.status_code == 200

    # 5. Delete non-existent subscription -> 404
    del_missing = await client.delete(
        f"/api/v1/notifications/{sub_id}", headers=headers_u1
    )
    assert del_missing.status_code == 404


@pytest.mark.anyio
async def test_delete_subscription_by_admin(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Verify that an admin can delete any user's subscription."""
    # 1. Register normal user & subscribe
    await client.post(
        "/api/v1/auth/register",
        json={"email": "norm_sub@example.com", "password": "password123"},
    )
    login_norm = await client.post(
        "/api/v1/auth/login",
        data={"username": "norm_sub@example.com", "password": "password123"},
    )
    headers_norm = {"Authorization": f"Bearer {login_norm.json()['access_token']}"}

    add_resp = await client.post(
        "/api/v1/notifications/subscribe",
        json={
            "base_currency": "USD",
            "target_currency": "ETB",
            "threshold": 150.0,
            "condition": "above",
        },
        headers=headers_norm,
    )
    sub_id = add_resp.json()["id"]

    # 2. Register Admin & update role
    await client.post(
        "/api/v1/auth/register",
        json={"email": "admin_sub@example.com", "password": "password123"},
    )
    res_admin = await db_session.execute(
        select(User).where(User.email == "admin_sub@example.com")
    )
    admin = res_admin.scalar_one()
    admin.role = "admin"
    await db_session.commit()

    login_admin = await client.post(
        "/api/v1/auth/login",
        data={"username": "admin_sub@example.com", "password": "password123"},
    )
    headers_admin = {"Authorization": f"Bearer {login_admin.json()['access_token']}"}

    # 3. Admin deletes normal user's subscription
    del_ok = await client.delete(
        f"/api/v1/notifications/{sub_id}", headers=headers_admin
    )
    assert del_ok.status_code == 200


@pytest.mark.anyio
async def test_notifications_service_direct(db_session: AsyncSession) -> None:
    """Verify NotificationsService direct unit test calls."""
    # Create user
    user = User(
        email="direct_sub@example.com",
        hashed_password="pwd",
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()

    service = NotificationsService(db_session)

    # Subscribe
    schema = NotificationSubscriptionCreate(
        base_currency="USD",
        target_currency="ETB",
        threshold=160.0,
        condition="above",
    )
    sub = await service.subscribe(user, schema)
    assert sub.user_id == user.id
    assert sub.base_currency == "USD"
    assert sub.target_currency == "ETB"
    assert float(sub.threshold) == 160.0
    assert sub.condition == "above"

    # Try duplicate
    with pytest.raises(BadRequestException):
        await service.subscribe(user, schema)

    # List
    subs = await service.get_subscriptions(user)
    assert len(subs) == 1

    # Delete non-existent
    with pytest.raises(NotFoundException):
        await service.delete_subscription(user, 9999)

    # Delete success
    await service.delete_subscription(user, sub.id)
    assert len(await service.get_subscriptions(user)) == 0


@pytest.mark.anyio
async def test_check_threshold_alerts_task_trigger(db_session: AsyncSession) -> None:
    """Verify check_threshold_alerts_task detects threshold cross and sends email."""
    from sqlalchemy import delete

    await db_session.execute(delete(NotificationSubscription))
    TEST_OUTBOX.clear()

    # Create user
    user = User(
        email="alert_trigger_recipient@example.com",
        hashed_password="pwd",
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()

    # Create active subscription (above 150)
    sub = NotificationSubscription(
        user_id=user.id,
        base_currency="USD",
        target_currency="ETB",
        threshold=150.0,
        condition="above",
        is_active=True,
    )
    db_session.add(sub)
    await db_session.commit()

    # Execute task with rate below threshold (145.0) -> No email
    await check_threshold_alerts_task(
        base="USD",
        target="ETB",
        current_rate=145.0,
        db=db_session,
    )
    assert len(TEST_OUTBOX) == 0

    # Execute task with rate above threshold (155.0) -> Dispatches email!
    await check_threshold_alerts_task(
        base="USD",
        target="ETB",
        current_rate=155.0,
        db=db_session,
    )
    assert len(TEST_OUTBOX) == 1
    email = TEST_OUTBOX[0]
    assert email["to"] == "alert_trigger_recipient@example.com"
    assert "USD/ETB" in email["subject"]
    assert "USD &rarr; ETB" in email["html"]
    assert "155.0000" in email["html"]

    # Re-run task with rate above threshold (155.0) -> Cooldown prevents second email
    await check_threshold_alerts_task(
        base="USD",
        target="ETB",
        current_rate=155.0,
        db=db_session,
    )
    assert len(TEST_OUTBOX) == 1


@pytest.mark.anyio
async def test_daily_summaries_scheduler_task(
    db_session: AsyncSession,
) -> None:
    """Verify daily_summaries_scheduler_task generates daily summary emails for users with favorites."""
    from unittest.mock import AsyncMock

    # Create user
    user = User(
        email="summary_recipient@example.com",
        hashed_password="pwd",
        is_active=True,
    )
    # Create favorite pair
    fav = FavoritePair(
        user_id=1,  # Will resolve during flush
        base_currency="USD",
        target_currency="ETB",
    )
    db_session.add(user)
    await db_session.flush()

    fav.user_id = user.id
    db_session.add(fav)

    # Seed rate
    rate = CurrencyRate(
        base_currency="USD",
        target_currency="ETB",
        rate=155.0,
    )
    db_session.add(rate)
    await db_session.commit()

    # Mock Redis client
    mock_redis = AsyncMock()
    mock_redis.get.return_value = None

    # Execute scheduler task
    await daily_summaries_scheduler_task(db=db_session, redis=mock_redis)

    assert len(TEST_OUTBOX) == 1
    email = TEST_OUTBOX[0]
    assert email["to"] == "summary_recipient@example.com"
    assert "Daily Exchange Rates Summary" in email["subject"]
    assert "USD/ETB" in email["html"]
    assert "155.0000" in email["html"]
