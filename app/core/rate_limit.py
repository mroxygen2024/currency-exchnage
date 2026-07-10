from fastapi import Request, Response

from app.core.config import settings
from app.core.exceptions import AppException
from app.core.logging import logger
from app.core.redis import redis_manager


async def get_client_identifier(request: Request) -> str:
    """Identify request origin by JWT subject (user) or client IP."""
    # 1. Try to extract from Authorization header
    auth_header = request.headers.get("authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:]
        try:
            # Import dynamically to avoid circular dependencies
            from app.core.security import decode_access_token

            payload = decode_access_token(token)
            user_id = payload.get("sub")
            if user_id:
                return f"user:{user_id}"
        except Exception:
            # Ignore decoding errors; authentication routers will handle validation
            pass

    # 2. Fall back to client IP address
    client_ip = "unknown"
    if request.client:
        client_ip = request.client.host
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        client_ip = forwarded_for.split(",")[0].strip()
    return f"ip:{client_ip}"


class RateLimiter:
    """FastAPI Dependency for Redis-backed request rate limiting.

    Implements a window-counter pattern. If Redis is down, it fails open
    to preserve service availability. Sets standard HTTP rate-limiting headers.
    """

    def __init__(self, limit: int, window: int):
        self.limit = limit
        self.window = window

    async def __call__(self, request: Request, response: Response) -> None:
        # Bypass rate limits in testing unless explicitly requested via header
        if settings.ENV == "testing" and not request.headers.get("x-test-rate-limit"):
            return

        # Resolve identifier
        identifier = await get_client_identifier(request)
        key = f"rate_limit:{identifier}:{request.url.path}"

        # Fail-open if Redis is not connected
        if redis_manager.client is None:
            logger.warn("Redis client not initialized; bypassing rate limit check.")
            return

        try:
            # Execute pipeline to atomically increment counter and get current TTL
            async with redis_manager.client.pipeline(transaction=True) as pipe:
                pipe.incr(key)
                pipe.ttl(key)
                res = await pipe.execute()
                count = res[0]
                ttl = res[1]

            # If TTL is -1, key was just created; set expiration
            if ttl == -1 or count == 1:
                await redis_manager.client.expire(key, self.window)
                ttl = self.window

            # Inject rate limit headers
            response.headers["X-RateLimit-Limit"] = str(self.limit)
            response.headers["X-RateLimit-Remaining"] = str(max(0, self.limit - count))
            response.headers["X-RateLimit-Reset"] = str(ttl if ttl > 0 else self.window)

            # Block request if count exceeds limit
            if count > self.limit:
                retry_after = ttl if ttl > 0 else self.window
                logger.warn(
                    "Rate limit exceeded",
                    client=identifier,
                    path=request.url.path,
                    limit=self.limit,
                    count=count,
                    retry_after=retry_after,
                )

                headers = {
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(self.limit),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(retry_after),
                }

                raise AppException(
                    status_code=429,
                    code="RATE_LIMIT_EXCEEDED",
                    message="Too many requests. Please try again later.",
                    details={"retry_after_seconds": retry_after},
                    headers=headers,
                )

        except AppException:
            raise
        except Exception as exc:
            # Fail-open on database/redis errors to prevent system-wide outage
            logger.error(
                "Redis rate limiter failed; bypassing check",
                error=str(exc),
                exc_info=True,
            )
            return
