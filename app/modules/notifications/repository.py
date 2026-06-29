from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.notifications.models import NotificationSubscription


class NotificationsRepository:
    """Repository class for handling database operations for Notification Subscriptions."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, subscription_id: int) -> NotificationSubscription | None:
        """Fetch a NotificationSubscription by its ID."""
        stmt = select(NotificationSubscription).where(
            NotificationSubscription.id == subscription_id
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_unique_constraint(
        self, user_id: int, base: str, target: str, threshold: float, condition: str
    ) -> NotificationSubscription | None:
        """Fetch a subscription by unique constraint parameters to check for duplicates."""
        stmt = select(NotificationSubscription).where(
            NotificationSubscription.user_id == user_id,
            NotificationSubscription.base_currency == base.upper(),
            NotificationSubscription.target_currency == target.upper(),
            NotificationSubscription.threshold == threshold,
            NotificationSubscription.condition == condition.lower(),
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_by_user(self, user_id: int) -> list[NotificationSubscription]:
        """Fetch all NotificationSubscriptions for a specific user."""
        stmt = (
            select(NotificationSubscription)
            .where(NotificationSubscription.user_id == user_id)
            .order_by(NotificationSubscription.created_at.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def list_active_by_pair(
        self, base: str, target: str
    ) -> list[NotificationSubscription]:
        """Fetch all active NotificationSubscriptions for a currency pair."""
        stmt = select(NotificationSubscription).where(
            NotificationSubscription.base_currency == base.upper(),
            NotificationSubscription.target_currency == target.upper(),
            NotificationSubscription.is_active,
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create(
        self, user_id: int, base: str, target: str, threshold: float, condition: str
    ) -> NotificationSubscription:
        """Create a new NotificationSubscription entry."""
        subscription = NotificationSubscription(
            user_id=user_id,
            base_currency=base.upper(),
            target_currency=target.upper(),
            threshold=threshold,
            condition=condition.lower(),
        )
        self.db.add(subscription)
        await self.db.flush()
        return subscription

    async def delete(self, subscription: NotificationSubscription) -> None:
        """Delete a NotificationSubscription entry."""
        await self.db.delete(subscription)
        await self.db.flush()
