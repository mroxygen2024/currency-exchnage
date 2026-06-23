from typing import Any

from fastapi import APIRouter, Depends, status

from app.modules.auth.dependencies import get_current_active_user
from app.modules.auth.models import User
from app.modules.favorites.dependencies import get_favorites_service
from app.modules.favorites.schemas import FavoritePairCreate, FavoritePairOut
from app.modules.favorites.service import FavoritesService

router = APIRouter(prefix="/favorites", tags=["Favorites"])


@router.post("", response_model=FavoritePairOut, status_code=status.HTTP_201_CREATED)
async def add_favorite(
    favorite_in: FavoritePairCreate,
    current_user: User = Depends(get_current_active_user),
    favorites_service: FavoritesService = Depends(get_favorites_service),
) -> Any:
    """Add a currency pair to the authenticated user's favorites."""
    return await favorites_service.add_favorite(current_user, favorite_in)


@router.get("", response_model=list[FavoritePairOut], status_code=status.HTTP_200_OK)
async def get_favorites(
    current_user: User = Depends(get_current_active_user),
    favorites_service: FavoritesService = Depends(get_favorites_service),
) -> Any:
    """Retrieve all favorite currency pairs for the authenticated user."""
    return await favorites_service.get_favorites(current_user)


@router.delete("/{favorite_id}", status_code=status.HTTP_200_OK)
async def delete_favorite(
    favorite_id: int,
    current_user: User = Depends(get_current_active_user),
    favorites_service: FavoritesService = Depends(get_favorites_service),
) -> Any:
    """Delete a favorite currency pair. Owner or Admin authorization required."""
    await favorites_service.delete_favorite(current_user, favorite_id)
    return {"success": True, "message": "Favorite currency pair deleted successfully."}
