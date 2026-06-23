from typing import Any
from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordRequestForm

from app.modules.auth.dependencies import get_auth_service, get_current_active_user
from app.modules.auth.models import User
from app.modules.auth.schemas import (
    LogoutRequest,
    Token,
    TokenRefreshRequest,
    UserCreate,
    UserOut,
)
from app.modules.auth.service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register", response_model=UserOut, status_code=status.HTTP_201_CREATED
)
async def register(
    user_in: UserCreate,
    auth_service: AuthService = Depends(get_auth_service),
) -> Any:
    """Register a new user to the platform.

    Validates that the email is unique, hashes the password using bcrypt,
    and registers the user record as active.
    """
    user = await auth_service.register_user(user_in)
    return user


@router.post("/login", response_model=Token)
async def login_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    auth_service: AuthService = Depends(get_auth_service),
) -> Any:
    """OAuth2 compatible token login.

    Authenticates user credentials and issues a JWT access token alongside
    a cryptographically secure refresh token for token rotation.
    """
    user = await auth_service.authenticate_user(
        email=form_data.username, password=form_data.password
    )
    access_token, refresh_token = await auth_service.create_session_tokens(user)
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
    )


@router.post("/refresh", response_model=Token)
async def refresh_tokens(
    payload: TokenRefreshRequest,
    auth_service: AuthService = Depends(get_auth_service),
) -> Any:
    """Rotate refresh and access tokens.

    Accepts an active refresh token, revokes it, and yields a new access
    and refresh token pair (Refresh Token Rotation). If token reuse/compromise
    is detected, all user sessions are immediately revoked.
    """
    access_token, refresh_token = await auth_service.rotate_refresh_token(
        payload.refresh_token
    )
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
    )


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(
    payload: LogoutRequest,
    auth_service: AuthService = Depends(get_auth_service),
) -> Any:
    """Revoke a refresh token to terminate the session.

    Invalidates the supplied refresh token so it can no longer be rotated.
    """
    await auth_service.revoke_refresh_token(payload.refresh_token)
    return {"success": True, "message": "Successfully logged out and session revoked."}


@router.get("/me", response_model=UserOut)
async def read_users_me(
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Retrieve details of the currently authenticated active user."""
    return current_user
