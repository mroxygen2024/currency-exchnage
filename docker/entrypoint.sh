#!/bin/bash
set -e

# ------------------------------------------------------------------------------
# Wait for PostgreSQL and Redis to become available
# ------------------------------------------------------------------------------
python3 - <<'PYEOF'
import os
import socket
import sys
import time
from urllib.parse import urlparse

def parse_host_port(url, default_host, default_port):
    """Extract host and port from a connection URL or use individual env vars."""
    if url:
        parsed = urlparse(url)
        host = parsed.hostname or default_host
        port = parsed.port or default_port
        return host, port
    return default_host, default_port

def wait_for_service(host, port, name, ssl_mode=False):
    """Wait for a TCP service to accept connections."""
    print(f"Waiting for {name} to be ready on {host}:{port}...", flush=True)
    start_time = time.time()
    while True:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(3.0)
                s.connect((host, port))
                print(f"{name} port {port} is reachable!", flush=True)
                return True
        except (socket.error, OSError) as exc:
            if time.time() - start_time > 60:
                print(
                    f"ERROR: Timeout waiting for {name} on {host}:{port} "
                    f"after 60 seconds. Last error: {exc}",
                    file=sys.stderr,
                    flush=True,
                )
                sys.exit(1)
            time.sleep(2)

# Parse PostgreSQL connection details
# Priority: DATABASE_URL > POSTGRES_SERVER/POSTGRES_PORT
db_url = os.getenv("DATABASE_URL", "")
pg_host = os.getenv("POSTGRES_SERVER", "localhost")
pg_port = int(os.getenv("POSTGRES_PORT", "5432"))

if db_url:
    parsed = urlparse(db_url)
    pg_host = parsed.hostname or pg_host
    pg_port = parsed.port or pg_port

wait_for_service(pg_host, pg_port, "PostgreSQL")

# Parse Redis connection details
# Priority: REDIS_URL > REDIS_HOST/REDIS_PORT
redis_url = os.getenv("REDIS_URL", "")
redis_host = os.getenv("REDIS_HOST", "localhost")
redis_port = int(os.getenv("REDIS_PORT", "6379"))

if redis_url:
    parsed = urlparse(redis_url)
    redis_host = parsed.hostname or redis_host
    redis_port = parsed.port or redis_port

wait_for_service(redis_host, redis_port, "Redis")

print("All dependencies are ready!", flush=True)
PYEOF

# ------------------------------------------------------------------------------
# Run database migrations if requested
# ------------------------------------------------------------------------------
if [ "${RUN_MIGRATIONS}" = "true" ]; then
    echo "Running alembic migrations..."
    alembic upgrade head
    echo "Migrations completed successfully!"
else
    echo "RUN_MIGRATIONS is not 'true' — skipping migrations."
fi

# ------------------------------------------------------------------------------
# Hand over to the CMD
# ------------------------------------------------------------------------------
exec "$@"
