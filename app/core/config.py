from typing import Annotated, Any
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from pydantic import BeforeValidator, computed_field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def parse_cors_origins(v: Any) -> list[str]:
    if isinstance(v, str):
        return [item.strip() for item in v.split(",") if item.strip()]
    if isinstance(v, list):
        return [str(item) for item in v]
    return []


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # --------------------------------------------------------------------------
    # General API Configuration
    # --------------------------------------------------------------------------
    PROJECT_NAME: str = "Currency Tracker Platform"
    ENV: str = "development"
    DEBUG: bool = True
    API_V1_STR: str = "/api/v1"

    BACKEND_CORS_ORIGINS: Annotated[Any, BeforeValidator(parse_cors_origins)] = []

    # --------------------------------------------------------------------------
    # Security Configuration
    # --------------------------------------------------------------------------
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Rate Limiting Configurations (Environment configurable)
    RATE_LIMIT_DEFAULT_LIMIT: int = 100
    RATE_LIMIT_DEFAULT_WINDOW: int = 60
    RATE_LIMIT_AUTH_LIMIT: int = 10
    RATE_LIMIT_AUTH_WINDOW: int = 60

    @model_validator(mode="after")
    def validate_production_security(self) -> "Settings":
        """Enforce strict security validation in production environment."""
        if self.ENV == "production":
            if not self.SECRET_KEY or len(self.SECRET_KEY) < 32:
                raise ValueError(
                    "SECRET_KEY must be at least 32 characters in production."
                )
            if "*" in self.BACKEND_CORS_ORIGINS:
                raise ValueError(
                    "Wildcard CORS origins '*' is not allowed in production."
                )
        return self

    # --------------------------------------------------------------------------
    # Database Configuration (PostgreSQL)
    # --------------------------------------------------------------------------
    DATABASE_URL: str = ""
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "currency_tracker"
    DATABASE_SSLMODE: str = ""
    PGCHANNELBINDING: str = ""

    # Pool Settings
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_PRE_PING: bool = True
    DB_POOL_RECYCLE: int = 1800

    # --------------------------------------------------------------------------
    # Cache Configuration (Redis)
    # --------------------------------------------------------------------------
    REDIS_URL: str = ""
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_PASSWORD: str = ""
    REDIS_MAX_CONNECTIONS: int = 50
    CACHE_EXPIRE_SECONDS: int = 600

    # --------------------------------------------------------------------------
    # Email / SMTP Configuration
    # --------------------------------------------------------------------------
    EMAILS_FROM_EMAIL: str = "noreply@currencytracker.com"
    EMAILS_FROM_NAME: str = "Currency Tracker"
    SMTP_HOST: str = "localhost"
    SMTP_PORT: int = 1025
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_SECURE: bool = False

    # --------------------------------------------------------------------------
    # Exchange Rate API Configuration (APILayer)
    # --------------------------------------------------------------------------
    EXCHANGE_RATE_API_URL: str = "https://api.exchangeratesapi.io/v1/"
    EXCHANGE_RATE_API_KEY: str = ""
    EXCHANGE_RATE_API_TIMEOUT: int = 10
    EXCHANGE_RATE_API_RETRY_COUNT: int = 3
    EXCHANGE_RATE_API_CACHE_TTL: int = 600

    # --------------------------------------------------------------------------
    # Computed Properties
    # --------------------------------------------------------------------------
    @computed_field
    @property
    def async_database_url(self) -> str:
        """Construct the async database URL using the asyncpg driver.

        If DATABASE_URL is provided (e.g. from Render), use it directly.
        Otherwise, construct from individual components with SSL support.

        NOTE: asyncpg does NOT accept ``sslmode`` as a URL query parameter.
        Providers like Neon and Render inject ``sslmode=require`` in their
        connection strings. We strip it here and enforce SSL via the engine's
        ``connect_args`` instead (see database.py).
        """
        if self.DATABASE_URL:
            url = self.DATABASE_URL
            # Upgrade standard postgresql:// to async:// driver
            if url.startswith("postgresql://"):
                url = "postgresql+asyncpg://" + url[len("postgresql://") :]
            elif url.startswith("postgres://"):
                url = "postgresql+asyncpg://" + url[len("postgres://") :]
            # Strip sslmode – asyncpg does not understand it as a URL param
            parsed = urlparse(url)
            params = parse_qs(parsed.query, keep_blank_values=True)
            params.pop("sslmode", None)
            params.pop("channel_binding", None)
            rebuilt_query = urlencode(params, doseq=True)
            url = urlunparse(parsed._replace(query=rebuilt_query))
            return url

        # Fallback: construct from individual components (no sslmode in URL)
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @computed_field
    @property
    def database_ssl_enabled(self) -> bool:
        """Whether the async database connection should enforce SSL.

        Used by database.py ``connect_args`` instead of passing ``sslmode``
        in the URL (which asyncpg does not support).
        """
        if self.ENV == "production":
            return True
        if self.DATABASE_SSLMODE and self.DATABASE_SSLMODE not in (
            "disable",
            "allow",
        ):
            return True
        return False

    @computed_field
    @property
    def redis_url(self) -> str:
        """Construct the Redis connection URL.

        If REDIS_URL is provided (e.g. from Render), use it directly.
        Otherwise, construct from individual components with SSL support.
        """
        if self.REDIS_URL:
            url = self.REDIS_URL
            # Render uses rediss:// (SSL) - keep as-is
            # Ensure proper scheme
            if url.startswith("redis://") and self.ENV == "production":
                url = url.replace("redis://", "rediss://", 1)
            return url

        # Fallback: construct from individual components
        password_part = f":{self.REDIS_PASSWORD}@" if self.REDIS_PASSWORD else ""
        # Use rediss:// for production (Render requires SSL)
        scheme = "rediss" if self.ENV == "production" else "redis"
        return f"{scheme}://{password_part}{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"


settings = Settings()
