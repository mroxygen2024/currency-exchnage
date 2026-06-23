from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class CurrencyRateBase(BaseModel):
    base_currency: str = Field(..., min_length=3, max_length=3, description="Base 3-letter currency code (e.g. USD)")
    target_currency: str = Field(..., min_length=3, max_length=3, description="Target 3-letter currency code (e.g. EUR)")
    rate: float = Field(..., gt=0, description="Exchange rate multiplier.")


class CurrencyRateCreate(CurrencyRateBase):
    pass


class CurrencyRateUpdate(BaseModel):
    rate: float = Field(..., gt=0, description="New exchange rate multiplier.")


class CurrencyRateOut(CurrencyRateBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    last_updated: datetime
