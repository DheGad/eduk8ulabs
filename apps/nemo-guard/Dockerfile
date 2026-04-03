# ============================================================
# Dockerfile — StreetMP NeMo Guardrails Sidecar (V81)
# Python 3.11-slim, FastAPI + Uvicorn
# ============================================================
# BUILD CONTEXT: apps/nemo-guard/
# USAGE:
#   docker build -t streetmp-os/nemo-guard:latest -f Dockerfile .
# ============================================================

# Stage 1: Builder — install Python deps
FROM python:3.11-slim AS builder

WORKDIR /app

# Install build tools for native wheels (numpy etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for layer caching
COPY requirements.txt .

# Install into a prefix we can copy to the runner
# gcc needed for some NeMo transitive deps
RUN apt-get update && apt-get install -y --no-install-recommends gcc && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir --prefix=/install -r requirements.txt

# Stage 2: Runner — lean production image
FROM python:3.11-slim AS runner

WORKDIR /app

# Non-root user for security
RUN useradd --system --uid 1000 --create-home nemouser

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application source
COPY --chown=nemouser:nemouser . .

USER nemouser

# NEMO_CONFIG_DIR: path to config.yml + rails.co inside the container
ENV NEMO_CONFIG_DIR=/app/nemo PORT=8001 PYTHONUNBUFFERED=1

# NeMo config files must exist; they are copied with the source above.
# The Compose build context mounts packages/security/nemo/ → ./nemo/ via the
# nemo-guard service's build.args or a volume. See docker-compose.prod.yml.

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=15s --start-period=90s --retries=5 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8001/health')" || exit 1

# Single worker — NeMo's LLMRails holds in-process model state and is NOT
# safe to fork across multiple workers. Use async concurrency instead.
CMD ["uvicorn", "nemo_sidecar:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "1", "--log-level", "info"]
