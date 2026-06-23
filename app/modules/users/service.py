from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestException
from app.core.security import hash_password, verify_password
from app.modules.auth.models import User
from app.modules.auth.repository import RefreshTokenRepository
from app.modules.users.repository import UsersRepository
from app.modules.users.schemas import UserPasswordChange, UserProfileUpdate


class UsersService:
    """Service class encapsulating business logic for User profile and lifecycle management.

    Handles updating profiles, changing passwords, and soft-deleting accounts,
    while ensuring security concerns like revoking all active sessions (tokens)
    upon password change or deletion are addressed.
    """

    def __init__(self, db: AsyncSession) -> None:
        self.users_repo = UsersRepository(db)
        self.token_repo = RefreshTokenRepository(db)

    async def update_profile(self, user: User, profile_in: UserProfileUpdate) -> User:
        """Update the profile details of a user, verifying email uniqueness if modified."""
        update_data = profile_in.model_dump(exclude_unset=True)
        if not update_data:
            return user

        if "email" in update_data and update_data["email"] != user.email:
            existing_user = await self.users_repo.get_by_email(update_data["email"])
            if existing_user:
                raise BadRequestException(
                    message="A user with this email address already exists.",
                    details={"error_code": "EMAIL_ALREADY_EXISTS"},
                )

        return await self.users_repo.update(user, update_data)

    async def change_password(self, user: User, password_in: UserPasswordChange) -> User:
        """Verify the current password, hash the new one, and invalidate all active sessions."""
        if not verify_password(password_in.current_password, user.hashed_password):
            raise BadRequestException(
                message="Incorrect current password.",
                details={"error_code": "INCORRECT_CURRENT_PASSWORD"},
            )

        new_hashed = hash_password(password_in.new_password)
        updated_user = await self.users_repo.update(user, {"hashed_password": new_hashed})

        # Security breach containment: force logout on all devices when password changes
        await self.token_repo.revoke_all_for_user(user.id)

        return updated_user

    async def soft_delete_account(self, user: User) -> User:
        """Soft delete the user account and immediately invalidate all active sessions."""
        # Revoke all refresh tokens
        await self.token_repo.revoke_all_for_user(user.id)

        # Mark user as deleted
        return await self.users_repo.soft_delete(user)
