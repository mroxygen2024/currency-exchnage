from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CurrencyRateBase(BaseModel):
    base_currency: str = Field(
        ...,
        min_length=3,
        max_length=3,
        description="Base 3-letter currency code (e.g. USD)",
    )
    target_currency: str = Field(
        ...,
        min_length=3,
        max_length=3,
        description="Target 3-letter currency code (e.g. EUR)",
    )
    rate: float = Field(..., gt=0, description="Exchange rate multiplier.")


class CurrencyRateCreate(CurrencyRateBase):
    pass


class CurrencyRateUpdate(BaseModel):
    rate: float = Field(..., gt=0, description="New exchange rate multiplier.")


class CurrencyRateOut(CurrencyRateBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    last_updated: datetime


class CurrencyConversionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int | None = Field(
        None, description="The ID of the user who performed the conversion"
    )
    from_currency: str = Field(
        ..., min_length=3, max_length=3, description="Source 3-letter currency code"
    )
    to_currency: str = Field(
        ..., min_length=3, max_length=3, description="Target 3-letter currency code"
    )
    amount: float = Field(..., gt=0, description="Amount to convert")
    rate: float = Field(..., gt=0, description="Exchange rate used for conversion")
    result: float = Field(..., description="Converted amount")
    converted_at: datetime = Field(
        ..., description="Timestamp when conversion occurred"
    )


class PaginatedHistory(BaseModel):
    items: list[CurrencyConversionOut] = Field(
        ..., description="List of conversions on current page"
    )
    total: int = Field(
        ..., description="Total number of conversions matching filter criteria"
    )
    page: int = Field(..., description="Current page number")
    limit: int = Field(..., description="Items per page")
    pages: int = Field(..., description="Total number of pages")


class AnalyticsPair(BaseModel):
    from_currency: str = Field(..., description="Source currency code")
    to_currency: str = Field(..., description="Target currency code")
    count: int = Field(..., description="Number of conversions performed for this pair")
    total_amount: float = Field(
        ..., description="Total volume of amount converted in this pair"
    )


class CurrencyAnalyticsOut(BaseModel):
    total_conversions: int = Field(
        ..., description="Total conversions count in the system"
    )
    popular_pairs: list[AnalyticsPair] = Field(
        ..., description="Top 5 most converted currency pairs"
    )
    total_volume_by_currency: dict[str, float] = Field(
        ..., description="Total volume converted from each currency"
    )
