
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import ForbiddenException
from app.modules.auth.dependencies import get_current_active_user
from app.modules.auth.models import User
from app.modules.users.service import UsersService


def get_users_service(db: AsyncSession = Depends(get_db)) -> UsersService:
    """Dependency that instantiates and returns the UsersService.

    Provides a transaction-scoped UsersService to endpoints.
    """
    return UsersService(db)


def require_role(allowed_roles: list[str]):
    """Role-based access control (RBAC) dependency builder.

    Verifies that the current user has one of the specified roles.
    Allows for route-level protection based on roles.
    """

    async def dependency(current_user: User = Depends(get_current_active_user)) -> User:
        if current_user.role not in allowed_roles:
            raise ForbiddenException(
                message="You do not have permission to perform this action.",
                details={
                    "error_code": "INSUFFICIENT_PERMISSIONS",
                    "required_roles": allowed_roles,
                    "user_role": current_user.role,
                },
            )
        return current_user

    return dependency
