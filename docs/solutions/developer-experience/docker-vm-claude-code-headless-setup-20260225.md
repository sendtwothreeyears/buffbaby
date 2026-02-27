---
module: Docker VM
date: 2026-02-25
problem_type: developer_experience
component: vm-server-docker
symptoms:
  - "Claude Code CLI refuses --dangerously-skip-permissions when container runs as root"
  - "Orphan child processes accumulate on timeout or container shutdown"
  - "Unbounded stdout/stderr buffers risk OOM in constrained container"
  - "Path traversal on /images endpoint allows reading arbitrary files"
  - "Playwright MCP server config adds fragile complexity vs CLI approach"
root_cause: "Docker defaults to root user; Claude Code CLI rejects dangerous permissions under root/sudo privileges — blocking all headless execution in the container"
resolution_type: code_fix
severity: critical
tags: [docker, claude-code, non-root-user, process-management, container, headless, phase-2]
---

# Troubleshooting: Docker VM with Claude Code CLI Headless Execution

## Problem

Building a Docker image to run Claude Code CLI headlessly via an HTTP API wrapper hit a critical blocker: Claude Code refuses `--dangerously-skip-permissions` when running as root. Additionally, the containerized process management required explicit orphan cleanup, output buffer caps, and path traversal protection.

## Environment

- **Module:** Docker VM
- **Component:** vm-server.js (Express HTTP wrapper) + Dockerfile
- **Date:** 2026-02-25
- **Phase:** 2 (Docker)
- **Stack:** Node.js 22, Express 4, Claude Code CLI, Playwright CLI, Chromium, Docker

## Symptoms

- Container starts but `POST /command` returns 500 — Claude Code exits immediately
- Long-running commands leave orphan processes after timeout
- Pathological prompts (huge output) could exhaust container memory
- `GET /images/../../etc/passwd` reads arbitrary files
- `.mcp.json` + `@playwright/mcp` server added unnecessary configuration surface area

## What Didn't Work

**Attempted:** Running the container as root (Docker default).
- **Why it failed:** Claude Code CLI has a security guard that rejects `--dangerously-skip-permissions` under root/sudo privileges. No error message in early versions — just a non-zero exit code.

**Attempted:** Using `child.kill()` to terminate Claude Code on timeout.
- **Why it failed:** `kill()` on a single PID only terminates the direct child, not its process tree. Grandchild processes spawned by Claude Code survive as orphans.

**Attempted:** Configuring Playwright via `.mcp.json` with `@playwright/mcp` server.
- **Why it failed:** Added fragile configuration surface area. Playwright CLI is simpler, more observable (stdout/stderr), and easier to debug.

## Solution

### 1. Non-Root User (Critical Blocker)

Create a non-root user and run the server as that user:

```dockerfile
# Create non-root user (Claude Code refuses --dangerously-skip-permissions as root)
RUN useradd -m -s /bin/bash appuser

# Create images directory and set ownership
RUN mkdir -p /tmp/images && chown appuser:appuser /tmp/images
RUN chown -R appuser:appuser /app

USER appuser
```

### 2. Process Group Management

Spawn with `detached: true` and kill the entire process group (negative PID):

```javascript
const child = spawn("claude", ["-p", "--dangerously-skip-permissions", "-"], {
  detached: true,
  stdio: ["pipe", "pipe", "pipe"],
});

// Kill entire process group, not just the child
const killChild = () => {
  try { process.kill(-child.pid, "SIGTERM"); } catch (_) { /* already dead */ }
};
```

### 3. Output Buffer Caps

Cap stdout/stderr at 10MB to prevent OOM:

```javascript
const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;
child.stdout.on("data", (chunk) => {
  stdoutBytes += chunk.length;
  if (stdoutBytes <= MAX_OUTPUT_BYTES) stdoutChunks.push(chunk);
});
```

### 4. Path Traversal Protection

Normalize and validate file paths on the `/images` endpoint:

```javascript
const resolved = path.resolve(IMAGES_DIR, req.params.filename);
if (!resolved.startsWith(IMAGES_DIR + "/")) {
  return res.sendStatus(400);
}
```

### 5. Stdin Error Handling

Swallow broken-pipe errors when Claude Code exits early:

```javascript
child.stdin.on("error", () => {}); // swallow broken-pipe if child dies early
child.stdin.write(text);
child.stdin.end();
```

### 6. Playwright CLI over MCP

Replaced `.mcp.json` + `@playwright/mcp` with direct Playwright CLI installation:

```dockerfile
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm install -g @anthropic-ai/claude-code playwright
RUN npx playwright install chromium
```

## Why This Works

1. **Non-root user** satisfies Claude Code's security guard while following Docker best practices. The container itself is the sandbox — `--dangerously-skip-permissions` is safe because Docker provides the isolation.
2. **Process groups** (`detached: true` + `process.kill(-pid)`) are the standard POSIX pattern for managing process trees. A negative PID targets the entire group, killing the child and all descendants.
3. **Buffer caps** trade the ability to capture pathological output for guaranteed OOM prevention. 10MB accommodates any legitimate Claude Code response.
4. **`path.resolve()` + `startsWith()`** normalizes `..` sequences before checking containment, defeating all path traversal variants including URL-encoded attempts.
5. **Playwright CLI** is simpler than MCP server configuration — fewer moving parts, same functionality, easier to debug.

## Prevention

### Docker + Claude Code Checklist
- Always create a non-root user in Dockerfiles that run Claude Code
- Comment the `USER` directive: `# Claude Code CLI requires non-root user`
- Test `POST /command` early — don't wait until later phases to discover root-user issues

### Process Management in Containers
- Always use `detached: true` + process group killing when spawning subprocesses in Docker
- Register `SIGTERM` handler for graceful shutdown (Docker sends SIGTERM on `docker stop`)
- Cap output buffers for any subprocess — unbounded collection is an OOM vector

### File Serving Security
- Pattern for safe file serving: `path.resolve()` then `startsWith(baseDir + "/")`
- Test with traversal attempts: `../../etc/passwd`, `%2e%2e/etc/passwd`
- Apply to all future file-serving endpoints (Phase 4 screenshots, Phase 5 diffs)

### Documentation Sync
- Any code change that pivots from a planned approach (e.g., MCP → CLI) must update plan docs immediately
- Search for stale references after refactors: `grep -r "\.mcp\.json" docs/`

### Known Tech Debt
- Claude Code CLI version not pinned in Dockerfile — risk of breaking changes on rebuild
- Plan document (`docs/plans/2026-02-25-feat-docker-vm-image-plan.md`) still references `.mcp.json`
- Phase 4 notes assume `.mcp.json` exists — needs updating when Phase 4 starts

## Related Issues

- See also: [WhatsApp Echo Server with Twilio/ngrok Setup](sms-echo-server-twilio-ngrok-setup-20260225.md) — Phase 1 local development setup (same project, prior phase)
- This is the first containerization/Docker solution doc. Future Phase 7 (deploy) and Phase 8 (provisioning) docs should reference this for baseline patterns.
