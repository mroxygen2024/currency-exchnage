#!/bin/bash
set -e

# Wait for PostgreSQL and Redis to become available using python-based port polling
python3 - <<EOF
import socket
import sys
import time
import os

postgres_host = os.getenv("POSTGRES_SERVER", "localhost")
postgres_port = int(os.getenv("POSTGRES_PORT", "5432"))
redis_host = os.getenv("REDIS_HOST", "localhost")
redis_port = int(os.getenv("REDIS_PORT", "6379"))

def wait_for_service(host, port, name):
    print(f"Waiting for {name} to be ready on {host}:{port}...", flush=True)
    start_time = time.time()
    while True:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(1.0)
                s.connect((host, port))
                print(f"{name} is ready!", flush=True)
                return True
        except socket.error:
            if time.time() - start_time > 90:
                print(f"Timeout waiting for {name} on {host}:{port}!", file=sys.stderr, flush=True)
                sys.exit(1)
            time.sleep(1)

wait_for_service(postgres_host, postgres_port, "PostgreSQL")
wait_for_service(redis_host, redis_port, "Redis")
EOF

# Run database migrations if requested
if [ "$RUN_MIGRATIONS" = "true" ]; then
    echo "Running alembic migrations..."
    alembic upgrade head
    echo "Migrations completed successfully!"
fi

# Hand over to the CMD
exec "$@"
