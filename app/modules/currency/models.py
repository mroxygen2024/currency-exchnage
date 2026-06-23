from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String
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
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )


class CurrencyConversion(Base):
    """Database model storing history of currency conversions."""

    __tablename__ = "currency_conversions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    from_currency: Mapped[str] = mapped_column(String(3), index=True, nullable=False)
    to_currency: Mapped[str] = mapped_column(String(3), index=True, nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    rate: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    result: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    converted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )


class CurrencyRateHistory(Base):
    """Database model storing historical currency rate changes."""

    __tablename__ = "currency_rate_history"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    base_currency: Mapped[str] = mapped_column(String(3), index=True, nullable=False)
    target_currency: Mapped[str] = mapped_column(String(3), index=True, nullable=False)
    rate: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
        index=True,
    )

