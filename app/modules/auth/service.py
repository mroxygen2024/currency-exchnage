import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import BadRequestException, UnauthorizedException
from app.core.security import create_access_token, hash_password, verify_password
from app.modules.auth.models import RefreshToken, User
from app.modules.auth.repository import RefreshTokenRepository, UserRepository
from app.modules.auth.schemas import UserCreate


class AuthService:
    """Service class encapsulating authentication business logic.

    Maintains modular domain actions, handling registration, verification,
    JWT generation, and secure Refresh Token Rotation (RTR).
    """

    def __init__(self, db: AsyncSession) -> None:
        self.user_repo = UserRepository(db)
        self.token_repo = RefreshTokenRepository(db)

    async def register_user(self, user_in: UserCreate) -> User:
        """Register a new user, ensuring email uniqueness.

        Args:
            user_in: The user creation schema payload containing email and password.

        Returns:
            The newly created User model instance.

        Raises:
            BadRequestException: If a user with the provided email already exists.
        """
        existing_user = await self.user_repo.get_by_email(user_in.email)
        if existing_user:
            raise BadRequestException(
                message="A user with this email address already exists.",
                details={"error_code": "EMAIL_ALREADY_EXISTS"},
            )

        hashed_pwd = hash_password(user_in.password)
        db_user = User(
            email=user_in.email,
            hashed_password=hashed_pwd,
            is_active=True,
        )
        return await self.user_repo.create(db_user)

    async def authenticate_user(self, email: str, password: str) -> User:
        """Verify user credentials and check active status.

        Args:
            email: User's registered email address.
            password: User's plain text password.

        Returns:
            The authenticated User model instance.

        Raises:
            UnauthorizedException: If authentication fails or account is deactivated.
        """
        user = await self.user_repo.get_by_email(email)
        if not user:
            raise UnauthorizedException(
                message="Incorrect email or password.",
                details={"error_code": "INVALID_CREDENTIALS"},
            )

        if not verify_password(password, user.hashed_password):
            raise UnauthorizedException(
                message="Incorrect email or password.",
                details={"error_code": "INVALID_CREDENTIALS"},
            )

        if not user.is_active:
            raise UnauthorizedException(
                message="User account is deactivated.",
                details={"error_code": "USER_DEACTIVATED"},
            )

        return user

    async def create_session_tokens(self, user: User) -> Tuple[str, str]:
        """Generate a new access token and a refresh token for a user.

        The access token is a JWT. The refresh token is a cryptographically
        secure random string whose SHA-256 hash is persisted in the database.

        Args:
            user: The User model instance.

        Returns:
            A tuple of (access_token, refresh_token).
        """
        # 1. Generate JWT access token
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            subject=str(user.id),
            expires_delta=access_token_expires,
            claims={"email": user.email},
        )

        # 2. Generate secure random refresh token
        raw_refresh_token = f"rt_{secrets.token_urlsafe(32)}"
        token_hash = self.token_repo.hash_token(raw_refresh_token)

        # 3. Save refresh token hash to database
        expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        refresh_token_db = RefreshToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at,
        )
        await self.token_repo.create(refresh_token_db)

        return access_token, raw_refresh_token

    async def rotate_refresh_token(self, refresh_token: str) -> Tuple[str, str]:
        """Perform Refresh Token Rotation (RTR).

        Validates the current refresh token, invalidates it, and generates
        a new pair of access and refresh tokens.

        If a reused or revoked token is detected, it is flagged as a potential
        security breach, and all active sessions/tokens for that user are revoked.

        Args:
            refresh_token: The raw refresh token string.

        Returns:
            A tuple of (new_access_token, new_refresh_token).

        Raises:
            UnauthorizedException: If token is invalid, expired, used, or revoked.
        """
        token_hash = self.token_repo.hash_token(refresh_token)
        db_token = await self.token_repo.get_by_hash(token_hash)

        if not db_token:
            raise UnauthorizedException(
                message="Invalid refresh token.",
                details={"error_code": "INVALID_REFRESH_TOKEN"},
            )

        # Token Reuse Detection: If the token is already used or explicitly revoked
        if db_token.is_used or db_token.revoked_at is not None:
            # Revoke all tokens for the user to prevent breach escalation
            await self.token_repo.revoke_all_for_user(db_token.user_id)
            raise UnauthorizedException(
                message="Compromised refresh token detected. Session revoked.",
                details={"error_code": "TOKEN_REUSE_DETECTED"},
            )

        # Expiration Check
        now = datetime.now(timezone.utc)
        expires_at = db_token.expires_at
        now_compare = now.replace(tzinfo=None) if expires_at.tzinfo is None else now

        if expires_at < now_compare:
            await self.token_repo.revoke_by_hash(token_hash, now)
            raise UnauthorizedException(
                message="Refresh token has expired.",
                details={"error_code": "REFRESH_TOKEN_EXPIRED"},
            )

        # Retrieve user to check if they are still active
        user = await self.user_repo.get_by_id(db_token.user_id)
        if not user or not user.is_active:
            raise UnauthorizedException(
                message="User is inactive or not found.",
                details={"error_code": "USER_INACTIVE"},
            )

        # Mark current token as used
        await self.token_repo.mark_as_used(token_hash)
        # Update revoked_at for lineage / explicit state tracking
        await self.token_repo.revoke_by_hash(token_hash, now)

        # Create a new session
        return await self.create_session_tokens(user)

    async def revoke_refresh_token(self, refresh_token: str) -> None:
        """Revoke a specific refresh token (e.g. during logout).

        Args:
            refresh_token: The raw refresh token string to revoke.
        """
        token_hash = self.token_repo.hash_token(refresh_token)
        db_token = await self.token_repo.get_by_hash(token_hash)
        if db_token and db_token.revoked_at is None:
            await self.token_repo.revoke_by_hash(token_hash, datetime.now(timezone.utc))
