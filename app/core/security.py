from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
import jwt
from fastapi.security import OAuth2PasswordBearer

from app.core.config import settings
from app.core.exceptions import UnauthorizedException

# OAuth2 Password Bearer flow endpoint configuration
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login", auto_error=False
)


# ------------------------------------------------------------------------------
# Hashing Operations (Raw bcrypt for Py3.12+)
# ------------------------------------------------------------------------------
def hash_password(password: str) -> str:
    """Hash a plain text password using bcrypt."""
    pwd_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain text password against its bcrypt hash."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except Exception:
        return False


# ------------------------------------------------------------------------------
# JWT Operations
# ------------------------------------------------------------------------------
def create_access_token(
    subject: str,
    expires_delta: timedelta | None = None,
    claims: dict[str, Any] | None = None,
) -> str:
    """Generate a cryptographically secure JWT Access Token.

    Args:
        subject: The token subject (typically user ID).
        expires_delta: Optional custom duration. Defaults to settings.
        claims: Optional dictionary of additional claims.
    """
    now = datetime.now(UTC)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode = {
        "sub": str(subject),
        "exp": expire,
        "iat": now,
        "nbf": now,
    }
    if claims:
        to_encode.update(claims)

    return jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode and validate a JWT access token.

    Raises:
        UnauthorizedException: If token is expired, invalid, or violates claims.
    """
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            options={"require": ["exp", "sub", "iat"]},
        )
        return payload
    except jwt.ExpiredSignatureError as exc:
        raise UnauthorizedException(
            message="Token has expired.",
            details={"error_code": "TOKEN_EXPIRED"},
        ) from exc
    except jwt.InvalidTokenError as exc:
        raise UnauthorizedException(
            message="Could not validate credentials.",
            details={"error_code": "INVALID_TOKEN"},
        ) from exc
