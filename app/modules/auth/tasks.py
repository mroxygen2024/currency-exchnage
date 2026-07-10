from datetime import UTC, datetime

from sqlalchemy import delete

from app.core.database import get_db_context
from app.core.logging import logger
from app.modules.auth.models import RefreshToken
from app.tasks.celery_app import celery_app, run_async


@celery_app.task(
    bind=True,
    autoretry_for=(Exception,),
    max_retries=3,
    default_retry_delay=30,
    retry_backoff=True,
)
def clean_expired_tokens_task(self) -> int:  # noqa: ARG001
    """Periodic Celery task to clean expired and revoked tokens."""
    logger.info("Executing clean_expired_tokens_task background worker.")

    async def _run() -> int:
        async with get_db_context() as db:
            now = datetime.now(UTC)
            stmt = delete(RefreshToken).where(
                (RefreshToken.expires_at < now) | (RefreshToken.revoked_at.is_not(None))
            )
            result = await db.execute(stmt)
            return result.rowcount

    try:
        deleted_count = run_async(_run())
        logger.info(
            "clean_expired_tokens_task completed successfully.",
            deleted_tokens_count=deleted_count,
        )
        return deleted_count
    except Exception as exc:
        logger.error(
            "clean_expired_tokens_task failed.",
            error=str(exc),
            exc_info=True,
        )
        raise exc
