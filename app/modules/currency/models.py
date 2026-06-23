from datetime import datetime, timezone
from sqlalchemy import DateTime, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class CurrencyRate(Base):
    """Database model storing historical or real-time currency exchange rates."""

    __tablename__ = "currency_rates"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    base_currency: Mapped[str] = mapped_column(String(3), index=True, nullable=False)
    target_currency: Mapped[str] = mapped_column(String(3), index=True, nullable=False)
    rate: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    last_updated: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
