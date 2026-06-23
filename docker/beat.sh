#!/bin/bash
set -e

LOG_LEVEL=${LOG_LEVEL:-INFO}

echo "Starting Taskiq scheduler (equivalent to Celery Beat) with log level ${LOG_LEVEL}..."

# Exec ensures that signals (like SIGTERM/SIGINT) are passed directly to the scheduler for graceful shutdown
exec taskiq scheduler app.tasks.broker:scheduler \
    --fs-discover \
    --log-level "$LOG_LEVEL"
