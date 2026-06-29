import csv
import io
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import User
from app.modules.currency.models import CurrencyConversion, CurrencyRate


async def create_user_and_get_token(
    client: AsyncClient, email: str, password: str
) -> str:
    """Helper function to register and log in a user, returning their access token."""
    await client.post(
        "/api/v1/auth/register", json={"email": email, "password": password}
    )
    login_resp = await client.post(
        "/api/v1/auth/login", data={"username": email, "password": password}
    )
    assert login_resp.status_code == 200
    return login_resp.json()["access_token"]


async def create_admin_and_get_token(
    client: AsyncClient, db_session: AsyncSession, email: str, password: str
) -> str:
    """Helper function to register, log in, and elevate a user to admin."""
    token = await create_user_and_get_token(client, email, password)
    stmt = select(User).where(User.email == email)
    result = await db_session.execute(stmt)
    user = result.scalar_one()
    user.role = "admin"
    await db_session.flush()
    return token


@pytest.mark.anyio
async def test_history_endpoints_unauthenticated(client: AsyncClient) -> None:
    """Verify that history endpoints return 401 Unauthorized when no
    credentials are provided.
    """
    # List history
    resp = await client.get("/api/v1/history")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"

    # Get single history
    resp = await client.get("/api/v1/history/1")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"

    # Delete history
    resp = await client.delete("/api/v1/history/1")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.anyio
async def test_conversion_records_user_id_if_authenticated(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Verify that performing a conversion registers the user's ID if
    they are authenticated.
    """
    token = await create_user_and_get_token(
        client, "user_conv@example.com", "password123"
    )
    headers = {"Authorization": f"Bearer {token}"}

    # Perform a conversion
    response = await client.get(
        "/api/v1/currencies/convert?from=USD&to=USD&amount=100", headers=headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["user_id"] is not None

    # Verify in DB
    stmt = select(CurrencyConversion).where(CurrencyConversion.id == data["id"])
    result = await db_session.execute(stmt)
    conversion = result.scalar_one()
    assert conversion.user_id is not None


@pytest.mark.anyio
async def test_history_filtering_sorting_and_pagination(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Verify listing history supports pagination, filters, and custom sorting."""
    # 1. Setup users
    user_a_token = await create_user_and_get_token(
        client, "usera@example.com", "password123"
    )
    user_b_token = await create_user_and_get_token(
        client, "userb@example.com", "password123"
    )

    headers_a = {"Authorization": f"Bearer {user_a_token}"}
    headers_b = {"Authorization": f"Bearer {user_b_token}"}

    # Seed rates
    rate_eur = CurrencyRate(base_currency="USD", target_currency="EUR", rate=0.9)
    rate_gbp = CurrencyRate(base_currency="USD", target_currency="GBP", rate=0.8)
    db_session.add_all([rate_eur, rate_gbp])
    await db_session.flush()

    # 2. Perform conversions for User A (3 conversions)
    conv_a1 = await client.get(
        "/api/v1/currencies/convert?from=USD&to=EUR&amount=100", headers=headers_a
    )
    conv_a2 = await client.get(
        "/api/v1/currencies/convert?from=USD&to=GBP&amount=200", headers=headers_a
    )
    conv_a3 = await client.get(
        "/api/v1/currencies/convert?from=USD&to=EUR&amount=50", headers=headers_a
    )
    assert conv_a1.status_code == 200
    assert conv_a2.status_code == 200
    assert conv_a3.status_code == 200

    # Perform conversion for User B (1 conversion)
    conv_b1 = await client.get(
        "/api/v1/currencies/convert?from=USD&to=EUR&amount=500", headers=headers_b
    )
    assert conv_b1.status_code == 200

    # 3. Test list history for User A
    # Should only return User A's 3 records
    resp = await client.get("/api/v1/history", headers=headers_a)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 3
    assert len(data["items"]) == 3
    stmt = select(User).where(User.email == "usera@example.com")
    user_a = (await db_session.execute(stmt)).scalar_one()
    assert all(item["user_id"] == user_a.id for item in data["items"])

    # 4. Test Filtering by currency
    resp = await client.get("/api/v1/history?to_currency=GBP", headers=headers_a)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["to_currency"] == "GBP"

    # 5. Test Pagination
    resp = await client.get("/api/v1/history?page=1&limit=2", headers=headers_a)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 3
    assert len(data["items"]) == 2
    assert data["pages"] == 2
    assert data["page"] == 1
    assert data["limit"] == 2

    # 6. Test Sorting
    # Default is converted_at desc. Sort by amount asc:
    resp = await client.get(
        "/api/v1/history?sort_by=amount&sort_order=asc", headers=headers_a
    )
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert items[0]["amount"] == 50.0
    assert items[1]["amount"] == 100.0
    assert items[2]["amount"] == 200.0

    # Sort by amount desc:
    resp = await client.get(
        "/api/v1/history?sort_by=amount&sort_order=desc", headers=headers_a
    )
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert items[0]["amount"] == 200.0
    assert items[1]["amount"] == 100.0
    assert items[2]["amount"] == 50.0

    # 7. Test Filtering by Date
    # Find one conversion and set start_date to it
    conversion_time = datetime.now(UTC)
    # Start date in the future should yield 0 results
    future_date = (conversion_time + timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%SZ")
    resp = await client.get(
        f"/api/v1/history?start_date={future_date}", headers=headers_a
    )
    assert resp.status_code == 200
    assert resp.json()["total"] == 0

    # Start date in the past should yield all
    past_date = (conversion_time - timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%SZ")
    resp = await client.get(
        f"/api/v1/history?start_date={past_date}", headers=headers_a
    )
    assert resp.status_code == 200
    assert resp.json()["total"] == 3


@pytest.mark.anyio
async def test_admin_global_history_access(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Verify that admins can view global history and filter by user_id."""
    user_token = await create_user_and_get_token(
        client, "user_hist@example.com", "password123"
    )
    admin_token = await create_admin_and_get_token(
        client, db_session, "admin_hist@example.com", "admin123"
    )

    headers_user = {"Authorization": f"Bearer {user_token}"}
    headers_admin = {"Authorization": f"Bearer {admin_token}"}

    # Perform conversions
    await client.get(
        "/api/v1/currencies/convert?from=USD&to=USD&amount=10", headers=headers_user
    )
    await client.get(
        "/api/v1/currencies/convert?from=USD&to=USD&amount=20", headers=headers_admin
    )

    # Get user details to filter by ID
    stmt = select(User).where(User.email == "user_hist@example.com")
    result = await db_session.execute(stmt)
    user_obj = result.scalar_one()

    # Admin lists history - should see both (total = 2)
    resp = await client.get("/api/v1/history", headers=headers_admin)
    assert resp.status_code == 200
    assert resp.json()["total"] == 2

    # Admin filters by specific user ID
    resp = await client.get(
        f"/api/v1/history?user_id={user_obj.id}", headers=headers_admin
    )
    assert resp.status_code == 200
    assert resp.json()["total"] == 1
    assert resp.json()["items"][0]["amount"] == 10.0


@pytest.mark.anyio
async def test_get_single_history_record_authorization(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Verify single record retrieval logic and route-level authorization."""
    user_a_token = await create_user_and_get_token(
        client, "usera_auth@example.com", "password123"
    )
    user_b_token = await create_user_and_get_token(
        client, "userb_auth@example.com", "password123"
    )
    admin_token = await create_admin_and_get_token(
        client, db_session, "admin_auth@example.com", "admin123"
    )

    headers_a = {"Authorization": f"Bearer {user_a_token}"}
    headers_b = {"Authorization": f"Bearer {user_b_token}"}
    headers_admin = {"Authorization": f"Bearer {admin_token}"}

    # User A performs conversion
    conv_resp = await client.get(
        "/api/v1/currencies/convert?from=USD&to=USD&amount=150", headers=headers_a
    )
    assert conv_resp.status_code == 200
    record_id = conv_resp.json()["id"]

    # 1. User A retrieves own record (Success)
    resp = await client.get(f"/api/v1/history/{record_id}", headers=headers_a)
    assert resp.status_code == 200
    assert resp.json()["amount"] == 150.0

    # 2. User B tries to retrieve User A's record (Failure - 403 Forbidden)
    resp = await client.get(f"/api/v1/history/{record_id}", headers=headers_b)
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"

    # 3. Admin retrieves User A's record (Success)
    resp = await client.get(f"/api/v1/history/{record_id}", headers=headers_admin)
    assert resp.status_code == 200
    assert resp.json()["amount"] == 150.0

    # 4. Request non-existent ID
    resp = await client.get("/api/v1/history/9999", headers=headers_a)
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NOT_FOUND"


@pytest.mark.anyio
async def test_delete_history_record_authorization(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Verify single record deletion logic and route-level authorization."""
    user_a_token = await create_user_and_get_token(
        client, "usera_del@example.com", "password123"
    )
    user_b_token = await create_user_and_get_token(
        client, "userb_del@example.com", "password123"
    )
    admin_token = await create_admin_and_get_token(
        client, db_session, "admin_del@example.com", "admin123"
    )

    headers_a = {"Authorization": f"Bearer {user_a_token}"}
    headers_b = {"Authorization": f"Bearer {user_b_token}"}
    headers_admin = {"Authorization": f"Bearer {admin_token}"}

    # User A performs two conversions
    conv1 = await client.get(
        "/api/v1/currencies/convert?from=USD&to=USD&amount=10", headers=headers_a
    )
    conv2 = await client.get(
        "/api/v1/currencies/convert?from=USD&to=USD&amount=20", headers=headers_a
    )
    id1 = conv1.json()["id"]
    id2 = conv2.json()["id"]

    # 1. User B tries to delete User A's record (Failure - 403)
    resp = await client.delete(f"/api/v1/history/{id1}", headers=headers_b)
    assert resp.status_code == 403

    # 2. User A deletes own record (Success - 204)
    resp = await client.delete(f"/api/v1/history/{id1}", headers=headers_a)
    assert resp.status_code == 204

    # Verify deleted record is gone
    resp = await client.get(f"/api/v1/history/{id1}", headers=headers_a)
    assert resp.status_code == 404

    # 3. Admin deletes User A's second record (Success - 204)
    resp = await client.delete(f"/api/v1/history/{id2}", headers=headers_admin)
    assert resp.status_code == 204

    # Verify deleted record is gone
    resp = await client.get(f"/api/v1/history/{id2}", headers=headers_admin)
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_export_history_unauthenticated(client: AsyncClient) -> None:
    """Verify that export endpoint returns 401 Unauthorized when unauthenticated."""
    resp = await client.get("/api/v1/history/export")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.anyio
async def test_export_history_success_and_filtering(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Verify user conversion history export, including filtering and CSV format."""
    # 1. Setup users
    user_a_token = await create_user_and_get_token(
        client, "usera_exp@example.com", "password123"
    )
    user_b_token = await create_user_and_get_token(
        client, "userb_exp@example.com", "password123"
    )

    headers_a = {"Authorization": f"Bearer {user_a_token}"}
    headers_b = {"Authorization": f"Bearer {user_b_token}"}

    # Seed rates
    rate_eur = CurrencyRate(base_currency="USD", target_currency="EUR", rate=0.9)
    rate_gbp = CurrencyRate(base_currency="USD", target_currency="GBP", rate=0.8)
    db_session.add_all([rate_eur, rate_gbp])
    await db_session.flush()

    # User A performs 3 conversions
    await client.get(
        "/api/v1/currencies/convert?from=USD&to=EUR&amount=100", headers=headers_a
    )
    await client.get(
        "/api/v1/currencies/convert?from=USD&to=GBP&amount=200", headers=headers_a
    )
    await client.get(
        "/api/v1/currencies/convert?from=USD&to=EUR&amount=50", headers=headers_a
    )

    # User B performs 1 conversion
    await client.get(
        "/api/v1/currencies/convert?from=USD&to=EUR&amount=500", headers=headers_b
    )

    # 2. Export User A history
    resp = await client.get("/api/v1/history/export", headers=headers_a)
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "text/csv; charset=utf-8"
    assert (
        'attachment; filename="conversion_history.csv"'
        in resp.headers["content-disposition"]
    )

    content = resp.text
    reader = csv.reader(io.StringIO(content))
    rows = list(reader)

    # Check headers
    assert rows[0] == ["Date", "Currency Pair", "Amount", "Result"]
    # Check data rows: User A should have 3 rows plus 1 header row (4 total)
    assert len(rows) == 4

    # The returned history is desc by converted_at, so 50 (EUR), 200 (GBP), 100 (EUR)
    assert rows[1][1] == "USD/EUR"
    assert float(rows[1][2]) == 50.0
    assert float(rows[1][3]) == 45.0  # 50 * 0.9

    assert rows[2][1] == "USD/GBP"
    assert float(rows[2][2]) == 200.0
    assert float(rows[2][3]) == 160.0  # 200 * 0.8

    assert rows[3][1] == "USD/EUR"
    assert float(rows[3][2]) == 100.0
    assert float(rows[3][3]) == 90.0  # 100 * 0.9

    # 3. Export with filtering
    # Filter by to_currency = GBP
    resp_filter = await client.get(
        "/api/v1/history/export?to_currency=GBP", headers=headers_a
    )
    assert resp_filter.status_code == 200
    rows_filter = list(csv.reader(io.StringIO(resp_filter.text)))
    # Header + 1 record
    assert len(rows_filter) == 2
    assert rows_filter[1][1] == "USD/GBP"
    assert float(rows_filter[1][2]) == 200.0


@pytest.mark.anyio
async def test_admin_export_global_and_user_filter(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Verify that admins can export all history and filter by user_id."""
    user_token = await create_user_and_get_token(
        client, "user_exp_adm@example.com", "password123"
    )
    admin_token = await create_admin_and_get_token(
        client, db_session, "admin_exp_adm@example.com", "admin123"
    )

    headers_user = {"Authorization": f"Bearer {user_token}"}
    headers_admin = {"Authorization": f"Bearer {admin_token}"}

    # Perform conversions
    await client.get(
        "/api/v1/currencies/convert?from=USD&to=USD&amount=10",
        headers=headers_user,
    )
    await client.get(
        "/api/v1/currencies/convert?from=USD&to=USD&amount=20",
        headers=headers_admin,
    )

    # Get user ID
    stmt = select(User).where(User.email == "user_exp_adm@example.com")
    result = await db_session.execute(stmt)
    user_obj = result.scalar_one()

    # Admin exports global history (should see both user and admin conversions)
    resp = await client.get("/api/v1/history/export", headers=headers_admin)
    assert resp.status_code == 200
    rows = list(csv.reader(io.StringIO(resp.text)))
    # Header + 2 conversions = 3 rows
    assert len(rows) == 3

    # Admin exports filtered by user ID
    resp_user = await client.get(
        f"/api/v1/history/export?user_id={user_obj.id}", headers=headers_admin
    )
    assert resp_user.status_code == 200
    rows_user = list(csv.reader(io.StringIO(resp_user.text)))
    # Header + 1 conversion = 2 rows
    assert len(rows_user) == 2
    assert float(rows_user[1][2]) == 10.0
