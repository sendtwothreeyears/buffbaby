---
date: 2026-02-25
topic: Docker VM Image
phase: 2
condensed: true
original: archive/brainstorms/2026-02-25-docker-vm-image-brainstorm.md
---

# Phase 2: Docker VM Image (Condensed)

## Summary

Explored the design of a Docker image packaging the full compute environment (Claude Code CLI, Playwright, Node.js, git, Chromium) with a thin Express HTTP API wrapper. The container is the "brain" -- accepts commands via POST, runs them through Claude Code headless, returns structured JSON.

## Key Decisions

- **Synchronous API**: POST blocks until Claude Code finishes; relay handles async concerns. YAGNI on polling/SSE until Phase 6.
- **File layout**: All Docker files in `vm/` subdirectory (Dockerfile, vm-server.js, package.json, .mcp.json) for clean boundary from relay.
- **Base image**: Node.js full (not slim/alpine) because Chromium + Playwright require system libraries.
- **Process spawning**: `execFile`/`spawn` (not `exec`) to avoid shell injection; 5-10 min timeout cap.
- **Headless mode**: `claude -p --dangerously-skip-permissions` with Docker as the security sandbox.
- **Port 3001**: Avoids conflict with relay on 3000.

## Outcomes

- All design questions resolved during brainstorm; no open questions remained
- Architecture: identical image runs on Mac (local) and Fly.io (production)
- Playwright requires `--no-sandbox` flag inside Docker containers

## Status

Completed -- implemented in Phase 2.
