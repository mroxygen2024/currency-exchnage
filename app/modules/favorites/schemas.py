import re
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class FavoritePairCreate(BaseModel):
    """Pydantic schema for creating a new favorite currency pair."""

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

    @field_validator("base_currency", "target_currency")
    @classmethod
    def validate_currency_code(cls, v: str) -> str:
        """Validate currency code matches a 3-character format and uppercase it."""
        v_upper = v.upper()
        if not re.match(r"^[A-Z]{3}$", v_upper):
            raise ValueError(
                "Currency code must be exactly a 3-character alphabetic code."
            )
        return v_upper

    @model_validator(mode="after")
    def validate_different_currencies(self) -> "FavoritePairCreate":
        """Verify that the base and target currencies are not the same."""
        if self.base_currency == self.target_currency:
            raise ValueError("Base and target currencies must be different.")
        return self


class FavoritePairOut(BaseModel):
    """Pydantic schema for returning favorite currency pair details."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    base_currency: str
    target_currency: str
    created_at: datetime
