import datetime
from typing import Any

from app.core.config import settings
from app.core.logging import logger
from app.modules.currency.providers.base import BaseExchangeRateProvider
from app.modules.currency.providers.exceptions import (
    ExchangeRateProviderException,
    InvalidCurrencyException,
)
from app.modules.currency.providers.http_client import http_client


class ExchangeRatesAPIProvider(BaseExchangeRateProvider):
    """Concrete implementation for ExchangeRatesAPI (APILayer)."""

    def __init__(self) -> None:
        self.base_url = settings.EXCHANGE_RATE_API_URL.rstrip("/")
        self.api_key = settings.EXCHANGE_RATE_API_KEY

    def _get_auth_params(self) -> dict[str, str]:
        """Return the default authorization parameters."""
        if not self.api_key:
            logger.critical("EXCHANGE_RATE_API_KEY is not set in configuration.")
        return {"access_key": self.api_key}

    async def get_latest_rates(
        self, base: str, symbols: list[str] | None = None
    ) -> dict[str, float]:
        """Fetch the latest exchange rates from /latest."""
        url = f"{self.base_url}/latest"
        params = self._get_auth_params()
        params["base"] = base.upper()
        if symbols:
            params["symbols"] = ",".join(s.upper() for s in symbols)

        try:
            data = await http_client.request("GET", url, params=params)
            return {k: float(v) for k, v in data.get("rates", {}).items()}
        except InvalidCurrencyException:
            raise
        except Exception as exc:
            logger.warn(
                "Failed to fetch latest rates, attempting EUR base fallback",
                base=base,
                error=str(exc),
            )
            # Fallback: on free plan only EUR is allowed as base
            if base.upper() != "EUR":
                eur_rates = await self.get_latest_rates(base="EUR")
                if base.upper() not in eur_rates:
                    raise InvalidCurrencyException(
                        f"Currency '{base}' is not supported."
                    ) from exc

                base_to_eur_rate = eur_rates[base.upper()]
                converted_rates = {}
                for cur, rate_to_eur in eur_rates.items():
                    converted_rates[cur] = rate_to_eur / base_to_eur_rate

                if symbols:
                    symbols_upper = {s.upper() for s in symbols}
                    return {
                        k: v for k, v in converted_rates.items() if k in symbols_upper
                    }
                return converted_rates
            raise

    async def get_historical_rates(
        self, date: str, base: str, symbols: list[str] | None = None
    ) -> dict[str, float]:
        """Fetch historical exchange rates for a date."""
        try:
            datetime.date.fromisoformat(date)
        except ValueError as err:
            raise ExchangeRateProviderException(
                status_code=400,
                code="INVALID_DATE_FORMAT",
                message="Date must be in YYYY-MM-DD format.",
            ) from err

        url = f"{self.base_url}/{date}"
        params = self._get_auth_params()
        params["base"] = base.upper()
        if symbols:
            params["symbols"] = ",".join(s.upper() for s in symbols)

        try:
            data = await http_client.request("GET", url, params=params)
            return {k: float(v) for k, v in data.get("rates", {}).items()}
        except InvalidCurrencyException:
            raise
        except Exception as exc:
            logger.warn(
                "Failed to fetch historical rates, attempting EUR base fallback",
                date=date,
                base=base,
                error=str(exc),
            )
            if base.upper() != "EUR":
                eur_rates = await self.get_historical_rates(date=date, base="EUR")
                if base.upper() not in eur_rates:
                    raise InvalidCurrencyException(
                        f"Currency '{base}' is not supported on date '{date}'."
                    ) from exc

                base_to_eur_rate = eur_rates[base.upper()]
                converted_rates = {}
                for cur, rate_to_eur in eur_rates.items():
                    converted_rates[cur] = rate_to_eur / base_to_eur_rate

                if symbols:
                    symbols_upper = {s.upper() for s in symbols}
                    return {
                        k: v for k, v in converted_rates.items() if k in symbols_upper
                    }
                return converted_rates
            raise

    async def convert(
        self,
        from_currency: str,
        to_currency: str,
        amount: float,
        date: str | None = None,
    ) -> dict[str, Any]:
        """Convert a specific amount using /convert or fallback."""
        url = f"{self.base_url}/convert"
        params = self._get_auth_params()
        params["from"] = from_currency.upper()
        params["to"] = to_currency.upper()
        params["amount"] = amount
        if date:
            params["date"] = date

        try:
            data = await http_client.request("GET", url, params=params)
            return {
                "rate": float(data["info"]["rate"]),
                "result": float(data["result"]),
                "timestamp": int(data["info"]["timestamp"]),
                "date": (data.get("date") or date or datetime.date.today().isoformat()),
            }
        except Exception as exc:
            logger.warn(
                "Convert endpoint failed, falling back to rate lookup",
                error=str(exc),
            )
            if date:
                rates = await self.get_historical_rates(
                    date=date,
                    base=from_currency,
                    symbols=[to_currency],
                )
            else:
                rates = await self.get_latest_rates(
                    base=from_currency,
                    symbols=[to_currency],
                )

            if to_currency.upper() not in rates:
                raise InvalidCurrencyException(
                    f"Could not convert from {from_currency} to {to_currency}."
                ) from exc

            rate = rates[to_currency.upper()]
            result = amount * rate
            return {
                "rate": rate,
                "result": result,
                "timestamp": int(datetime.datetime.now(datetime.UTC).timestamp()),
                "date": (date or datetime.date.today().isoformat()),
            }

    async def get_timeseries(
        self,
        start_date: str,
        end_date: str,
        base: str,
        symbols: list[str] | None = None,
    ) -> dict[str, dict[str, float]]:
        """Fetch historical rates for a range of dates."""
        url = f"{self.base_url}/timeseries"
        params = self._get_auth_params()
        params["start_date"] = start_date
        params["end_date"] = end_date
        params["base"] = base.upper()
        if symbols:
            params["symbols"] = ",".join(s.upper() for s in symbols)

        try:
            data = await http_client.request("GET", url, params=params)
            rates_data = data.get("rates", {})
            result = {}
            for dt, day_rates in rates_data.items():
                result[dt] = {k: float(v) for k, v in day_rates.items()}
            return result
        except Exception as exc:
            logger.warn(
                "Timeseries endpoint failed, falling back to sequential requests",
                error=str(exc),
            )
            start = datetime.date.fromisoformat(start_date)
            end = datetime.date.fromisoformat(end_date)

            days = (end - start).days
            if days > 15:
                logger.warn(
                    "Timeseries fallback too many days, truncating to 15",
                    requested_days=days,
                )
                start = end - datetime.timedelta(days=15)

            result = {}
            current = start
            while current <= end:
                curr_str = current.isoformat()
                try:
                    day_rates = await self.get_historical_rates(
                        date=curr_str,
                        base=base,
                        symbols=symbols,
                    )
                    result[curr_str] = day_rates
                except Exception as day_exc:
                    logger.error(
                        "Failed to get rates for date in timeseries fallback",
                        date=curr_str,
                        error=str(day_exc),
                    )
                current += datetime.timedelta(days=1)
            return result

    async def get_supported_currencies(self) -> dict[str, str]:
        """Fetch supported currency codes from /symbols."""
        url = f"{self.base_url}/symbols"
        params = self._get_auth_params()

        data = await http_client.request("GET", url, params=params)
        return {str(k): str(v) for k, v in data.get("symbols", {}).items()}
