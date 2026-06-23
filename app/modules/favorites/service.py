from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    BadRequestException,
    ForbiddenException,
    NotFoundException,
)
from app.modules.auth.models import User
from app.modules.favorites.models import FavoritePair
from app.modules.favorites.repository import FavoritesRepository
from app.modules.favorites.schemas import FavoritePairCreate


class FavoritesService:
    """Service class encapsulating business logic for Favorite Currency Pairs."""

    def __init__(self, db: AsyncSession) -> None:
        self.favorites_repo = FavoritesRepository(db)

    async def add_favorite(
        self, user: User, favorite_in: FavoritePairCreate
    ) -> FavoritePair:
        """Add currency pair to user's favorites, checking duplicates."""
        base = favorite_in.base_currency.upper()
        target = favorite_in.target_currency.upper()

        # Prevent duplicate favorite pairs for the same user
        existing = await self.favorites_repo.get_by_user_and_pair(user.id, base, target)
        if existing:
            raise BadRequestException(
                message=f"Favorite currency pair {base}/{target} already exists.",
                details={"error_code": "DUPLICATE_FAVORITE_PAIR"},
            )

        return await self.favorites_repo.create(user.id, base, target)

    async def get_favorites(self, user: User) -> list[FavoritePair]:
        """Retrieve all favorite currency pairs for the authenticated user."""
        return await self.favorites_repo.list_by_user(user.id)

    async def delete_favorite(self, user: User, favorite_id: int) -> None:
        """Delete favorite currency pair, enforcing user ownership/admin role."""
        favorite = await self.favorites_repo.get_by_id(favorite_id)
        if not favorite:
            raise NotFoundException(
                message=f"Favorite currency pair with ID {favorite_id} not found."
            )

        # Authorization check: only owner or admin can delete
        if user.role != "admin" and favorite.user_id != user.id:
            raise ForbiddenException(
                message=(
                    "You do not have permission to delete this favorite currency pair."
                )
            )

        await self.favorites_repo.delete(favorite)
