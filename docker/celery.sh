#!/bin/bash
set -e

LOG_LEVEL=${LOG_LEVEL:-INFO}

echo "Starting Celery background worker with log level ${LOG_LEVEL}..."

# Exec ensures that signals (like SIGTERM/SIGINT) are passed directly to the worker for graceful shutdown
exec celery -A app.tasks.celery_app worker \
    -Q default,notifications \
    --loglevel="$LOG_LEVEL"
