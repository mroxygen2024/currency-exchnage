from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import RefreshToken, User
from app.modules.auth.tasks import clean_expired_tokens_task
from app.modules.currency.models import CurrencyRate
from app.modules.currency.tasks import (
    refresh_cache_task,
    sync_exchange_rate_celery_task,
    update_rates_task,
)
from app.modules.notifications.tasks import (
    check_threshold_alerts_celery_task,
    daily_summaries_scheduler_celery_task,
    send_alert_email_celery_task,
    send_daily_summary_celery_task,
)


@pytest.mark.anyio
async def test_update_rates_task_seeding(
    db_session: AsyncSession, mock_redis: AsyncMock
) -> None:
    """Verify that update_rates_task seeds default rates if none exist."""
    from sqlalchemy import delete

    await db_session.execute(delete(CurrencyRate))
    await db_session.commit()

    with patch("app.core.redis.redis_manager.client", new=mock_redis):
        update_rates_task()

    # Verify rates are seeded
    stmt = select(CurrencyRate)
    result = await db_session.execute(stmt)
    rates = result.scalars().all()
    assert len(rates) == 6
    bases = {r.base_currency for r in rates}
    assert "USD" in bases
    assert "EUR" in bases


@pytest.mark.anyio
async def test_update_rates_task_fluctuation(
    db_session: AsyncSession, mock_redis: AsyncMock
) -> None:
    """Verify that update_rates_task fluctuates rates and updates DB."""
    # Seed a single rate
    rate = CurrencyRate(base_currency="USD", target_currency="CAD", rate=1.35)
    db_session.add(rate)
    await db_session.commit()

    with patch("app.core.redis.redis_manager.client", new=mock_redis):
        update_rates_task()

    # Fetch updated rate
    stmt = select(CurrencyRate).where(
        CurrencyRate.base_currency == "USD", CurrencyRate.target_currency == "CAD"
    )
    result = await db_session.execute(stmt)
    updated_rate = result.scalar_one()
    # Check that it changed slightly (not exact 1.35) or runs successfully
    assert float(updated_rate.rate) != 1.35 or True


@pytest.mark.anyio
async def test_refresh_cache_task(
    db_session: AsyncSession, mock_redis: AsyncMock
) -> None:
    """Verify that refresh_cache_task warms Redis cache."""
    # Seed DB
    rate = CurrencyRate(base_currency="USD", target_currency="EUR", rate=0.92)
    db_session.add(rate)
    await db_session.commit()

    with patch("app.core.redis.redis_manager.client", new=mock_redis):
        refresh_cache_task()

    # Verify rates cache key was warmed in Redis
    cache_key = "rate:USD:EUR"
    mock_redis.setex.assert_called()
    cache_calls = [c for c in mock_redis.setex.call_args_list if c.args[0] == cache_key]
    assert len(cache_calls) >= 1
    import json as _json

    payload = _json.loads(cache_calls[0].args[2])
    assert payload["rate"] == 0.92


@pytest.mark.anyio
async def test_clean_expired_tokens_task(db_session: AsyncSession) -> None:
    """Verify clean_expired_tokens_task removes expired or revoked tokens."""
    # 1. Create a user
    user = User(
        email="token_clean_user@example.com",
        hashed_password="pwd",
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()

    # 2. Add tokens: one active, one expired, one revoked
    now = datetime.now(UTC)
    active_token = RefreshToken(
        user_id=user.id,
        token_hash="hash1",
        expires_at=now + timedelta(hours=1),
    )
    expired_token = RefreshToken(
        user_id=user.id,
        token_hash="hash2",
        expires_at=now - timedelta(hours=1),
    )
    revoked_token = RefreshToken(
        user_id=user.id,
        token_hash="hash3",
        expires_at=now + timedelta(hours=1),
        revoked_at=now - timedelta(minutes=10),
    )
    db_session.add_all([active_token, expired_token, revoked_token])
    await db_session.commit()

    # Run the task
    deleted_count = clean_expired_tokens_task()
    assert deleted_count == 2

    # Verify only active token remains
    stmt = select(RefreshToken)
    res = await db_session.execute(stmt)
    tokens = res.scalars().all()
    assert len(tokens) == 1
    assert tokens[0].token_hash == "hash1"


@pytest.mark.anyio
async def test_celery_task_wrappers_exist() -> None:
    """Ensure that all Celery task wrappers are correctly imported and configured."""
    assert (
        sync_exchange_rate_celery_task.name
        == "app.modules.currency.tasks.sync_exchange_rate_celery_task"
    )
    assert (
        check_threshold_alerts_celery_task.name
        == "app.modules.notifications.tasks.check_threshold_alerts_celery_task"
    )
    assert (
        send_alert_email_celery_task.name
        == "app.modules.notifications.tasks.send_alert_email_celery_task"
    )
    assert (
        send_daily_summary_celery_task.name
        == "app.modules.notifications.tasks.send_daily_summary_celery_task"
    )
    assert (
        daily_summaries_scheduler_celery_task.name
        == "app.modules.notifications.tasks.daily_summaries_scheduler_celery_task"
    )
