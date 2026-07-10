from datetime import UTC, datetime, timedelta

from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_context
from app.core.logging import logger
from app.core.redis import redis_manager
from app.modules.auth.models import User
from app.modules.currency.services import get_rate
from app.modules.favorites.models import FavoritePair
from app.modules.notifications.email_service import EmailService
from app.modules.notifications.models import NotificationSubscription
from app.modules.notifications.templates import (
    ALERT_EMAIL_TEMPLATE,
    DAILY_SUMMARY_TEMPLATE,
)
from app.tasks.celery_app import celery_app, run_async


async def send_alert_email_task(
    recipient_email: str,
    base: str,
    target: str,
    current_rate: float,
    threshold: float,
    condition: str,
) -> None:
    """Format and dispatch threshold alert email."""
    logger.info(
        "Executing send_alert_email_task background worker.",
        recipient=recipient_email,
        pair=f"{base}/{target}",
        current_rate=current_rate,
        threshold=threshold,
        condition=condition,
    )
    try:
        html_content = ALERT_EMAIL_TEMPLATE.format(
            base_currency=base.upper(),
            target_currency=target.upper(),
            current_rate=current_rate,
            threshold=threshold,
            condition=condition.upper(),
        )
        subject = (
            f"[Currency Alert] {base.upper()}/{target.upper()} "
            "has crossed your threshold!"
        )
        await EmailService.send_email(
            to_email=recipient_email,
            subject=subject,
            html_content=html_content,
        )
    except Exception as exc:
        logger.error(
            "send_alert_email_task failed",
            recipient=recipient_email,
            pair=f"{base}/{target}",
            error=str(exc),
            exc_info=True,
        )
        raise exc


async def send_daily_summary_task(
    recipient_email: str,
    pairs_data: list[dict],
) -> None:
    """Format and dispatch daily summary email."""
    logger.info(
        "Executing send_daily_summary_task background worker.",
        recipient=recipient_email,
        pairs_count=len(pairs_data),
    )
    try:
        # Build HTML table rows
        rows = []
        for item in pairs_data:
            pair = item["pair"]
            rate = item["rate"]
            rows.append(
                f"<tr>"
                f'  <td class="currency-pair">{pair}</td>'
                f'  <td class="rate-value">{rate:.4f}</td>'
                f"</tr>"
            )
        table_rows_html = (
            "\n".join(rows)
            if rows
            else "<tr><td colspan='2'>No favorite pairs configured.</td></tr>"
        )

        formatted_date = datetime.now(UTC).strftime("%B %d, %Y")
        html_content = DAILY_SUMMARY_TEMPLATE.format(
            date=formatted_date,
            table_rows=table_rows_html,
        )
        subject = f"[Currency Tracker] Daily Exchange Rates Summary - {formatted_date}"
        await EmailService.send_email(
            to_email=recipient_email,
            subject=subject,
            html_content=html_content,
        )
    except Exception as exc:
        logger.error(
            "send_daily_summary_task failed",
            recipient=recipient_email,
            error=str(exc),
            exc_info=True,
        )
        raise exc


async def check_threshold_alerts_task(
    base: str,
    target: str,
    current_rate: float,
    db: AsyncSession | None = None,
) -> None:
    """Checks active subscriptions for a pair and triggers alert tasks.

    Enforces a 24-hour notification cooldown per subscription.
    """
    logger.info(
        "Executing check_threshold_alerts_task background worker.",
        pair=f"{base}/{target}",
        current_rate=current_rate,
    )
    try:
        base_upper = base.upper()
        target_upper = target.upper()

        async def _check(session: AsyncSession):
            # Query active subscriptions for this pair, joining user to get email
            stmt = (
                select(NotificationSubscription)
                .join(User, NotificationSubscription.user_id == User.id)
                .where(
                    NotificationSubscription.base_currency == base_upper,
                    NotificationSubscription.target_currency == target_upper,
                    NotificationSubscription.is_active,
                    User.is_active,
                    ~User.is_deleted,
                )
            )
            result = await session.execute(stmt)
            subscriptions = result.scalars().all()

            now = datetime.now(UTC)
            cooldown_period = timedelta(hours=24)

            alerts_triggered = 0

            for sub in subscriptions:
                # Check if threshold crossed
                is_triggered = False
                if sub.condition == "above" and current_rate > float(sub.threshold):
                    is_triggered = True
                elif sub.condition == "below" and current_rate < float(sub.threshold):
                    is_triggered = True

                if is_triggered:
                    # Check cooldown: last_triggered must be None
                    # or older than 24 hours
                    last_triggered = sub.last_triggered_at
                    should_alert = False
                    if last_triggered is None:
                        should_alert = True
                    else:
                        if last_triggered.tzinfo is None:
                            last_triggered = last_triggered.replace(tzinfo=UTC)
                        if (now - last_triggered) > cooldown_period:
                            should_alert = True

                    if should_alert:
                        # Fetch owner email
                        stmt_user = select(User).where(User.id == sub.user_id)
                        user_res = await session.execute(stmt_user)
                        user = user_res.scalar_one_or_none()

                        if user and user.email:
                            # Update last_triggered_at in DB
                            sub.last_triggered_at = now
                            session.add(sub)
                            await session.flush()

                            # Dispatch email sending task to Celery queue
                            send_alert_email_celery_task.delay(
                                recipient_email=user.email,
                                base=base_upper,
                                target=target_upper,
                                current_rate=current_rate,
                                threshold=float(sub.threshold),
                                condition=sub.condition,
                            )
                            alerts_triggered += 1

            if alerts_triggered > 0:
                await session.commit()
                logger.info(
                    "Successfully queued threshold alert emails",
                    count=alerts_triggered,
                )

        if db is not None:
            await _check(db)
        else:
            async with get_db_context() as session:
                await _check(session)

    except Exception as exc:
        logger.error(
            "check_threshold_alerts_task failed",
            pair=f"{base}/{target}",
            error=str(exc),
            exc_info=True,
        )
        raise exc


async def daily_summaries_scheduler_task(
    db: AsyncSession | None = None,
    redis: Redis | None = None,
) -> None:
    """Dispatches daily summaries to all active users with favorite currency pairs."""
    logger.info("Executing daily_summaries_scheduler_task background worker.")
    try:

        async def _schedule(session: AsyncSession, r_client: Redis):
            # Fetch all active, non-deleted users
            stmt_users = select(User).where(User.is_active, ~User.is_deleted)
            users_result = await session.execute(stmt_users)
            users = users_result.scalars().all()

            summaries_queued = 0

            for user in users:
                # Get user's favorites
                stmt_favs = select(FavoritePair).where(FavoritePair.user_id == user.id)
                favs_result = await session.execute(stmt_favs)
                favorites = favs_result.scalars().all()

                if not favorites:
                    continue

                pairs_data = []
                for fav in favorites:
                    rate_model = await get_rate(
                        db=session,
                        redis=r_client,
                        base=fav.base_currency,
                        target=fav.target_currency,
                    )
                    if rate_model:
                        pairs_data.append(
                            {
                                "pair": f"{fav.base_currency}/{fav.target_currency}",
                                "rate": float(rate_model.rate),
                            }
                        )

                if pairs_data:
                    # Dispatch email sending task to Celery queue
                    send_daily_summary_celery_task.delay(
                        recipient_email=user.email,
                        pairs_data=pairs_data,
                    )
                    summaries_queued += 1

            logger.info(
                "daily_summaries_scheduler_task completed.",
                summaries_queued=summaries_queued,
            )

        if db is not None and redis is not None:
            await _schedule(db, redis)
        else:
            r_client = redis or redis_manager.client
            async with get_db_context() as session:
                await _schedule(session, r_client)

    except Exception as exc:
        logger.error(
            "daily_summaries_scheduler_task failed",
            error=str(exc),
            exc_info=True,
        )
        raise exc


# ------------------------------------------------------------------------------
# Celery Task Wrappers with Retry Logic & Performance Routing
# ------------------------------------------------------------------------------


@celery_app.task(
    bind=True,
    autoretry_for=(Exception,),
    max_retries=3,
    default_retry_delay=10,
    retry_backoff=True,
)
def send_alert_email_celery_task(
    self,  # noqa: ARG001
    recipient_email: str,
    base: str,
    target: str,
    current_rate: float,
    threshold: float,
    condition: str,
) -> None:
    """Celery task worker entrypoint for dispatching threshold alert email."""
    run_async(
        send_alert_email_task(
            recipient_email=recipient_email,
            base=base,
            target=target,
            current_rate=current_rate,
            threshold=threshold,
            condition=condition,
        )
    )


@celery_app.task(
    bind=True,
    autoretry_for=(Exception,),
    max_retries=3,
    default_retry_delay=10,
    retry_backoff=True,
)
def send_daily_summary_celery_task(
    self,  # noqa: ARG001
    recipient_email: str,
    pairs_data: list[dict],
) -> None:
    """Celery task worker entrypoint for dispatching daily summary email."""
    run_async(
        send_daily_summary_task(
            recipient_email=recipient_email,
            pairs_data=pairs_data,
        )
    )


@celery_app.task(
    bind=True,
    autoretry_for=(Exception,),
    max_retries=3,
    default_retry_delay=10,
    retry_backoff=True,
)
def check_threshold_alerts_celery_task(
    self,  # noqa: ARG001
    base: str,
    target: str,
    current_rate: float,
) -> None:
    """Celery task worker entrypoint for checking threshold alert configurations."""
    run_async(
        check_threshold_alerts_task(
            base=base,
            target=target,
            current_rate=current_rate,
        )
    )


@celery_app.task(
    bind=True,
    autoretry_for=(Exception,),
    max_retries=3,
    default_retry_delay=10,
    retry_backoff=True,
)
def daily_summaries_scheduler_celery_task(self) -> None:  # noqa: ARG001
    """Celery Beat periodic task entrypoint for dispatching daily summaries."""
    run_async(daily_summaries_scheduler_task())
