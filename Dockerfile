FROM debian:13.4

ENV PYTHONUNBUFFERED=1

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential git ca-certificates nodejs npm python3 python3-pip ripgrep ffmpeg gcc python3-dev libffi-dev procps && \
    rm -rf /var/lib/apt/lists/*

COPY . /opt/hermes
WORKDIR /opt/hermes

# Install Python deps, Node deps, and Playwright (skip WhatsApp bridge for Railway)
RUN pip install --no-cache-dir uv --break-system-packages && \
    uv pip install --system --break-system-packages --no-cache -e ".[all]" && \
    npm install --prefer-offline --no-audit && \
    npx playwright install --with-deps chromium --only-shell

WORKDIR /opt/hermes
RUN chmod +x /opt/hermes/docker/entrypoint.sh

ENV HERMES_HOME=/opt/data
ENTRYPOINT [ "/opt/hermes/docker/entrypoint.sh" ]
