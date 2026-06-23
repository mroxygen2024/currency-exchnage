from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user_id
from app.core.exceptions import UnauthorizedException
from app.modules.auth.models import User
from app.modules.auth.repository import UserRepository
from app.modules.auth.service import AuthService


def get_auth_service(db: AsyncSession = Depends(get_db)) -> AuthService:
    """Dependency that instantiates and returns the AuthService.

    Provides a clean, transaction-scoped AuthService to endpoints.
    """
    return AuthService(db)


async def get_current_active_user(
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Dependency to retrieve the currently authenticated and active User model.

    Resolves the user ID extracted by `get_current_user_id` against the database
    and validates that the user exists and is active.

    Raises:
        UnauthorizedException: If user is not found or is deactivated.
    """
    user_repo = UserRepository(db)
    user = await user_repo.get_by_id(int(current_user_id))
    if not user:
        raise UnauthorizedException(
            message="User not found.",
            details={"error_code": "USER_NOT_FOUND"},
        )
    if not user.is_active or user.is_deleted:
        raise UnauthorizedException(
            message="User account is deactivated or deleted.",
            details={"error_code": "USER_DEACTIVATED"},
        )
    return user
