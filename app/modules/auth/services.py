from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestException, NotFoundException
from app.core.security import hash_password, verify_password
from app.modules.auth.models import User
from app.modules.auth.schemas import UserCreate


async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    """Retrieve a user from the database by email address."""
    stmt = select(User).where(User.email == email)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def authenticate_user(
    db: AsyncSession, email: str, password: str
) -> Optional[User]:
    """Authenticate user credentials.

    Verifies the password if user exists and is active.
    """
    user = await get_user_by_email(db, email)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    if not user.is_active:
        return None
    return user


async def create_user(db: AsyncSession, user_in: UserCreate) -> User:
    """Create a new user in the database.

    Raises:
        BadRequestException: If user with matching email already exists.
    """
    existing_user = await get_user_by_email(db, user_in.email)
    if existing_user:
        raise BadRequestException(
            message="A user with this email address already exists."
        )

    hashed_pwd = hash_password(user_in.password)
    db_user = User(
        email=user_in.email,
        hashed_password=hashed_pwd,
        is_active=True,
    )
    db.add(db_user)
    await db.flush()  # Flushes model to assign ID
    return db_user
