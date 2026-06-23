from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import User


class UsersRepository:
    """Repository class for handling User database operations for the Users module."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, user_id: int) -> User | None:
        """Fetch a User by their unique numeric ID."""
        stmt = select(User).where(User.id == user_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> User | None:
        """Fetch a User by their email address."""
        stmt = select(User).where(User.email == email)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def update(self, user: User, update_data: dict[str, Any]) -> User:
        """Update user model properties and flush changes to the database."""
        for key, value in update_data.items():
            if value is not None:
                setattr(user, key, value)
        await self.db.flush()
        return user

    async def soft_delete(self, user: User) -> User:
        """Mark a user account as deleted and set a timestamp."""
        user.is_deleted = True
        user.is_active = False
        user.deleted_at = datetime.now(UTC)
        await self.db.flush()
        return user
