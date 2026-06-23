from typing import Any
from fastapi import APIRouter, Depends, status

from app.modules.auth.dependencies import get_current_active_user
from app.modules.auth.models import User
from app.modules.auth.schemas import UserOut
from app.modules.users.dependencies import get_users_service
from app.modules.users.schemas import UserPasswordChange, UserProfileUpdate
from app.modules.users.service import UsersService

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserOut)
async def get_me(
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Retrieve details of the currently authenticated active user."""
    return current_user


@router.put("/me", response_model=UserOut)
async def update_profile(
    profile_in: UserProfileUpdate,
    current_user: User = Depends(get_current_active_user),
    users_service: UsersService = Depends(get_users_service),
) -> Any:
    """Update profile information for the currently authenticated user."""
    return await users_service.update_profile(current_user, profile_in)


@router.put("/me/password", status_code=status.HTTP_200_OK)
async def change_password(
    password_in: UserPasswordChange,
    current_user: User = Depends(get_current_active_user),
    users_service: UsersService = Depends(get_users_service),
) -> Any:
    """Change the password for the currently authenticated user.

    Validates the current password and revokes all active sessions upon success.
    """
    await users_service.change_password(current_user, password_in)
    return {"success": True, "message": "Password updated successfully. Active sessions revoked."}


@router.delete("/me", status_code=status.HTTP_200_OK)
async def delete_my_account(
    current_user: User = Depends(get_current_active_user),
    users_service: UsersService = Depends(get_users_service),
) -> Any:
    """Soft delete the currently authenticated user's account.

    Deactivates the account and invalidates all active sessions.
    """
    await users_service.soft_delete_account(current_user)
    return {"success": True, "message": "Your account has been successfully deleted."}
