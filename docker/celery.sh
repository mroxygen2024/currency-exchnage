#!/bin/bash
set -e

LOG_LEVEL=${LOG_LEVEL:-INFO}

echo "Starting Taskiq background worker (equivalent to Celery Worker) with log level ${LOG_LEVEL}..."

# Exec ensures that signals (like SIGTERM/SIGINT) are passed directly to the worker for graceful shutdown
exec taskiq worker app.tasks.broker:broker \
    --fs-discover \
    --log-level "$LOG_LEVEL"
