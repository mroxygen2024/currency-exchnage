import asyncio
from collections.abc import Mapping
from typing import Any

import httpx

from app.core.config import settings
from app.core.logging import logger
from app.modules.currency.providers.exceptions import (
    ExchangeRateProviderException,
    InvalidApiKeyException,
    InvalidCurrencyException,
    ProviderDowntimeException,
    RateLimitExceededException,
)


class ExchangeRateHTTPClient:
    """A reusable, pooled HTTP client for exchange rate API.

    Implements timeout, retries with exponential backoff, logging,
    and proper exception handling.
    """

    def __init__(self) -> None:
        self.client: httpx.AsyncClient | None = None

    def get_client(self) -> httpx.AsyncClient:
        """Retrieve or initialize the httpx.AsyncClient."""
        if self.client is None or self.client.is_closed:
            timeout = httpx.Timeout(float(settings.EXCHANGE_RATE_API_TIMEOUT))
            limits = httpx.Limits(
                max_connections=50,
                max_keepalive_connections=10,
            )
            self.client = httpx.AsyncClient(
                timeout=timeout,
                limits=limits,
            )
            logger.info("Initialized reusable ExchangeRateHTTPClient.")
        return self.client

    async def close(self) -> None:
        """Close the underlying HTTP client."""
        if self.client and not self.client.is_closed:
            await self.client.aclose()
            logger.info("Closed ExchangeRateHTTPClient.")

    async def request(
        self,
        method: str,
        url: str,
        params: dict[str, Any] | None = None,
        headers: Mapping[str, str] | None = None,
    ) -> dict[str, Any]:
        """Make an HTTP request with retries and backoff."""
        client = self.get_client()
        max_retries = settings.EXCHANGE_RATE_API_RETRY_COUNT
        backoff_factor = 1.5

        last_exception = None

        for attempt in range(max_retries + 1):
            try:
                logger.debug(
                    "Making HTTP request to provider API",
                    method=method,
                    url=url,
                    params=params,
                    attempt=attempt + 1,
                )
                response = await client.request(
                    method=method,
                    url=url,
                    params=params,
                    headers=headers,
                )

                if response.status_code == 200:
                    data = response.json()
                    # ExchangeRatesAPI returns success: false
                    # instead of HTTP status codes sometimes
                    if isinstance(data, dict) and not data.get("success", True):
                        error_info = data.get("error", {})
                        error_code = error_info.get("code") or error_info.get("type")
                        error_msg = (
                            error_info.get("info")
                            or error_info.get("message")
                            or "Unknown error"
                        )

                        logger.error(
                            "Exchange rate API error response",
                            code=error_code,
                            message=error_msg,
                        )

                        if error_code in (
                            101,
                            "invalid_access_key",
                            "missing_access_key",
                        ):
                            raise InvalidApiKeyException(error_msg)
                        elif error_code in (
                            201,
                            202,
                            "invalid_base_currency",
                            "invalid_currency_codes",
                        ):
                            raise InvalidCurrencyException(error_msg)
                        elif error_code in (
                            104,
                            "requests_amount_reached",
                        ):
                            raise RateLimitExceededException(error_msg)
                        else:
                            raise ExchangeRateProviderException(
                                status_code=400,
                                code="PROVIDER_API_ERROR",
                                message=error_msg,
                            )
                    return data

                if response.status_code == 401:
                    raise InvalidApiKeyException("API key is unauthorized or invalid.")
                elif response.status_code == 429:
                    raise RateLimitExceededException("Rate limit exceeded.")
                elif response.status_code in (400, 404):
                    raise InvalidCurrencyException(
                        f"Invalid currency, URL or parameters: {response.text}"
                    )
                elif response.status_code >= 500:
                    response.raise_for_status()
                else:
                    raise ExchangeRateProviderException(
                        status_code=response.status_code,
                        code="HTTP_ERROR",
                        message=(
                            f"HTTP request failed with status "
                            f"{response.status_code}: "
                            f"{response.text}"
                        ),
                    )

            except (
                httpx.RequestError,
                httpx.HTTPStatusError,
            ) as exc:
                last_exception = exc
                logger.warn(
                    "HTTP request failed/timed out, retrying...",
                    error=str(exc),
                    attempt=attempt + 1,
                    max_retries=max_retries,
                )
                if attempt < max_retries:
                    wait_time = backoff_factor * (2**attempt)
                    await asyncio.sleep(wait_time)
                else:
                    break
            except ExchangeRateProviderException:
                raise
            except Exception as exc:
                logger.error(
                    "Unexpected error in HTTP request",
                    error=str(exc),
                )
                raise ExchangeRateProviderException(
                    status_code=500,
                    code="UNEXPECTED_PROVIDER_ERROR",
                    message=(f"An unexpected error occurred: {str(exc)}"),
                ) from exc

        logger.error(
            "All HTTP retries failed for provider API request",
            url=url,
            error=str(last_exception),
        )
        raise ProviderDowntimeException(
            f"Exchange rate provider request failed after "
            f"{max_retries} retries: {str(last_exception)}"
        )


# Global reusable instance
http_client = ExchangeRateHTTPClient()
