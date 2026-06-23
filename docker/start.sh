#!/bin/bash
set -e

# Allow configuring the number of worker processes, default to 4
WORKERS=${UVICORN_WORKERS:-4}
LOG_LEVEL=${LOG_LEVEL:-info}

# Use the PORT environment variable if set, otherwise default to 8000
PORT=${PORT:-8000}

echo "Starting FastAPI App on port ${PORT} with ${WORKERS} workers..."

exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port "${PORT}" \
    --workers "$WORKERS" \
    --log-level "$LOG_LEVEL" \
    --proxy-headers \
    --forwarded-allow-ips='*'

