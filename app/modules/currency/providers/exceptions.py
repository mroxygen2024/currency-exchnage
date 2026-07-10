from typing import Any

from fastapi import status

from app.core.exceptions import AppException


class ExchangeRateProviderException(AppException):
    """Base exception class for exchange rate provider errors."""

    def __init__(
        self,
        status_code: int = status.HTTP_502_BAD_GATEWAY,
        code: str = "PROVIDER_ERROR",
        message: str = "The exchange rate provider returned an error.",
        details: Any | None = None,
    ) -> None:
        super().__init__(
            status_code=status_code,
            code=code,
            message=message,
            details=details,
        )


class InvalidApiKeyException(ExchangeRateProviderException):
    """Raised when the exchange rate API key is invalid."""

    def __init__(
        self,
        message: str = "Invalid API key provided to external service.",
    ) -> None:
        super().__init__(
            status_code=status.HTTP_502_BAD_GATEWAY,
            code="INVALID_API_KEY",
            message=message,
        )


class ProviderDowntimeException(ExchangeRateProviderException):
    """Raised when the exchange rate provider is down or unreachable."""

    def __init__(
        self,
        message: str = (
            "Exchange rate provider is currently down or unreachable."
        ),
    ) -> None:
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            code="PROVIDER_DOWNTIME",
            message=message,
        )


class RateLimitExceededException(ExchangeRateProviderException):
    """Raised when the exchange rate API rate limit is exceeded."""

    def __init__(
        self, message: str = "Exchange rate API rate limit exceeded."
    ) -> None:
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            code="RATE_LIMIT_EXCEEDED",
            message=message,
        )


class InvalidCurrencyException(ExchangeRateProviderException):
    """Raised when a requested currency is invalid or unsupported."""

    def __init__(
        self,
        message: str = (
            "One or more requested currencies are invalid or unsupported."
        ),
    ) -> None:
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="INVALID_CURRENCY",
            message=message,
        )
