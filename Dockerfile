# syntax=docker/dockerfile:1
FROM python:3.11-slim AS builder

WORKDIR /build

# Install build tools
RUN pip install --no-cache-dir hatchling

# Copy project files
COPY pyproject.toml .
COPY src/ ./src/

# Build wheel
RUN pip wheel --no-cache-dir --wheel-dir /wheels .

# ---------------------------------------------------------------------------- #
FROM python:3.11-slim AS runtime

# Non-root user for security
RUN addgroup --system edgent && adduser --system --ingroup edgent edgent

WORKDIR /app

# Install wheel and its runtime dependencies
COPY --from=builder /wheels /wheels
RUN pip install --no-cache-dir /wheels/*.whl && rm -rf /wheels

USER edgent

EXPOSE 8000

ENV EDGENT_HOST=0.0.0.0 \
    EDGENT_PORT=8000 \
    EDGENT_WORKERS=1 \
    EDGENT_LOG_LEVEL=INFO

# Health check using the readyz endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c \
        "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/v1/readyz')" \
    || exit 1

CMD ["edgent-smith"]
