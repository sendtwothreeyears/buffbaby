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

# Install only Chromium for Playwright (not Firefox/WebKit)
RUN npx playwright install chromium

WORKDIR /app

# Install Express dependency
COPY package.json ./
RUN npm install --production

# Copy application files
COPY vm-server.js ./

# Create images directory for Phase 4+
RUN mkdir -p /tmp/images

EXPOSE 3001

CMD ["node", "vm-server.js"]
