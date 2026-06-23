from datetime import timedelta
from typing import Any
from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.dependencies import get_db, get_current_user_id
from app.core.exceptions import UnauthorizedException
from app.core.security import create_access_token
from app.modules.auth import services
from app.modules.auth.schemas import Token, UserCreate, UserOut

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register", response_model=UserOut, status_code=status.HTTP_201_CREATED
)
async def register(
    user_in: UserCreate, db: AsyncSession = Depends(get_db)
) -> Any:
    """Register a new user to the platform."""
    user = await services.create_user(db, user_in)
    return user


@router.post("/login", response_model=Token)
async def login_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """OAuth2 compatible token login, retrieve a JWT access token."""
    user = await services.authenticate_user(
        db, email=form_data.username, password=form_data.password
    )
    if not user:
        raise UnauthorizedException(
            message="Incorrect email or password.",
            details={"error_code": "INVALID_CREDENTIALS"},
        )

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=str(user.id),
        expires_delta=access_token_expires,
        claims={"email": user.email},
    )

    return Token(access_token=access_token, token_type="bearer")


@router.get("/me", response_model=UserOut)
async def read_users_me(
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Retrieve details of the currently authenticated user."""
    from sqlalchemy import select
    from app.modules.auth.models import User

    result = await db.execute(select(User).where(User.id == int(current_user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise UnauthorizedException(message="User not found.")
    return user
