from typing import Any

from fastapi import APIRouter, Depends, Request, status

from app.core.audit import log_audit_event
from app.core.config import settings
from app.core.rate_limit import RateLimiter
from app.modules.auth.dependencies import get_current_active_user
from app.modules.auth.models import User
from app.modules.favorites.dependencies import get_favorites_service
from app.modules.favorites.schemas import FavoritePairCreate, FavoritePairOut
from app.modules.favorites.service import FavoritesService

router = APIRouter(
    prefix="/favorites",
    tags=["Favorites"],
    dependencies=[Depends(RateLimiter(limit=settings.RATE_LIMIT_DEFAULT_LIMIT, window=settings.RATE_LIMIT_DEFAULT_WINDOW))],
)


@router.post("", response_model=FavoritePairOut, status_code=status.HTTP_201_CREATED)
async def add_favorite(
    request: Request,
    favorite_in: FavoritePairCreate,
    current_user: User = Depends(get_current_active_user),
    favorites_service: FavoritesService = Depends(get_favorites_service),
) -> Any:
    """Add a currency pair to the authenticated user's favorites."""
    ip_address = request.client.host if request.client else "unknown"
    request_id = getattr(request.state, "request_id", None)
    try:
        fav = await favorites_service.add_favorite(current_user, favorite_in)
        log_audit_event(
            action="favorite.add",
            actor=current_user.email,
            ip_address=ip_address,
            request_id=request_id,
            resource=f"favorite:{fav.id}",
            status="success",
            details={"base": fav.base_currency, "target": fav.target_currency},
        )
        return fav
    except Exception as exc:
        log_audit_event(
            action="favorite.add",
            actor=current_user.email,
            ip_address=ip_address,
            request_id=request_id,
            status="failure",
            details={"reason": str(exc)},
        )
        raise exc


@router.get("", response_model=list[FavoritePairOut], status_code=status.HTTP_200_OK)
async def get_favorites(
    current_user: User = Depends(get_current_active_user),
    favorites_service: FavoritesService = Depends(get_favorites_service),
) -> Any:
    """Retrieve all favorite currency pairs for the authenticated user."""
    return await favorites_service.get_favorites(current_user)


@router.delete("/{favorite_id}", status_code=status.HTTP_200_OK)
async def delete_favorite(
    request: Request,
    favorite_id: int,
    current_user: User = Depends(get_current_active_user),
    favorites_service: FavoritesService = Depends(get_favorites_service),
) -> Any:
    """Delete a favorite currency pair. Owner or Admin authorization required."""
    ip_address = request.client.host if request.client else "unknown"
    request_id = getattr(request.state, "request_id", None)
    try:
        await favorites_service.delete_favorite(current_user, favorite_id)
        log_audit_event(
            action="favorite.delete",
            actor=current_user.email,
            ip_address=ip_address,
            request_id=request_id,
            resource=f"favorite:{favorite_id}",
            status="success",
        )
        return {"success": True, "message": "Favorite currency pair deleted successfully."}
    except Exception as exc:
        log_audit_event(
            action="favorite.delete",
            actor=current_user.email,
            ip_address=ip_address,
            request_id=request_id,
            resource=f"favorite:{favorite_id}",
            status="failure",
            details={"reason": str(exc)},
        )
        raise exc
