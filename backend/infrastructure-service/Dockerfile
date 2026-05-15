# InfraX Infrastructure Service | Port 8004
# Uses LangGraph + LangChain (needs build tools for native extensions)

FROM python:3.12-slim AS base

LABEL maintainer="Zain"
LABEL service="infrastructure-service"

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Install security patches, curl, and build tools for native extensions
RUN apt-get update \
    && apt-get upgrade -y --no-install-recommends \
    && apt-get install -y --no-install-recommends curl build-essential \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* \
    && groupadd -r appuser && useradd -r -g appuser -d /app -s /sbin/nologin appuser

WORKDIR /app

# Install dependencies, then remove build tools to reduce CVEs
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt \
    && apt-get purge -y --auto-remove build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy app code and clean up dev artifacts
COPY . .
RUN rm -rf __pycache__ venv .env .git tests \
    && find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true

# Switch to non-root user
RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 8004

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8004/api/health || exit 1

# Single worker — LangGraph holds in-memory session state
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8004", "--workers", "1", "--no-access-log"]
