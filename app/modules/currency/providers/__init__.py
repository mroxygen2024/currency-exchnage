from app.modules.currency.providers.base import BaseExchangeRateProvider
from app.modules.currency.providers.exchangerates_api import (
    ExchangeRatesAPIProvider,
)
from app.modules.currency.providers.http_client import http_client as http_client


# Provider instance or factory
def get_exchange_rate_provider() -> BaseExchangeRateProvider:
    """Factory function to get the configured exchange rate provider.

    If we want to switch the provider to Fixer, Frankfurter, or
    CurrencyLayer, we only need to change the returned class here.
    """
    return ExchangeRatesAPIProvider()
