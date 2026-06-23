from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class FavoritePair(Base):
    """Database model for storing a user's favorite currency pairs."""

    __tablename__ = "favorite_pairs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    base_currency: Mapped[str] = mapped_column(String(3), index=True, nullable=False)
    target_currency: Mapped[str] = mapped_column(String(3), index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    # Relationship to user
    user = relationship("User")

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "base_currency",
            "target_currency",
            name="uq_user_favorite_pair",
        ),
    )
