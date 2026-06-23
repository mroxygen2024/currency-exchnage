import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.modules.auth.models import RefreshToken


@pytest.mark.anyio
async def test_auth_registration_and_login_flow(client: AsyncClient) -> None:
    """Verify that registering a user, logging in, and retrieving details works."""
    # 1. Registration
    reg_payload = {"email": "test@example.com", "password": "secure_password_123"}
    reg_resp = await client.post("/api/v1/auth/register", json=reg_payload)
    assert reg_resp.status_code == 201
    user_info = reg_resp.json()
    assert user_info["email"] == "test@example.com"
    assert "id" in user_info

    # 2. Login to get access and refresh token
    login_payload = {"username": "test@example.com", "password": "secure_password_123"}
    login_resp = await client.post("/api/v1/auth/login", data=login_payload)
    assert login_resp.status_code == 200
    token_info = login_resp.json()
    assert token_info["token_type"] == "bearer"
    assert "access_token" in token_info
    assert "refresh_token" in token_info
    
    access_token = token_info["access_token"]

    # 3. Retrieve currently logged-in user profile
    headers = {"Authorization": f"Bearer {access_token}"}
    me_resp = await client.get("/api/v1/auth/me", headers=headers)
    assert me_resp.status_code == 200
    me_info = me_resp.json()
    assert me_info["email"] == "test@example.com"
    assert me_info["id"] == user_info["id"]


@pytest.mark.anyio
async def test_registration_duplicate_email(client: AsyncClient) -> None:
    """Verify that registering with an already existing email returns a 400 Bad Request."""
    reg_payload = {"email": "dup@example.com", "password": "secure_password_123"}
    resp1 = await client.post("/api/v1/auth/register", json=reg_payload)
    assert resp1.status_code == 201

    resp2 = await client.post("/api/v1/auth/register", json=reg_payload)
    assert resp2.status_code == 400
    assert resp2.json()["error"]["code"] == "BAD_REQUEST"


@pytest.mark.anyio
async def test_login_invalid_credentials(client: AsyncClient) -> None:
    """Verify that logging in with incorrect credentials returns a 401 Unauthorized."""
    # Register user
    reg_payload = {"email": "login_fail@example.com", "password": "secure_password_123"}
    await client.post("/api/v1/auth/register", json=reg_payload)

    # Wrong password
    login_payload = {"username": "login_fail@example.com", "password": "wrong_password"}
    login_resp = await client.post("/api/v1/auth/login", data=login_payload)
    assert login_resp.status_code == 401
    assert login_resp.json()["error"]["code"] == "UNAUTHORIZED"

    # Non-existent user
    login_payload_missing = {"username": "missing@example.com", "password": "password123"}
    login_resp_missing = await client.post("/api/v1/auth/login", data=login_payload_missing)
    assert login_resp_missing.status_code == 401


@pytest.mark.anyio
async def test_token_refresh_flow(client: AsyncClient) -> None:
    """Verify that using a refresh token rotates both the access and refresh tokens."""
    # 1. Register & Login
    email = "refresh@example.com"
    password = "secure_password_123"
    await client.post("/api/v1/auth/register", json={"email": email, "password": password})
    login_resp = await client.post("/api/v1/auth/login", data={"username": email, "password": password})
    token_info = login_resp.json()
    first_refresh_token = token_info["refresh_token"]

    # 2. Refresh tokens
    refresh_resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": first_refresh_token})
    assert refresh_resp.status_code == 200
    new_token_info = refresh_resp.json()
    assert "access_token" in new_token_info
    assert "refresh_token" in new_token_info
    assert new_token_info["refresh_token"] != first_refresh_token

    # 3. Verify old refresh token can no longer be used (rotation check)
    failed_refresh_resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": first_refresh_token})
    assert failed_refresh_resp.status_code == 401


@pytest.mark.anyio
async def test_refresh_token_reuse_detection(client: AsyncClient, db_session: AsyncSession) -> None:
    """Verify that reuse of a refresh token invalidates all tokens of that user."""
    email = "compromised@example.com"
    password = "secure_password_123"
    await client.post("/api/v1/auth/register", json={"email": email, "password": password})
    
    # Login to get first token
    login_resp = await client.post("/api/v1/auth/login", data={"username": email, "password": password})
    token_info = login_resp.json()
    rt1 = token_info["refresh_token"]

    # First refresh: RT1 is rotated to RT2
    refresh_resp1 = await client.post("/api/v1/auth/refresh", json={"refresh_token": rt1})
    assert refresh_resp1.status_code == 200
    rt2 = refresh_resp1.json()["refresh_token"]

    # Reuse RT1: Should trigger breach action and revoke all tokens
    reuse_resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": rt1})
    assert reuse_resp.status_code == 401
    assert "Compromised" in reuse_resp.json()["error"]["message"]

    # Now verify that even RT2 is revoked/invalidated due to the breach
    refresh_resp2 = await client.post("/api/v1/auth/refresh", json={"refresh_token": rt2})
    assert refresh_resp2.status_code == 401


@pytest.mark.anyio
async def test_logout_revocation(client: AsyncClient) -> None:
    """Verify that logging out revokes the refresh token and prevents future refreshes."""
    email = "logout@example.com"
    password = "secure_password_123"
    await client.post("/api/v1/auth/register", json={"email": email, "password": password})
    login_resp = await client.post("/api/v1/auth/login", data={"username": email, "password": password})
    token_info = login_resp.json()
    refresh_token = token_info["refresh_token"]

    # Logout
    logout_resp = await client.post("/api/v1/auth/logout", json={"refresh_token": refresh_token})
    assert logout_resp.status_code == 200
    assert logout_resp.json()["success"] is True

    # Try refreshing after logout: Should fail
    refresh_resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert refresh_resp.status_code == 401
