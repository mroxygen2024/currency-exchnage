from typing import Any

from fastapi import APIRouter, Depends, Request, status
from fastapi.security import OAuth2PasswordRequestForm

from app.core.audit import log_audit_event
from app.core.config import settings
from app.core.rate_limit import RateLimiter
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

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
    dependencies=[
        Depends(
            RateLimiter(
                limit=settings.RATE_LIMIT_AUTH_LIMIT,
                window=settings.RATE_LIMIT_AUTH_WINDOW,
            )
        )
    ],
)


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(
    request: Request,
    user_in: UserCreate,
    auth_service: AuthService = Depends(get_auth_service),
) -> Any:
    """Register a new user to the platform.

    Validates that the email is unique, hashes the password using bcrypt,
    and registers the user record as active.
    """
    ip_address = request.client.host if request.client else "unknown"
    request_id = getattr(request.state, "request_id", None)
    try:
        user = await auth_service.register_user(user_in)
        log_audit_event(
            action="user.register",
            actor=user.email,
            ip_address=ip_address,
            request_id=request_id,
            resource=f"user:{user.id}",
            status="success",
            details={"email": user.email},
        )
        return user
    except Exception as exc:
        log_audit_event(
            action="user.register",
            actor=user_in.email,
            ip_address=ip_address,
            request_id=request_id,
            status="failure",
            details={"reason": str(exc)},
        )
        raise exc


@router.post("/login", response_model=Token)
async def login_access_token(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    auth_service: AuthService = Depends(get_auth_service),
) -> Any:
    """OAuth2 compatible token login.

    Authenticates user credentials and issues a JWT access token alongside
    a cryptographically secure refresh token for token rotation.
    """
    ip_address = request.client.host if request.client else "unknown"
    request_id = getattr(request.state, "request_id", None)
    try:
        user = await auth_service.authenticate_user(
            email=form_data.username, password=form_data.password
        )
    except Exception as exc:
        log_audit_event(
            action="user.login",
            actor=form_data.username,
            ip_address=ip_address,
            request_id=request_id,
            status="failure",
            details={"reason": str(exc)},
        )
        raise exc

    access_token, refresh_token = await auth_service.create_session_tokens(user)
    log_audit_event(
        action="user.login",
        actor=user.email,
        ip_address=ip_address,
        request_id=request_id,
        resource=f"user:{user.id}",
        status="success",
    )
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
    )


@router.post("/refresh", response_model=Token)
async def refresh_tokens(
    request: Request,
    payload: TokenRefreshRequest,
    auth_service: AuthService = Depends(get_auth_service),
) -> Any:
    """Rotate refresh and access tokens.

    Accepts an active refresh token, revokes it, and yields a new access
    and refresh token pair (Refresh Token Rotation). If token reuse/compromise
    is detected, all user sessions are immediately revoked.
    """
    ip_address = request.client.host if request.client else "unknown"
    request_id = getattr(request.state, "request_id", None)
    try:
        access_token, refresh_token = await auth_service.rotate_refresh_token(
            payload.refresh_token
        )
        log_audit_event(
            action="user.token_refresh",
            actor="anonymous",
            ip_address=ip_address,
            request_id=request_id,
            status="success",
        )
        return Token(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
        )
    except Exception as exc:
        log_audit_event(
            action="user.token_refresh",
            actor="anonymous",
            ip_address=ip_address,
            request_id=request_id,
            status="failure",
            details={"reason": str(exc)},
        )
        raise exc


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(
    request: Request,
    payload: LogoutRequest,
    auth_service: AuthService = Depends(get_auth_service),
) -> Any:
    """Revoke a refresh token to terminate the session.

    Invalidates the supplied refresh token so it can no longer be rotated.
    """
    ip_address = request.client.host if request.client else "unknown"
    request_id = getattr(request.state, "request_id", None)
    try:
        await auth_service.revoke_refresh_token(payload.refresh_token)
        log_audit_event(
            action="user.logout",
            actor="anonymous",
            ip_address=ip_address,
            request_id=request_id,
            status="success",
        )
        return {
            "success": True,
            "message": "Successfully logged out and session revoked.",
        }
    except Exception as exc:
        log_audit_event(
            action="user.logout",
            actor="anonymous",
            ip_address=ip_address,
            request_id=request_id,
            status="failure",
            details={"reason": str(exc)},
        )
        raise exc


@router.get("/me", response_model=UserOut)
async def read_users_me(
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Retrieve details of the currently authenticated active user."""
    return current_user
