from fastapi import Depends

from app.core.exceptions import UnauthorizedException
from app.core.security import decode_access_token, oauth2_scheme


async def get_current_user_id(token: str = Depends(oauth2_scheme)) -> str:
    """Validate token credentials and retrieve the authenticated User ID.

    This dependency extracts the JWT from the request authorization headers,
    decodes it, verifies validity, and returns the User ID ('sub' claim).
    """
    if not token:
        raise UnauthorizedException(
            message="Authentication credentials were not provided.",
            details={"error_code": "CREDENTIALS_MISSING"},
        )

    payload = decode_access_token(token)
    user_id: str = payload.get("sub")
    if not user_id:
        raise UnauthorizedException(
            message="Token payload is invalid. Subject is missing.",
            details={"error_code": "SUBJECT_MISSING"},
        )

    return user_id


async def get_optional_user_id(token: str = Depends(oauth2_scheme)) -> str | None:
    """Retrieve the User ID from the Authorization header if provided.

    If no token is provided, returns None. If a token is provided but is
    invalid or expired, raises the corresponding UnauthorizedException.
    """
    if not token:
        return None

    payload = decode_access_token(token)
    user_id: str = payload.get("sub")
    if not user_id:
        raise UnauthorizedException(
            message="Token payload is invalid. Subject is missing.",
            details={"error_code": "SUBJECT_MISSING"},
        )

    return user_id
