from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.favorites.service import FavoritesService


def get_favorites_service(db: AsyncSession = Depends(get_db)) -> FavoritesService:
    """Dependency that instantiates and returns the FavoritesService."""
    return FavoritesService(db)
