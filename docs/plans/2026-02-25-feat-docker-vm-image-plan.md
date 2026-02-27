---
title: "feat: Docker VM Image with Claude Code CLI and HTTP API Wrapper"
type: feat
status: active
date: 2026-02-25
phase: 2
---

# feat: Docker VM Image with Claude Code CLI and HTTP API Wrapper

## Overview

Build a Docker image that packages the full compute environment for the WhatsApp Agentic Development Cockpit: Claude Code CLI, Playwright MCP, Node.js, git, and Chromium. Inside the container, a single-file Express server (`vm-server.js`) accepts commands via POST, runs them through Claude Code in headless mode, and returns structured JSON. This is the "brain" container — Phase 1's relay is the "mouth." Phase 3 connects them.

## Problem Statement / Motivation

The WhatsApp Agentic Development Cockpit needs a portable, reproducible compute environment that runs Claude Code headlessly. Docker provides identical local/production environments (same image on Mac and Fly.io) and acts as the security sandbox (justifying `--dangerously-skip-permissions`). The HTTP wrapper makes it callable from the relay server without tight coupling.

## Proposed Solution

Four files in a `vm/` subdirectory, plus a root-level `docker-compose.yml`:

| File | Purpose |
|------|---------|
| `vm/Dockerfile` | Multi-layer image: Node.js 22 + system deps + Chromium + Claude Code CLI + Playwright CLI |
| `vm/vm-server.js` | Single-file Express server (~100-150 LOC) with three endpoints |
| `vm/package.json` | Express dependency + start script |
| `vm/.env.example` | Documents required environment variables |
| `docker-compose.yml` | Orchestrates the VM container for local dev |

## Technical Considerations

### API Contract

**Success response (200):**
```json
{
  "text": "Claude Code's stdout output",
  "images": [],
  "exitCode": 0,
  "durationMs": 12345
}
```

**Error responses:**
| Status | Condition | Body |
|--------|-----------|------|
| `400` | Missing or empty `text` field | `{ "error": "bad_request", "message": "Request body must include a non-empty 'text' field" }` |
| `408` | Claude Code exceeded timeout | `{ "error": "timeout", "message": "Command timed out after 300000ms", "text": "<partial stdout if any>", "images": [], "durationMs": 300000 }` |
| `409` | Another command already running | `{ "error": "busy", "message": "A command is already in progress" }` |
| `500` | Claude Code crashed or spawn failed | `{ "error": "execution_error", "message": "<stderr or error detail>", "exitCode": <code>, "durationMs": <ms> }` |

### Concurrency Guard

A simple boolean mutex in `vm-server.js`. When a `/command` request arrives while one is already processing, respond immediately with `409`. This provides defense-in-depth alongside the relay's own concurrency guard (Phase 3). Cost: ~5 lines of code.

### Process Spawning

Use `child_process.spawn` (not `execFile` or `exec`):
- **No shell injection** — `spawn` does not invoke a shell
- **No buffer limits** — streams stdout/stderr incrementally (avoids `execFile`'s 1MB default `maxBuffer`)
- **Prompt via stdin** — write the prompt to `child.stdin` to avoid `ARG_MAX` limits and special character issues. Claude Code supports `claude -p -` for stdin input

```
spawn("claude", ["-p", "--dangerously-skip-permissions", "-"])
→ write prompt to child.stdin
→ start setTimeout(COMMAND_TIMEOUT_MS) → on timeout, child.kill()
→ collect stdout chunks → join into text
→ collect stderr chunks → join for error reporting
→ on close → return { text, images, exitCode, durationMs }
```

### Timeout

Default: **5 minutes** (300,000ms), configurable via `COMMAND_TIMEOUT_MS` environment variable. On timeout, kill the child process tree and return a `408` response with any partial output captured so far.

### stdout vs stderr

- `text` field = stdout only (Claude Code's primary output)
- stderr is captured but only surfaced in error responses (non-zero exit code → stderr goes in `message`)
- If exit code is 0 but stderr has content → log it server-side, don't include in response (it's warnings/noise)

### Path Traversal Protection

The `/images/:filename` endpoint must sanitize the filename:
```javascript
const resolved = path.resolve("/tmp/images", req.params.filename);
if (!resolved.startsWith("/tmp/images/")) return res.sendStatus(400);
```

### Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `ANTHROPIC_API_KEY` | Yes | — | Claude Code API authentication |
| `PORT` | No | `3001` | Express listen port |
| `COMMAND_TIMEOUT_MS` | No | `300000` | Max execution time per command |
| `GITHUB_TOKEN` | No | — | For PR creation (Phase 6+) |

Validate `ANTHROPIC_API_KEY` at startup — fail fast and exit with a clear error message, matching the relay's pattern.

### Graceful Shutdown

Trap `SIGTERM` in `vm-server.js`. If a Claude Code process is running, kill it, then exit. Fly.io sends `SIGTERM` and waits 10 seconds before `SIGKILL` — this ensures clean resource release.

### Docker Image Layers

Ordered for cache efficiency (least-changing first):

1. `FROM node:22` (full Debian image — Chromium needs system libs)
2. Install system dependencies (Chromium, git, fonts, libX11, libgbm, etc.)
3. `npm install -g @anthropic-ai/claude-code` (global CLI)
4. Copy `package.json` + `npm install` (Express dependency)
5. Copy `vm-server.js`, `.mcp.json`
6. Create `/tmp/images/` directory
7. `EXPOSE 3001`, `CMD ["node", "vm-server.js"]`

### .mcp.json Configuration

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp", "--headless", "--no-sandbox"]
    }
  }
}
```

Place in `/app` (the `WORKDIR`). Claude Code discovers `.mcp.json` in the cwd of the spawned process, which inherits `/app` from `vm-server.js`.

### Health Check

Shallow for Phase 2: `/health` returns `{ status: "ok" }` if Express is running. Deep health checks (verify Claude Code binary, Playwright, API key) deferred to Phase 7 when Fly.io needs them.

### Logging

Follow relay conventions:
```
[STARTUP]  Server listening on port 3001
[COMMAND]  Received prompt (234 chars)
[SPAWN]    Claude Code PID 1234
[DONE]     Exit 0, 12345ms, 5678 chars output
[TIMEOUT]  Killed PID 1234 after 300000ms
[ERROR]    Spawn failed: ENOENT
[HEALTH]   Health check OK
```

## Acceptance Criteria

- [ ] `docker build vm/` succeeds and produces a runnable image
- [ ] `docker-compose up` starts the container and exposes port 3001
- [ ] `curl http://localhost:3001/health` returns `{"status":"ok"}`
- [ ] `curl -X POST http://localhost:3001/command -H 'Content-Type: application/json' -d '{"text":"What is 2+2?"}'` returns a JSON response with Claude Code's answer in `text`, `exitCode: 0`, and `durationMs` > 0
- [ ] Response includes empty `images` array
- [ ] Missing `text` field returns `400`
- [ ] Second concurrent request returns `409`
- [ ] `/images/nonexistent.png` returns `404`
- [ ] Path traversal attempt (`/images/../../etc/passwd`) returns `400`
- [ ] Container starts only when `ANTHROPIC_API_KEY` is set (fails fast without it)
- [ ] Playwright MCP works: `{"text":"Take a screenshot of https://example.com"}` doesn't error (screenshot capture is Phase 4, but the MCP server should be reachable)
- [ ] `SIGTERM` gracefully shuts down the server

## Dependencies & Risks

| Risk | Mitigation |
|------|------------|
| ARM vs x86 mismatch (M-series Mac vs Fly.io) | Docker handles this via QEMU emulation for build; verify both platforms in Phase 7 |
| Claude Code CLI breaking changes | Pin version in Dockerfile (`@anthropic-ai/claude-code@X.Y.Z`) after initial testing |
| Large image size (2-4GB) | Acceptable for dev; optimize layers for cache hits to speed rebuilds |
| Chromium not starting in container | Use `--no-sandbox` flag; test explicitly in acceptance criteria |
| Playwright MCP schema changes | Pin `@playwright/mcp` version in package.json |

## MVP

### vm/Dockerfile

```dockerfile
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
```

### vm/package.json

```json
{
  "name": "textslash-vm",
  "version": "0.1.0",
  "private": true,
  "main": "vm-server.js",
  "scripts": {
    "start": "node vm-server.js"
  },
  "dependencies": {
    "express": "^4.21.0"
  }
}
```

### vm/vm-server.js

```javascript
const express = require("express");
const { spawn } = require("child_process");
const path = require("path");

const { ANTHROPIC_API_KEY, PORT = "3001", COMMAND_TIMEOUT_MS = "300000" } = process.env;

// Fail-fast env var validation
if (!ANTHROPIC_API_KEY) {
  console.error("Missing required env var: ANTHROPIC_API_KEY");
  process.exit(1);
}

const TIMEOUT = Number(COMMAND_TIMEOUT_MS);
const IMAGES_DIR = "/tmp/images";
const app = express();
let busy = false;
let activeChild = null;

app.use(express.json());

// POST /command — run a prompt through Claude Code
app.post("/command", (req, res) => {
  const { text } = req.body || {};
  if (!text || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "bad_request", message: "Request body must include a non-empty 'text' field" });
  }
  if (busy) {
    return res.status(409).json({ error: "busy", message: "A command is already in progress" });
  }

  busy = true;
  const start = Date.now();
  const stdoutChunks = [];
  const stderrChunks = [];

  const child = spawn("claude", ["-p", "--dangerously-skip-permissions", "-"], {
    env: { ...process.env },
  });
  activeChild = child;
  let timedOut = false;

  console.log(`[COMMAND] Received prompt (${text.length} chars)`);
  console.log(`[SPAWN]   Claude Code PID ${child.pid}`);

  // Manual timeout — spawn does not support a timeout option
  const timer = setTimeout(() => {
    timedOut = true;
    child.kill();
  }, TIMEOUT);

  child.stdin.write(text);
  child.stdin.end();

  child.stdout.on("data", (chunk) => stdoutChunks.push(chunk));
  child.stderr.on("data", (chunk) => stderrChunks.push(chunk));

  child.on("error", (err) => {
    clearTimeout(timer);
    busy = false;
    activeChild = null;
    const durationMs = Date.now() - start;
    console.error(`[ERROR]   Spawn failed: ${err.message}`);
    res.status(500).json({ error: "execution_error", message: err.message, exitCode: null, durationMs });
  });

  child.on("close", (code) => {
    clearTimeout(timer);
    busy = false;
    activeChild = null;
    const durationMs = Date.now() - start;
    const text_out = Buffer.concat(stdoutChunks).toString();
    const stderr_out = Buffer.concat(stderrChunks).toString();

    if (timedOut) {
      console.log(`[TIMEOUT] Killed PID ${child.pid} after ${durationMs}ms`);
      return res.status(408).json({
        error: "timeout",
        message: `Command timed out after ${TIMEOUT}ms`,
        text: text_out || null,
        images: [],
        durationMs,
      });
    }

    if (code !== 0) {
      console.log(`[DONE]    Exit ${code}, ${durationMs}ms`);
      return res.status(500).json({
        error: "execution_error",
        message: stderr_out || `Process exited with code ${code}`,
        exitCode: code,
        durationMs,
      });
    }

    console.log(`[DONE]    Exit 0, ${durationMs}ms, ${text_out.length} chars output`);
    res.json({ text: text_out, images: [], exitCode: 0, durationMs });
  });
});

// GET /health
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// GET /images/:filename — serve files from /tmp/images with path traversal protection
app.get("/images/:filename", (req, res) => {
  const resolved = path.resolve(IMAGES_DIR, req.params.filename);
  if (!resolved.startsWith(IMAGES_DIR + "/")) {
    return res.sendStatus(400);
  }
  res.sendFile(resolved, (err) => {
    if (err) res.sendStatus(404);
  });
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[SHUTDOWN] SIGTERM received");
  if (activeChild) activeChild.kill();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`[STARTUP] VM server listening on port ${PORT}`);
});
```

### vm/.mcp.json

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp", "--headless", "--no-sandbox"]
    }
  }
}
```

### vm/.env.example

```bash
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
PORT=3001
COMMAND_TIMEOUT_MS=300000
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### docker-compose.yml (root level)

```yaml
services:
  vm:
    build: ./vm
    ports:
      - "3001:3001"
    env_file:
      - ./vm/.env
    deploy:
      resources:
        limits:
          memory: 4g
    restart: unless-stopped
```

## Testing Strategy

1. **Build test:** `docker build vm/` completes without errors
2. **Startup test:** `docker-compose up` → logs show `[STARTUP] VM server listening on port 3001`
3. **Health check:** `curl http://localhost:3001/health` → `{"status":"ok"}`
4. **Command test:** `curl -X POST http://localhost:3001/command -H 'Content-Type: application/json' -d '{"text":"What is 2+2?"}'` → JSON with answer
5. **Validation test:** POST with empty body → `400`
6. **Concurrency test:** Two simultaneous POSTs → second gets `409`
7. **Image 404 test:** `curl http://localhost:3001/images/nope.png` → `404`
8. **Path traversal test:** `curl http://localhost:3001/images/..%2F..%2Fetc%2Fpasswd` → `400`
9. **Playwright MCP test:** `{"text":"Take a screenshot of https://example.com"}` → no MCP connection errors in logs
10. **Missing API key test:** Remove `ANTHROPIC_API_KEY` → container exits with clear error

## References

### Internal
- Phase 2 spec: `docs/plans/phases/02-phase-docker.md`
- Brainstorm: `docs/brainstorms/2026-02-25-docker-vm-image-brainstorm.md`
- Relay server patterns: `server.js`
- Phase 3 (downstream consumer): `docs/plans/phases/03-phase-command.md`
- Phase 1 learnings: `docs/solutions/developer-experience/sms-echo-server-twilio-ngrok-setup-20260225.md`

### Forward Compatibility
- Phase 3 will call `POST /command` from the relay
- Phase 4 will populate the `images` array via `/images/:filename`
