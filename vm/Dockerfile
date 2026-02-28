FROM node:22

# System dependencies for Chromium/Playwright + better-sqlite3 native build
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    python3 \
    make \
    g++ \
    chromium \
    fonts-liberation \
    libgbm1 \
    libnss3 \
    libatk-bridge2.0-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libcups2 \
    libdrm2 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

# Skip automatic browser download during npm install (we install explicitly below)
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Install Claude Code CLI and Playwright CLI globally
RUN npm install -g @anthropic-ai/claude-code playwright

# Create non-root user (Claude Code refuses --dangerously-skip-permissions as root)
RUN useradd -m -s /bin/bash appuser

# Install Playwright Chromium as appuser so the binary lands in ~appuser/.cache
USER appuser
RUN npx playwright install chromium
USER root

WORKDIR /app

# Install Express dependency
COPY package.json ./
RUN npm install --production

# Copy application files
COPY vm-server.js db.js skills.js output-classifier.js web-views.js CLAUDE.md ./
COPY test-app/ ./test-app/

# Create directories and set ownership (Fly Volume mounts overlay these — dirs created at runtime too)
RUN mkdir -p /tmp/images /data/images /data/repos && chown appuser:appuser /tmp/images /data/images /data/repos /data
RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 3001

CMD ["node", "vm-server.js"]
