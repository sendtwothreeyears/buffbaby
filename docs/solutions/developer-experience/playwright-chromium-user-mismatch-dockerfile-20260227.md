---
module: Docker VM
date: 2026-02-27
problem_type: developer_experience
component: vm-server-docker
symptoms:
  - "POST /screenshot returns 502 — browserType.launch: Executable doesn't exist at /home/appuser/.cache/ms-playwright/chromium_headless_shell-1208"
  - "Playwright Chromium installed as root but app runs as non-root appuser"
  - "ENABLE_TEST_APP missing from vm/.env — test app not running on port 8080"
root_cause: "Dockerfile runs `npx playwright install chromium` as root (before USER appuser), so the browser binary lands in /root/.cache/ms-playwright/. The app runs as appuser and looks in /home/appuser/.cache/ms-playwright/ — which doesn't exist."
resolution_type: code_fix
severity: high
tags: [docker, playwright, chromium, non-root-user, screenshot, dockerfile, phase-6]
---

# Troubleshooting: Playwright Chromium User Mismatch in Dockerfile

## Problem

The screenshot pipeline (`POST /screenshot`) failed with a browser-not-found error despite `npx playwright install chromium` being present in the Dockerfile. The root cause was a user context mismatch — Playwright was installed as root but the app runs as a non-root user.

## Environment

- **Module:** Docker VM
- **Component:** vm-server.js + Dockerfile
- **Date:** 2026-02-27
- **Phase:** 6 (E2E Local)
- **Stack:** Node.js 22, Playwright, Chromium, Docker

## Symptoms

- `POST /screenshot` returns 502 with error: `browserType.launch: Executable doesn't exist at /home/appuser/.cache/ms-playwright/chromium_headless_shell-1208/chrome-linux/headless_shell`
- Screenshot pipeline appeared fully wired (VM endpoint, relay proxy, Twilio media) but never produced images
- Claude Code inside the container could not take screenshots — silently fell back to text-only responses
- Test app on port 8080 not running (separate config issue)

## What Didn't Work

- The original Dockerfile sequence: install Playwright as root, then switch to `USER appuser` later. Playwright's browser cache is user-specific (`~/.cache/ms-playwright/`), so root's install is invisible to appuser.

## Solution

**1. Dockerfile fix — install Chromium as the runtime user:**

```dockerfile
# Before (broken):
RUN npx playwright install chromium          # Installs to /root/.cache/
RUN useradd -m -s /bin/bash appuser
USER appuser

# After (fixed):
RUN useradd -m -s /bin/bash appuser
USER appuser
RUN npx playwright install chromium          # Installs to /home/appuser/.cache/
USER root                                     # Switch back for remaining root ops
```

The key insight: temporarily switch to `USER appuser` for the Playwright install, then back to root for remaining setup steps (COPY, chown, etc.), then permanently switch to appuser at the end.

**2. Enable test app — add to vm/.env:**

```
ENABLE_TEST_APP=true
```

This was present in `.env.example` but missing from the actual `.env` file.

## Why This Works

Playwright stores browser binaries in `~/.cache/ms-playwright/` relative to the current user's home directory. When `npx playwright install chromium` runs as root, the binary goes to `/root/.cache/ms-playwright/`. When the app later runs as `appuser`, Playwright looks in `/home/appuser/.cache/ms-playwright/` — a completely different path.

By running the install command as `appuser`, the binary lands exactly where the runtime process expects it.

## Prevention

- **Rule:** Any `RUN` command that creates user-specific caches (Playwright, npm global, pip) must run as the same user that will execute the app at runtime.
- **Pattern:** When Dockerfiles use non-root users, audit every `RUN` command that writes to `~/.cache/`, `~/.local/`, or `~/.npm/` — ensure they execute under the correct `USER`.
- **Test:** After `docker compose build`, always verify: `docker exec <container> curl -s -X POST localhost:3001/screenshot -H "Content-Type: application/json" -d '{"url":"https://example.com"}'` should return `{"success":true,...}`.

## Related Issues

- [Docker VM Claude Code Headless Setup](docker-vm-claude-code-headless-setup-20260225.md) — original non-root user requirement that created this Dockerfile pattern
- [Screenshot Pipeline Architecture](../best-practices/screenshot-pipeline-architecture-playwright-relay-whatsapp-20260226.md) — the pipeline this fix unblocks
