from redis.asyncio import ConnectionPool, Redis

from app.core.config import settings
from app.core.logging import logger


class RedisManager:
    """Manages the connection pool and lifecycle of the Redis client."""

    def __init__(self) -> None:
        self.pool: ConnectionPool | None = None
        self.client: Redis | None = None

    def init_pool(self) -> None:
        """Initialize the Redis Connection Pool with configured parameters."""
        logger.info(
            "Initializing Redis connection pool",
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=settings.REDIS_DB,
            max_connections=settings.REDIS_MAX_CONNECTIONS,
        )
        self.pool = ConnectionPool.from_url(
            settings.redis_url,
            max_connections=settings.REDIS_MAX_CONNECTIONS,
            decode_responses=True,  # Automatically decode responses as string UTF-8
        )
        self.client = Redis.from_pool(self.pool)

    async def close_pool(self) -> None:
        """Gracefully disconnect and clean up the connection pool."""
        if self.pool:
            logger.info("Closing Redis connection pool...")
            await self.pool.disconnect()
            self.pool = None
            self.client = None
            logger.info("Redis connection pool closed.")

    async def ping(self) -> bool:
        """Verify the Redis connection is active and healthy."""
        if not self.client:
            return False
        try:
            return await self.client.ping()
        except Exception as exc:
            logger.error("Failed to ping Redis", error=str(exc))
            return False


# Global instance to import in lifespan and dependencies
redis_manager = RedisManager()


async def get_redis() -> Redis:
    """Dependency provider for retrieving the active Redis client.

    Raises:
        RuntimeError: If the pool has not been initialized.
    """
    if redis_manager.client is None:
        logger.critical("Attempted to access Redis before pool initialization.")
        raise RuntimeError("Redis connection pool is not initialized.")
    return redis_manager.client
