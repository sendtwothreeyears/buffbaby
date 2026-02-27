FROM node:22

# System dependencies for Chromium/Playwright
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
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
COPY vm-server.js CLAUDE.md ./
COPY test-app/ ./test-app/

# Create images directory for Phase 4+ and set ownership
RUN mkdir -p /tmp/images && chown appuser:appuser /tmp/images
RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 3001

CMD ["node", "vm-server.js"]
