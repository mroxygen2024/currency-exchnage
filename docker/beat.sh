#!/bin/bash
set -e

LOG_LEVEL=${LOG_LEVEL:-INFO}

echo "Starting Celery Beat periodic scheduler with log level ${LOG_LEVEL}..."

# Exec ensures that signals (like SIGTERM/SIGINT) are passed directly to the scheduler for graceful shutdown
exec celery -A app.tasks.celery_app beat \
    --loglevel="$LOG_LEVEL"
