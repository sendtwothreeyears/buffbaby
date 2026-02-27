---
date: 2026-02-25
topic: docker-vm-image
phase: 2
---

# Phase 2: Docker VM Image

## What We're Building

A Docker image that packages the full compute environment for the WhatsApp Agentic Development Cockpit: Claude Code CLI, Playwright MCP, Node.js, git, and Chromium. Inside the container, a thin Express HTTP API wrapper accepts a command string via POST, runs it through Claude Code in headless mode, and returns a structured JSON response.

This is the "brain" container — the relay (Phase 1) is the "mouth." Phase 3 connects them.

## Why This Approach

**Overall design:** Claude Code CLI is the intelligence layer — it already handles tool use, code generation, and Playwright MCP orchestration. We don't need to reimplement any of that. The container's only job is to expose Claude Code over HTTP so the relay can call it. That means: Docker image with Claude Code pre-installed, a thin HTTP wrapper that shells out to `claude -p`, and nothing else. Docker gives us identical local/production environments (same image on Mac and Fly.io) and acts as the security sandbox (justifying `--dangerously-skip-permissions`).

**API pattern:** We considered three approaches for the `/command` endpoint:

1. **Synchronous (chosen)** — POST blocks until Claude Code finishes. Simplest possible implementation. The relay (Phase 3) handles async concerns — it responds to Twilio immediately and calls the container in the background. No job stores, no polling, no SSE plumbing.

2. **Async with polling** — Returns a job ID, poll for results. Adds complexity (job tracking, cleanup) that isn't needed when each user has their own container with no concurrent request pressure.

3. **Streaming (SSE)** — Streams output as it arrives. Useful for Phase 6 progress updates, but premature now. Can be added to the single-file wrapper when needed.

## Key Decisions

- **Claude Code CLI installation**: `npm install -g @anthropic-ai/claude-code` — keeps it simple, uses the Node.js already in the image
- **Port**: Container exposes port 3001 (relay stays on 3000, avoids conflict for Phase 3)
- **File layout**: All Docker files live in `vm/` subdirectory (Dockerfile, vm-server.js, package.json, .mcp.json) — clean boundary from the relay code at root
- **API framework**: Express — consistent with the relay server, familiar patterns
- **Command execution**: Synchronous blocking endpoint. YAGNI on async/streaming until Phase 6 proves the need
- **Process spawning**: `child_process.execFile` or `spawn` (not `exec`) to avoid shell injection
- **Execution timeout**: 5-10 minute cap on child processes to prevent zombies
- **Base image**: Node.js official image (full, not slim/alpine — Chromium + Playwright require system libraries like libX11, libgbm, etc.)
- **Playwright**: `--no-sandbox` flag required in Docker (Chromium sandboxing conflicts with Docker's own sandboxing)
- **Headless mode**: `claude -p --dangerously-skip-permissions "prompt"` — no TTY in container, flag auto-approves tool use, Docker is the sandbox

## Open Questions

_(None — all design questions resolved during brainstorm)_

## Next Steps

> `/workflow:plan` for implementation details — Dockerfile layers, exact dependencies, .mcp.json configuration, docker-compose.yml, and testing strategy.
