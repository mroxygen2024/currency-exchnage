import pytest
from httpx import AsyncClient


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

    # 2. Login to get access token
    login_payload = {"username": "test@example.com", "password": "secure_password_123"}
    # OAuth2 request form expects application/x-www-form-urlencoded format (passed via data)
    login_resp = await client.post("/api/v1/auth/login", data=login_payload)
    assert login_resp.status_code == 200
    token_info = login_resp.json()
    assert token_info["token_type"] == "bearer"
    assert "access_token" in token_info
    token = token_info["access_token"]

    # 3. Retrieve currently logged-in user profile
    headers = {"Authorization": f"Bearer {token}"}
    me_resp = await client.get("/api/v1/auth/me", headers=headers)
    assert me_resp.status_code == 200
    me_info = me_resp.json()
    assert me_info["email"] == "test@example.com"
    assert me_info["id"] == user_info["id"]
