import time
import uuid

import structlog
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

from app.core.config import settings
from app.core.logging import logger


class RequestLoggingAndIdMiddleware(BaseHTTPMiddleware):
    """Middleware to inject Request IDs and log request/response cycles.

    Generates a unique request ID for tracing, sets it in structlog contextvars,
    measures processing duration, and logs details in a structured format.
    """

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        # 1. Resolve or generate Request ID
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id

        # Bind the request ID to the structlog context for automatic inclusion in all logs
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)

        # 2. Extract client details
        client_ip = "unknown"
        if request.client:
            client_ip = request.client.host
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()

        logger.info(
            "Incoming request",
            method=request.method,
            path=request.url.path,
            query_params=str(request.query_params),
            client_ip=client_ip,
        )

        start_time = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception as exc:
            duration = time.perf_counter() - start_time
            logger.error(
                "Request failed",
                method=request.method,
                path=request.url.path,
                client_ip=client_ip,
                duration=f"{duration:.4f}s",
                error=str(exc),
                exc_info=True,
            )
            raise exc

        duration = time.perf_counter() - start_time
        logger.info(
            "Request completed",
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration=f"{duration:.4f}s",
            client_ip=client_ip,
        )

        # Include Request ID in the response headers
        response.headers["X-Request-ID"] = request_id
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Middleware to inject security-hardening headers in all HTTP responses."""

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        response = await call_next(request)

        # Inject standard security headers
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Content Security Policy (CSP)
        # Relax policy for documentation endpoints (/docs, /redoc, /openapi.json) to allow CDN assets
        path = request.url.path.rstrip("/")
        if path in ("/docs", "/redoc", "/openapi.json"):
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
                "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
                "img-src 'self' data: https://fastapi.tiangolo.com; "
                "connect-src 'self'; "
                "frame-ancestors 'none';"
            )
        else:
            response.headers["Content-Security-Policy"] = (
                "default-src 'none'; "
                "frame-ancestors 'none'; "
                "sandbox; "
                "base-uri 'none'; "
                "form-action 'none';"
            )

        # HTTP Strict Transport Security (HSTS) - only in production environments
        if settings.ENV == "production":
            response.headers["Strict-Transport-Security"] = (
                "max-age=63072000; includeSubDomains; preload"
            )

        return response
