# ruff: noqa: E501
from datetime import UTC, datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class NotificationSubscription(Base):
    """Database model for currency rate notification subscriptions."""

    __tablename__ = "notification_subscriptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    base_currency: Mapped[str] = mapped_column(String(3), index=True, nullable=False)
    target_currency: Mapped[str] = mapped_column(String(3), index=True, nullable=False)
    threshold: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    condition: Mapped[str] = mapped_column(
        String(10), nullable=False
    )  # "above" or "below"
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_triggered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    # Relationships
    user = relationship("User")

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "base_currency",
            "target_currency",
            "threshold",
            "condition",
            name="uq_user_notification_sub",
        ),
    )
