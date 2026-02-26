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

# Tell Playwright to use system Chromium
ENV CHROME_PATH=/usr/bin/chromium
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code

WORKDIR /app

# Install Express dependency
COPY package.json ./
RUN npm install --production

# Copy application files
COPY vm-server.js .mcp.json ./

# Create images directory for Phase 4+
RUN mkdir -p /tmp/images

EXPOSE 3001

CMD ["node", "vm-server.js"]
