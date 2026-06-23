from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.favorites.models import FavoritePair


class FavoritesRepository:
    """Repository class for handling database operations for Favorite Currency Pairs."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, favorite_id: int) -> FavoritePair | None:
        """Fetch a FavoritePair by its unique numeric ID."""
        stmt = select(FavoritePair).where(FavoritePair.id == favorite_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_user_and_pair(
        self, user_id: int, base_currency: str, target_currency: str
    ) -> FavoritePair | None:
        """Fetch a FavoritePair for a specific user and currency pair."""
        stmt = select(FavoritePair).where(
            FavoritePair.user_id == user_id,
            FavoritePair.base_currency == base_currency.upper(),
            FavoritePair.target_currency == target_currency.upper(),
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_by_user(self, user_id: int) -> list[FavoritePair]:
        """Fetch all FavoritePairs for a specific user."""
        stmt = (
            select(FavoritePair)
            .where(FavoritePair.user_id == user_id)
            .order_by(FavoritePair.created_at.desc())
        )
        result = await self.db.execute(stmt)

        return list(result.scalars().all())

    async def create(
        self, user_id: int, base_currency: str, target_currency: str
    ) -> FavoritePair:
        """Create a new FavoritePair entry in the database."""
        favorite = FavoritePair(
            user_id=user_id,
            base_currency=base_currency.upper(),
            target_currency=target_currency.upper(),
        )
        self.db.add(favorite)
        await self.db.flush()
        return favorite

    async def delete(self, favorite: FavoritePair) -> None:
        """Delete a FavoritePair entry from the database."""
        await self.db.delete(favorite)
        await self.db.flush()
