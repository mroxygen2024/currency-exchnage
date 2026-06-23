import logging
import sys
from typing import Any

import structlog

from app.core.config import settings


def setup_logging() -> None:
    """Configure structured JSON logging for the application.

    This setup routes both standard logging library messages and structlog messages
    to standard out in JSON format with uniform timestamping and severity levels.
    """
    log_level = logging.DEBUG if settings.DEBUG else logging.INFO

    # Shared processors for both standard and structured logging pipelines
    processors: list[Any] = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer(),
    ]

    # Configure structlog
    structlog.configure(
        processors=processors,
        logger_factory=structlog.PrintLoggerFactory(sys.stdout),
        wrapper_class=structlog.make_filtering_bound_logger(log_level),
        cache_logger_on_first_use=True,
    )

    # Reconfigure the standard library's root logger
    # Handlers will be cleared and replaced with a StreamHandler printing to stdout
    root_logger = logging.getLogger()
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    handler = logging.StreamHandler(sys.stdout)
    # We use a simple formatter since the logging payload will be standard JSON strings
    handler.setFormatter(logging.Formatter("%(message)s"))
    root_logger.addHandler(handler)
    root_logger.setLevel(log_level)

    # Redirect logs from other third-party libraries (e.g. uvicorn, fastapi)
    # by letting them propagate up to the root handler
    for logger_name in ("uvicorn", "uvicorn.error", "uvicorn.access", "fastapi"):
        logger = logging.getLogger(logger_name)
        logger.handlers = []
        logger.propagate = True
        logger.setLevel(log_level)


# Create a global logger instance for convenience
logger = structlog.get_logger()
