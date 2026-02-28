FROM node:22-slim

RUN useradd -m -s /bin/bash appuser

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --production

COPY server.js relay-core.js ./
COPY adapters/ ./adapters/

RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 3000

CMD ["node", "server.js"]
