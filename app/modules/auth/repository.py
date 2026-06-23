import hashlib
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import RefreshToken, User


class UserRepository:
    """Repository class for handling User model database interactions."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, user_id: int) -> Optional[User]:
        """Fetch a User by their unique numeric ID."""
        stmt = select(User).where(User.id == user_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> Optional[User]:
        """Fetch a User by their email address."""
        stmt = select(User).where(User.email == email)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def create(self, user: User) -> User:
        """Add and persist a new User in the database."""
        self.db.add(user)
        await self.db.flush()
        return user


class RefreshTokenRepository:
    """Repository class for handling RefreshToken model database interactions."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    @staticmethod
    def hash_token(token: str) -> str:
        """Utility method to compute the SHA-256 hash of a raw token string.

        Using SHA-256 ensures that if the database is compromised, the attacker
        cannot read the plaintext refresh tokens to construct valid requests.
        """
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    async def get_by_hash(self, token_hash: str) -> Optional[RefreshToken]:
        """Retrieve a RefreshToken record by its SHA-256 hash."""
        stmt = select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def create(self, refresh_token: RefreshToken) -> RefreshToken:
        """Add and persist a new RefreshToken in the database."""
        self.db.add(refresh_token)
        await self.db.flush()
        return refresh_token

    async def mark_as_used(self, token_hash: str) -> None:
        """Mark a refresh token as used (e.g. during rotation)."""
        stmt = (
            update(RefreshToken)
            .where(RefreshToken.token_hash == token_hash)
            .values(is_used=True)
        )
        await self.db.execute(stmt)

    async def revoke_by_hash(self, token_hash: str, revoked_at: datetime) -> None:
        """Revoke a specific refresh token by setting its revoked_at timestamp."""
        stmt = (
            update(RefreshToken)
            .where(RefreshToken.token_hash == token_hash)
            .values(revoked_at=revoked_at)
        )
        await self.db.execute(stmt)

    async def revoke_all_for_user(self, user_id: int) -> None:
        """Revoke all active refresh tokens for a user (e.g. on token reuse or logout)."""
        stmt = (
            update(RefreshToken)
            .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=datetime.now(timezone.utc))
        )
        await self.db.execute(stmt)
