#!/bin/bash
set -e

# Allow configuring the number of worker processes, default to 4
WORKERS=${UVICORN_WORKERS:-4}
LOG_LEVEL=${LOG_LEVEL:-info}

echo "Starting FastAPI App on port 8000 with ${WORKERS} workers..."

exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --workers "$WORKERS" \
    --log-level "$LOG_LEVEL" \
    --proxy-headers \
    --forwarded-allow-ips='*'
