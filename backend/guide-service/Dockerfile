# InfraX Guide Service | Port 8006

FROM python:3.12-slim AS base

LABEL maintainer="Zain"
LABEL service="guide-service"

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Install security patches, curl for healthcheck, create non-root user
RUN apt-get update \
    && apt-get upgrade -y --no-install-recommends \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* \
    && groupadd -r appuser && useradd -r -g appuser -d /app -s /sbin/nologin appuser

WORKDIR /app

# Install dependencies first (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copy app code and clean up dev artifacts
COPY . .
RUN rm -rf __pycache__ venv .env .git tests \
    && find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true

# Switch to non-root user
RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 8006

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8006/api/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8006", "--workers", "2", "--no-access-log"]
