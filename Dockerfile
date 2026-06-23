# ==============================================================================
# Stage 1: Build dependencies
# ==============================================================================
FROM python:3.12-slim AS builder

WORKDIR /build

# Install system compilation dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# ==============================================================================
# Stage 2: Runtime image
# ==============================================================================
FROM python:3.12-slim AS runner

# Environment configurations
# - PYTHONDONTWRITEBYTECODE: Prevents Python from writing .pyc files to disk
# - PYTHONUNBUFFERED: Prevents Python from buffering stdout and stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"

WORKDIR /app

# Install runtime dependencies (libpq5 is needed by asyncpg/psycopg2) and curl for healthchecks
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy virtual environment from builder stage
COPY --from=builder /opt/venv /opt/venv

# Create a non-root system user and group (UID 1000) for security compliance
RUN groupadd -g 1000 appgroup && \
    useradd -u 1000 -g appgroup -m -s /bin/bash appuser

# Create log/data directories and set ownership
RUN mkdir -p /app/logs /app/data && \
    chown -R appuser:appgroup /app

# Copy application configuration and codebase (maintaining non-root ownership)
COPY --chown=appuser:appgroup alembic.ini /app/alembic.ini
COPY --chown=appuser:appgroup alembic /app/alembic
COPY --chown=appuser:appgroup app /app/app
COPY --chown=appuser:appgroup tests /app/tests
COPY --chown=appuser:appgroup pyproject.toml /app/pyproject.toml
COPY --chown=appuser:appgroup requirements.txt /app/requirements.txt
COPY --chown=appuser:appgroup docker/entrypoint.sh /app/entrypoint.sh
COPY --chown=appuser:appgroup docker/start.sh /app/start.sh
COPY --chown=appuser:appgroup docker/celery.sh /app/celery.sh
COPY --chown=appuser:appgroup docker/beat.sh /app/beat.sh

# Ensure scripts have execute permissions
RUN chmod +x /app/entrypoint.sh /app/start.sh /app/celery.sh /app/beat.sh

# Switch execution context to the secure non-root user
USER appuser

# Expose default FastAPI API Port
EXPOSE 8000

# Set entrypoint wrapper and default web runner CMD
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["/app/start.sh"]
