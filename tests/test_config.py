import pytest


class TestParseCorsOrigins:
    def test_string_input(self) -> None:
        from app.core.config import parse_cors_origins

        result = parse_cors_origins("http://a.com, http://b.com")
        assert result == ["http://a.com", "http://b.com"]

    def test_string_single(self) -> None:
        from app.core.config import parse_cors_origins

        result = parse_cors_origins("http://a.com")
        assert result == ["http://a.com"]

    def test_list_input(self) -> None:
        from app.core.config import parse_cors_origins

        result = parse_cors_origins(["http://a.com", "http://b.com"])
        assert result == ["http://a.com", "http://b.com"]

    def test_other_type_returns_empty(self) -> None:
        from app.core.config import parse_cors_origins

        result = parse_cors_origins(123)
        assert result == []

    def test_string_with_whitespace(self) -> None:
        from app.core.config import parse_cors_origins

        result = parse_cors_origins("  http://a.com  ,  , http://b.com  ")
        assert result == ["http://a.com", "http://b.com"]


class TestProductionSecurityValidation:
    def test_production_short_secret_key(self) -> None:
        from pydantic import ValidationError

        from app.core.config import Settings

        with pytest.raises(ValidationError, match="SECRET_KEY must be at least"):
            Settings(
                ENV="production",
                SECRET_KEY="short",
            )

    def test_production_wildcard_cors(self) -> None:
        from pydantic import ValidationError

        from app.core.config import Settings

        with pytest.raises(ValidationError, match="Wildcard CORS"):
            Settings(
                ENV="production",
                SECRET_KEY="a" * 32,
                BACKEND_CORS_ORIGINS=["*"],
            )

    def test_production_valid_config(self) -> None:
        from app.core.config import Settings

        s = Settings(
            ENV="production",
            SECRET_KEY="a" * 32,
            BACKEND_CORS_ORIGINS=["http://example.com"],
        )
        assert s.ENV == "production"

    def test_non_production_allows_short_key(self) -> None:
        from app.core.config import Settings

        s = Settings(ENV="development", SECRET_KEY="short")
        assert s.SECRET_KEY == "short"


class TestAsyncDatabaseUrl:
    def test_postgresql_upgrade(self) -> None:
        from app.core.config import Settings

        s = Settings(
            DATABASE_URL="postgresql://user:pass@localhost:5432/db",
            SECRET_KEY="test",
        )
        assert (
            s.async_database_url == "postgresql+asyncpg://user:pass@localhost:5432/db"
        )

    def test_postgres_upgrade(self) -> None:
        from app.core.config import Settings

        s = Settings(
            DATABASE_URL="postgres://user:pass@localhost:5432/db",
            SECRET_KEY="test",
        )
        assert (
            s.async_database_url == "postgresql+asyncpg://user:pass@localhost:5432/db"
        )

    def test_strips_sslmode(self) -> None:
        from app.core.config import Settings

        s = Settings(
            DATABASE_URL="postgresql://user:pass@localhost:5432/db?sslmode=require",
            SECRET_KEY="test",
        )
        assert "sslmode" not in s.async_database_url

    def test_strips_channel_binding(self) -> None:
        from app.core.config import Settings

        s = Settings(
            DATABASE_URL="postgresql://user:pass@localhost:5432/db?channel_binding=require",
            SECRET_KEY="test",
        )
        assert "channel_binding" not in s.async_database_url

    def test_preserves_other_params(self) -> None:
        from app.core.config import Settings

        s = Settings(
            DATABASE_URL="postgresql://user:pass@localhost:5432/db?sslmode=require&application_name=test",
            SECRET_KEY="test",
        )
        url = s.async_database_url
        assert "sslmode" not in url
        assert "application_name=test" in url

    def test_fallback_from_components(self) -> None:
        from app.core.config import Settings

        s = Settings(
            DATABASE_URL="",
            POSTGRES_USER="myuser",
            POSTGRES_PASSWORD="mypass",
            POSTGRES_SERVER="myhost",
            POSTGRES_PORT=5433,
            POSTGRES_DB="mydb",
            SECRET_KEY="test",
        )
        assert s.async_database_url == (
            "postgresql+asyncpg://myuser:mypass@myhost:5433/mydb"
        )

    def test_already_asyncpg(self) -> None:
        from app.core.config import Settings

        s = Settings(
            DATABASE_URL="postgresql+asyncpg://user:pass@localhost:5432/db",
            SECRET_KEY="test",
        )
        assert (
            s.async_database_url == "postgresql+asyncpg://user:pass@localhost:5432/db"
        )


class TestDatabaseSslEnabled:
    def test_production_returns_true(self) -> None:
        from app.core.config import Settings

        s = Settings(ENV="production", SECRET_KEY="a" * 32)
        assert s.database_ssl_enabled is True

    def test_non_production_no_ssl(self) -> None:
        from app.core.config import Settings

        s = Settings(ENV="testing", DATABASE_SSLMODE="", SECRET_KEY="test")
        assert s.database_ssl_enabled is False

    def test_sslmode_require(self) -> None:
        from app.core.config import Settings

        s = Settings(ENV="testing", DATABASE_SSLMODE="require", SECRET_KEY="test")
        assert s.database_ssl_enabled is True

    def test_sslmode_disable(self) -> None:
        from app.core.config import Settings

        s = Settings(ENV="testing", DATABASE_SSLMODE="disable", SECRET_KEY="test")
        assert s.database_ssl_enabled is False

    def test_sslmode_allow(self) -> None:
        from app.core.config import Settings

        s = Settings(ENV="testing", DATABASE_SSLMODE="allow", SECRET_KEY="test")
        assert s.database_ssl_enabled is False


class TestRedisUrl:
    def test_with_redis_url(self) -> None:
        from app.core.config import Settings

        s = Settings(REDIS_URL="redis://localhost:6379/0", SECRET_KEY="test")
        assert s.redis_url == "redis://localhost:6379/0"

    def test_production_upgrades_to_ssl(self) -> None:
        from app.core.config import Settings

        s = Settings(
            ENV="production",
            REDIS_URL="redis://localhost:6379/0",
            SECRET_KEY="a" * 32,
        )
        assert s.redis_url == "rediss://localhost:6379/0"

    def test_production_rediss_kept(self) -> None:
        from app.core.config import Settings

        s = Settings(
            ENV="production",
            REDIS_URL="rediss://localhost:6379/0",
            SECRET_KEY="a" * 32,
        )
        assert s.redis_url == "rediss://localhost:6379/0"

    def test_fallback_from_components(self) -> None:
        from app.core.config import Settings

        s = Settings(
            REDIS_URL="",
            REDIS_HOST="myhost",
            REDIS_PORT=6380,
            REDIS_DB=2,
            REDIS_PASSWORD="secret",
            SECRET_KEY="test",
        )
        assert s.redis_url == "redis://:secret@myhost:6380/2"

    def test_fallback_no_password(self) -> None:
        from app.core.config import Settings

        s = Settings(
            REDIS_URL="",
            REDIS_HOST="localhost",
            REDIS_PORT=6379,
            REDIS_DB=0,
            REDIS_PASSWORD="",
            SECRET_KEY="test",
        )
        assert s.redis_url == "redis://localhost:6379/0"

    def test_fallback_production_uses_rediss(self) -> None:
        from app.core.config import Settings

        s = Settings(
            ENV="production",
            REDIS_URL="",
            REDIS_HOST="localhost",
            REDIS_PORT=6379,
            REDIS_DB=0,
            REDIS_PASSWORD="",
            SECRET_KEY="a" * 32,
            _env_file="",
        )
        assert s.redis_url == "rediss://localhost:6379/0"
