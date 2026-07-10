from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    BadRequestException,
    ForbiddenException,
    NotFoundException,
)
from app.modules.auth.models import User
from app.modules.notifications.models import NotificationSubscription
from app.modules.notifications.repository import NotificationsRepository
from app.modules.notifications.schemas import NotificationSubscriptionCreate


class NotificationsService:
    """Service class encapsulating business logic for Currency Alert Notifications."""

    def __init__(self, db: AsyncSession) -> None:
        self.notifications_repo = NotificationsRepository(db)

    async def subscribe(
        self, user: User, subscription_in: NotificationSubscriptionCreate
    ) -> NotificationSubscription:
        """Create a new currency rate alert subscription for the user."""
        base = subscription_in.base_currency.upper()
        target = subscription_in.target_currency.upper()
        threshold = subscription_in.threshold
        condition = subscription_in.condition.lower()

        # Prevent duplicate subscriptions for the same user/pair/condition
        existing = await self.notifications_repo.get_by_unique_constraint(
            user_id=user.id,
            base=base,
            target=target,
            threshold=threshold,
            condition=condition,
        )
        if existing:
            raise BadRequestException(
                message=(
                    f"You are already subscribed to a threshold alert "
                    f"for {base}/{target} {condition} {threshold}."
                ),
                details={"error_code": "DUPLICATE_NOTIFICATION_SUBSCRIPTION"},
            )

        return await self.notifications_repo.create(
            user_id=user.id,
            base=base,
            target=target,
            threshold=threshold,
            condition=condition,
        )

    async def get_subscriptions(self, user: User) -> list[NotificationSubscription]:
        """Retrieve all notification subscriptions for the authenticated user."""
        return await self.notifications_repo.list_by_user(user.id)

    async def delete_subscription(self, user: User, subscription_id: int) -> None:
        """Delete a notification subscription. Owner or Admin authorization required."""
        subscription = await self.notifications_repo.get_by_id(subscription_id)
        if not subscription:
            raise NotFoundException(
                message=(
                    f"Notification subscription with ID {subscription_id} not found."
                )
            )

        # Authorization check: only owner or admin can delete
        if user.role != "admin" and subscription.user_id != user.id:
            raise ForbiddenException(
                message=(
                    "You do not have permission to delete "
                    "this notification subscription."
                )
            )

        await self.notifications_repo.delete(subscription)
