import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.modules.auth.models import User, RefreshToken


@pytest.mark.anyio
async def test_get_me_unauthenticated(client: AsyncClient) -> None:
    """Verify that accessing GET /api/v1/users/me without credentials fails."""
    resp = await client.get("/api/v1/users/me")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.anyio
async def test_get_me_authenticated(client: AsyncClient) -> None:
    """Verify retrieving the profile of the current authenticated user."""
    # 1. Register & Login
    email = "user_me@example.com"
    password = "secure_password_123"
    await client.post("/api/v1/auth/register", json={"email": email, "password": password})
    login_resp = await client.post("/api/v1/auth/login", data={"username": email, "password": password})
    token_info = login_resp.json()
    access_token = token_info["access_token"]

    # 2. Get profile
    headers = {"Authorization": f"Bearer {access_token}"}
    me_resp = await client.get("/api/v1/users/me", headers=headers)
    assert me_resp.status_code == 200
    data = me_resp.json()
    assert data["email"] == email
    assert data["first_name"] is None
    assert data["last_name"] is None
    assert data["role"] == "user"
    assert data["is_deleted"] is False


@pytest.mark.anyio
async def test_update_profile(client: AsyncClient) -> None:
    """Verify updating first name, last name, and email, including validation."""
    # 1. Register & Login
    email = "update_me@example.com"
    password = "secure_password_123"
    await client.post("/api/v1/auth/register", json={"email": email, "password": password})
    login_resp = await client.post("/api/v1/auth/login", data={"username": email, "password": password})
    token_info = login_resp.json()
    access_token = token_info["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}

    # 2. Update profile
    update_payload = {
        "email": "updated_email@example.com",
        "first_name": "John",
        "last_name": "Doe",
    }
    update_resp = await client.put("/api/v1/users/me", json=update_payload, headers=headers)
    assert update_resp.status_code == 200
    updated_data = update_resp.json()
    assert updated_data["email"] == "updated_email@example.com"
    assert updated_data["first_name"] == "John"
    assert updated_data["last_name"] == "Doe"

    # 3. Verify changes persist
    me_resp = await client.get("/api/v1/users/me", headers=headers)
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == "updated_email@example.com"
    assert me_resp.json()["first_name"] == "John"


@pytest.mark.anyio
async def test_update_profile_duplicate_email(client: AsyncClient) -> None:
    """Verify updating profile email to an existing email fails."""
    # 1. Register two users
    await client.post("/api/v1/auth/register", json={"email": "user1@example.com", "password": "password123"})
    await client.post("/api/v1/auth/register", json={"email": "user2@example.com", "password": "password123"})

    # Login user 1
    login_resp = await client.post("/api/v1/auth/login", data={"username": "user1@example.com", "password": "password123"})
    access_token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}

    # 2. Try to change user 1 email to user 2 email
    update_payload = {"email": "user2@example.com"}
    update_resp = await client.put("/api/v1/users/me", json=update_payload, headers=headers)
    assert update_resp.status_code == 400
    assert update_resp.json()["error"]["code"] == "BAD_REQUEST"
    assert "already exists" in update_resp.json()["error"]["message"]


@pytest.mark.anyio
async def test_change_password_success_and_revocation(client: AsyncClient, db_session: AsyncSession) -> None:
    """Verify password change verifies current password, hashes new password, and revokes sessions."""
    # 1. Register & Login
    email = "password_change@example.com"
    password = "old_password_123"
    await client.post("/api/v1/auth/register", json={"email": email, "password": password})
    login_resp = await client.post("/api/v1/auth/login", data={"username": email, "password": password})
    token_info = login_resp.json()
    access_token = token_info["access_token"]
    refresh_token = token_info["refresh_token"]
    headers = {"Authorization": f"Bearer {access_token}"}

    # 2. Change password
    change_payload = {
        "current_password": "old_password_123",
        "new_password": "new_secure_password_456",
    }
    change_resp = await client.put("/api/v1/users/me/password", json=change_payload, headers=headers)
    assert change_resp.status_code == 200
    assert change_resp.json()["success"] is True

    # 3. Verify that old refresh token has been revoked
    refresh_resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert refresh_resp.status_code == 401

    # 4. Verify login works with new password but not old password
    failed_login_resp = await client.post("/api/v1/auth/login", data={"username": email, "password": "old_password_123"})
    assert failed_login_resp.status_code == 401

    success_login_resp = await client.post("/api/v1/auth/login", data={"username": email, "password": "new_secure_password_456"})
    assert success_login_resp.status_code == 200


@pytest.mark.anyio
async def test_change_password_validation(client: AsyncClient) -> None:
    """Verify validation: wrong current password, or new password same as current."""
    email = "pwd_validate@example.com"
    password = "secure_password_123"
    await client.post("/api/v1/auth/register", json={"email": email, "password": password})
    login_resp = await client.post("/api/v1/auth/login", data={"username": email, "password": password})
    access_token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}

    # Same password validation (Pydantic validator)
    payload_same = {"current_password": password, "new_password": password}
    resp_same = await client.put("/api/v1/users/me/password", json=payload_same, headers=headers)
    assert resp_same.status_code == 422
    assert any("different from the current password" in err["message"] for err in resp_same.json()["error"]["details"])

    # Wrong current password validation
    payload_wrong = {"current_password": "incorrect_password", "new_password": "new_different_password"}
    resp_wrong = await client.put("/api/v1/users/me/password", json=payload_wrong, headers=headers)
    assert resp_wrong.status_code == 400
    assert resp_wrong.json()["error"]["code"] == "BAD_REQUEST"


@pytest.mark.anyio
async def test_soft_delete_account(client: AsyncClient) -> None:
    """Verify soft deleting an account and that access is revoked."""
    email = "delete_me@example.com"
    password = "secure_password_123"
    await client.post("/api/v1/auth/register", json={"email": email, "password": password})
    
    # Login
    login_resp = await client.post("/api/v1/auth/login", data={"username": email, "password": password})
    token_info = login_resp.json()
    access_token = token_info["access_token"]
    refresh_token = token_info["refresh_token"]
    headers = {"Authorization": f"Bearer {access_token}"}

    # Soft Delete
    delete_resp = await client.delete("/api/v1/users/me", headers=headers)
    assert delete_resp.status_code == 200
    assert delete_resp.json()["success"] is True

    # Subsequent GET profile should fail with 401 Unauthorized
    me_resp = await client.get("/api/v1/users/me", headers=headers)
    assert me_resp.status_code == 401

    # Subsequent login attempts should fail
    login_fail_resp = await client.post("/api/v1/auth/login", data={"username": email, "password": password})
    assert login_fail_resp.status_code == 401

    # Subsequent refresh token rotation attempts should fail
    refresh_fail_resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert refresh_fail_resp.status_code == 401
