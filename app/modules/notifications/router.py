from typing import Any

from fastapi import APIRouter, Depends, status

from app.modules.auth.dependencies import get_current_active_user
from app.modules.auth.models import User
from app.modules.notifications.dependencies import get_notifications_service
from app.modules.notifications.schemas import (
    NotificationSubscriptionCreate,
    NotificationSubscriptionOut,
)
from app.modules.notifications.service import NotificationsService

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.post(
    "/subscribe",
    response_model=NotificationSubscriptionOut,
    status_code=status.HTTP_201_CREATED,
)
async def subscribe_to_alert(
    subscription_in: NotificationSubscriptionCreate,
    current_user: User = Depends(get_current_active_user),
    notifications_service: NotificationsService = Depends(get_notifications_service),
) -> Any:
    """Create a new currency alert subscription for the authenticated user."""
    return await notifications_service.subscribe(current_user, subscription_in)


@router.get(
    "", response_model=list[NotificationSubscriptionOut], status_code=status.HTTP_200_OK
)
async def get_subscriptions(
    current_user: User = Depends(get_current_active_user),
    notifications_service: NotificationsService = Depends(get_notifications_service),
) -> Any:
    """Retrieve all notification subscriptions/alerts for the authenticated user."""
    return await notifications_service.get_subscriptions(current_user)


@router.delete("/{subscription_id}", status_code=status.HTTP_200_OK)
async def delete_subscription(
    subscription_id: int,
    current_user: User = Depends(get_current_active_user),
    notifications_service: NotificationsService = Depends(get_notifications_service),
) -> Any:
    """Delete an active notification alert. Owner or Admin authorization required."""
    await notifications_service.delete_subscription(current_user, subscription_id)
    return {
        "success": True,
        "message": "Notification subscription deleted successfully.",
    }
