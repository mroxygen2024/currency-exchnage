from abc import ABC, abstractmethod
from typing import Any


class BaseExchangeRateProvider(ABC):
    """Abstract base class for all exchange rate API providers.
    
    Any new exchange rate API integration (e.g., Fixer, Frankfurter, CurrencyLayer)
    must subclass this and implement all methods.
    """

    @abstractmethod
    async def get_latest_rates(
        self, base: str, symbols: list[str] | None = None
    ) -> dict[str, float]:
        """Fetch the latest exchange rates for a base currency.
        
        Args:
            base: The 3-letter ISO currency code (e.g., USD).
            symbols: Optional list of target currency codes.
            
        Returns:
            A dict mapping target currency code to rate (float).
        """
        pass

    @abstractmethod
    async def get_historical_rates(
        self, date: str, base: str, symbols: list[str] | None = None
    ) -> dict[str, float]:
        """Fetch historical exchange rates for a specific date (YYYY-MM-DD).
        
        Args:
            date: Date string in YYYY-MM-DD format.
            base: The 3-letter ISO currency code.
            symbols: Optional list of target currency codes.
            
        Returns:
            A dict mapping target currency code to rate (float).
        """
        pass

    @abstractmethod
    async def convert(
        self, from_currency: str, to_currency: str, amount: float, date: str | None = None
    ) -> dict[str, Any]:
        """Convert a specific amount from one currency to another, optionally on a specific date.
        
        Args:
            from_currency: Source currency code.
            to_currency: Target currency code.
            amount: Amount to convert.
            date: Optional date string in YYYY-MM-DD format.
            
        Returns:
            A dictionary containing conversion details (rate, result, timestamp).
        """
        pass

    @abstractmethod
    async def get_timeseries(
        self, start_date: str, end_date: str, base: str, symbols: list[str] | None = None
    ) -> dict[str, dict[str, float]]:
        """Fetch historical rates for a range of dates.
        
        Args:
            start_date: Start date (YYYY-MM-DD).
            end_date: End date (YYYY-MM-DD).
            base: Base currency code.
            symbols: Optional list of target currency codes.
            
        Returns:
            A nested dictionary: {date_str: {currency_code: rate}}.
        """
        pass

    @abstractmethod
    async def get_supported_currencies(self) -> dict[str, str]:
        """Fetch all supported currency codes and their full names.
        
        Returns:
            A dictionary mapping 3-letter currency codes to full names.
        """
        pass
