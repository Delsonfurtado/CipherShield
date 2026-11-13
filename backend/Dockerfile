# ============================================================
# CipherShield Backend — Dockerfile
# ============================================================
# Supports two build targets:
#   development  — uvicorn with --reload for local dev
#   production   — uvicorn hardened, non-root user
# ============================================================

# ---- Base stage (shared) -------------------------------------
FROM python:3.11-slim AS base

# Prevent .pyc files and enable stdout/stderr flushing
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install OS-level build deps (cryptography wheels need gcc)
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        libffi-dev \
        libssl-dev \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# ---- Development target --------------------------------------
FROM base AS development

COPY . .

EXPOSE 8000

# Hot-reload for development
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# ---- Production target ---------------------------------------
FROM base AS production

# Create non-root user and group
RUN groupadd --system appgroup \
    && useradd --system --gid appgroup --no-create-home appuser

COPY --chown=appuser:appgroup . .

# Drop to non-root
USER appuser

EXPOSE 8000

# Production: no reload, 2 workers, access log to stdout
CMD ["uvicorn", "app.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "2", \
     "--access-log", \
     "--proxy-headers", \
     "--forwarded-allow-ips", "*"]
