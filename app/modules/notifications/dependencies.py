from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.notifications.service import NotificationsService


def get_notifications_service(db: AsyncSession = Depends(get_db)) -> NotificationsService:
    """Dependency that instantiates and returns the NotificationsService."""
    return NotificationsService(db)
