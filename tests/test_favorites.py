import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    BadRequestException,
    ForbiddenException,
    NotFoundException,
)
from app.modules.auth.models import User
from app.modules.favorites.schemas import FavoritePairCreate
from app.modules.favorites.service import FavoritesService


@pytest.mark.anyio
async def test_favorites_unauthenticated(client: AsyncClient) -> None:
    """Verify that accessing endpoints without authentication returns 401."""
    # POST
    resp_post = await client.post(
        "/api/v1/favorites",
        json={"base_currency": "USD", "target_currency": "EUR"},
    )
    assert resp_post.status_code == 401

    # GET
    resp_get = await client.get("/api/v1/favorites")
    assert resp_get.status_code == 401

    # DELETE
    resp_delete = await client.delete("/api/v1/favorites/1")
    assert resp_delete.status_code == 401


@pytest.mark.anyio
async def test_add_favorite_pair_success(client: AsyncClient) -> None:
    """Verify successfully adding a favorite pair."""
    # 1. Register & Login
    email = "fav_user@example.com"
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

    # 2. Add Favorite
    resp = await client.post(
        "/api/v1/favorites",
        json={"base_currency": "usd", "target_currency": "eur"},
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["base_currency"] == "USD"
    assert data["target_currency"] == "EUR"
    assert "id" in data
    assert "user_id" in data


@pytest.mark.anyio
async def test_add_favorite_validation(client: AsyncClient) -> None:
    """Verify schema-level validation for favorite pair requests."""
    # 1. Register & Login
    email = "fav_val_user@example.com"
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
        "/api/v1/favorites",
        json={"base_currency": "USD", "target_currency": "usd"},
        headers=headers,
    )
    assert resp_same.status_code == 422
    assert "different" in resp_same.json()["error"]["details"][0]["message"]

    # Invalid code length
    resp_short = await client.post(
        "/api/v1/favorites",
        json={"base_currency": "US", "target_currency": "EUR"},
        headers=headers,
    )
    assert resp_short.status_code == 422

    # Non-alphabetic code
    resp_non_alpha = await client.post(
        "/api/v1/favorites",
        json={"base_currency": "U12", "target_currency": "EUR"},
        headers=headers,
    )
    assert resp_non_alpha.status_code == 422


@pytest.mark.anyio
async def test_add_favorite_duplicate_error(client: AsyncClient) -> None:
    """Verify that adding the same favorite pair twice returns a 400 error."""
    # 1. Register & Login
    email = "fav_dup_user@example.com"
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

    # 2. Add Favorite first time
    resp1 = await client.post(
        "/api/v1/favorites",
        json={"base_currency": "USD", "target_currency": "GBP"},
        headers=headers,
    )
    assert resp1.status_code == 201

    # 3. Add Favorite second time
    resp2 = await client.post(
        "/api/v1/favorites",
        json={"base_currency": "usd", "target_currency": "gbp"},
        headers=headers,
    )
    assert resp2.status_code == 400
    assert resp2.json()["error"]["code"] == "BAD_REQUEST"
    assert "already exists" in resp2.json()["error"]["message"]


@pytest.mark.anyio
async def test_list_favorites_isolation(client: AsyncClient) -> None:
    """Verify listing favorite pairs only returns the requesting user's favorites."""
    # 1. Register & Login User 1
    await client.post(
        "/api/v1/auth/register",
        json={"email": "user1@example.com", "password": "password123"},
    )
    login_u1 = await client.post(
        "/api/v1/auth/login",
        data={"username": "user1@example.com", "password": "password123"},
    )
    token_u1 = login_u1.json()["access_token"]
    headers_u1 = {"Authorization": f"Bearer {token_u1}"}

    # 2. Register & Login User 2
    await client.post(
        "/api/v1/auth/register",
        json={"email": "user2@example.com", "password": "password123"},
    )
    login_u2 = await client.post(
        "/api/v1/auth/login",
        data={"username": "user2@example.com", "password": "password123"},
    )
    token_u2 = login_u2.json()["access_token"]
    headers_u2 = {"Authorization": f"Bearer {token_u2}"}

    # 3. User 1 adds a favorite
    await client.post(
        "/api/v1/favorites",
        json={"base_currency": "USD", "target_currency": "JPY"},
        headers=headers_u1,
    )

    # 4. Get User 2 favorites (should be empty)
    resp_u2 = await client.get("/api/v1/favorites", headers=headers_u2)
    assert resp_u2.status_code == 200
    assert len(resp_u2.json()) == 0

    # 5. Get User 1 favorites (should have 1 item)
    resp_u1 = await client.get("/api/v1/favorites", headers=headers_u1)
    assert resp_u1.status_code == 200
    assert len(resp_u1.json()) == 1
    assert resp_u1.json()[0]["base_currency"] == "USD"
    assert resp_u1.json()[0]["target_currency"] == "JPY"


@pytest.mark.anyio
async def test_delete_favorite_pair(client: AsyncClient) -> None:
    """Verify successfully deleting a favorite pair and authorization checks."""
    # 1. Register & Login User 1 and User 2
    await client.post(
        "/api/v1/auth/register",
        json={"email": "u1_del@example.com", "password": "password123"},
    )
    login_u1 = await client.post(
        "/api/v1/auth/login",
        data={"username": "u1_del@example.com", "password": "password123"},
    )
    token_u1 = login_u1.json()["access_token"]
    headers_u1 = {"Authorization": f"Bearer {token_u1}"}

    await client.post(
        "/api/v1/auth/register",
        json={"email": "u2_del@example.com", "password": "password123"},
    )
    login_u2 = await client.post(
        "/api/v1/auth/login",
        data={"username": "u2_del@example.com", "password": "password123"},
    )
    token_u2 = login_u2.json()["access_token"]
    headers_u2 = {"Authorization": f"Bearer {token_u2}"}

    # 2. User 1 adds a favorite
    add_resp = await client.post(
        "/api/v1/favorites",
        json={"base_currency": "EUR", "target_currency": "CAD"},
        headers=headers_u1,
    )
    fav_id = add_resp.json()["id"]

    # 3. User 2 tries to delete User 1's favorite -> 403 Forbidden
    del_forbidden = await client.delete(
        f"/api/v1/favorites/{fav_id}",
        headers=headers_u2,
    )
    assert del_forbidden.status_code == 403
    assert del_forbidden.json()["error"]["code"] == "FORBIDDEN"

    # 4. User 1 deletes their own favorite -> 200 OK
    del_success = await client.delete(
        f"/api/v1/favorites/{fav_id}",
        headers=headers_u1,
    )
    assert del_success.status_code == 200
    assert del_success.json()["success"] is True

    # 5. Delete a non-existent favorite -> 404 Not Found
    del_not_found = await client.delete(
        f"/api/v1/favorites/{fav_id}",
        headers=headers_u1,
    )
    assert del_not_found.status_code == 404
    assert del_not_found.json()["error"]["code"] == "NOT_FOUND"


@pytest.mark.anyio
async def test_delete_favorite_by_admin(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Verify that an admin user can delete any user's favorite pair."""
    # 1. Register & Login normal user
    await client.post(
        "/api/v1/auth/register",
        json={"email": "normal_user@example.com", "password": "password123"},
    )
    login_norm = await client.post(
        "/api/v1/auth/login",
        data={"username": "normal_user@example.com", "password": "password123"},
    )
    token_norm = login_norm.json()["access_token"]
    headers_norm = {"Authorization": f"Bearer {token_norm}"}

    # 2. Register & Login admin user
    await client.post(
        "/api/v1/auth/register",
        json={"email": "admin_user@example.com", "password": "password123"},
    )
    # Change role to admin directly in the test database session
    result = await db_session.execute(
        select(User).where(User.email == "admin_user@example.com")
    )
    admin_user = result.scalar_one()
    admin_user.role = "admin"
    await db_session.commit()

    login_admin = await client.post(
        "/api/v1/auth/login",
        data={"username": "admin_user@example.com", "password": "password123"},
    )
    token_admin = login_admin.json()["access_token"]
    headers_admin = {"Authorization": f"Bearer {token_admin}"}

    # 3. Normal user adds a favorite
    add_resp = await client.post(
        "/api/v1/favorites",
        json={"base_currency": "USD", "target_currency": "NZD"},
        headers=headers_norm,
    )
    fav_id = add_resp.json()["id"]

    # 4. Admin deletes the favorite
    del_success = await client.delete(
        f"/api/v1/favorites/{fav_id}",
        headers=headers_admin,
    )
    assert del_success.status_code == 200
    assert del_success.json()["success"] is True


@pytest.mark.anyio
async def test_favorites_service_direct(db_session: AsyncSession) -> None:
    """Verify FavoritesService business logic directly via unit tests."""
    from app.core.security import hash_password
    from app.modules.auth.models import User

    # Create dummy users
    hashed = hash_password("password123")
    user1 = User(
        email="service_u1@example.com",
        hashed_password=hashed,
        is_active=True,
        role="user",
    )
    user2 = User(
        email="service_u2@example.com",
        hashed_password=hashed,
        is_active=True,
        role="user",
    )
    db_session.add_all([user1, user2])
    await db_session.flush()

    service = FavoritesService(db_session)

    # 1. Add favorite
    schema = FavoritePairCreate(base_currency="USD", target_currency="CHF")
    fav = await service.add_favorite(user1, schema)
    assert fav.user_id == user1.id
    assert fav.base_currency == "USD"
    assert fav.target_currency == "CHF"

    # 2. Add duplicate
    with pytest.raises(BadRequestException) as exc_dup:
        await service.add_favorite(user1, schema)
    assert "already exists" in str(exc_dup.value)

    # 3. Retrieve favorites
    favs = await service.get_favorites(user1)
    assert len(favs) == 1
    assert favs[0].id == fav.id

    # 4. Delete ownership validation
    with pytest.raises(ForbiddenException) as exc_forbid:
        await service.delete_favorite(user2, fav.id)
    assert "permission" in str(exc_forbid.value)

    # 5. Delete non-existent
    with pytest.raises(NotFoundException) as exc_not_found:
        await service.delete_favorite(user1, 99999)
    assert "not found" in str(exc_not_found.value)

    # 6. Delete success
    await service.delete_favorite(user1, fav.id)
    favs_after = await service.get_favorites(user1)
    assert len(favs_after) == 0
