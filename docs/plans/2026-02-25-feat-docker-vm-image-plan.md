---
phase: 2
condensed: true
original: archive/plans/2026-02-25-feat-docker-vm-image-plan.md
---

# Phase 2: Docker VM Image with Claude Code CLI and HTTP API Wrapper (Condensed)

**Stage:** Local Development
**Depends on:** Phase 1 (Echo Server)
**Done when:** `docker-compose up` starts a container that responds to `POST /command` with Claude Code's output and `GET /health` returns OK.

## Summary

Built a Docker image packaging the full compute environment: Claude Code CLI, Playwright MCP, Node.js, git, and Chromium. Inside the container, a single-file Express server (`vm-server.js`) accepts commands via POST, runs them through Claude Code in headless mode using `child_process.spawn`, and returns structured JSON. Includes concurrency guard (boolean mutex), configurable timeout (default 5 min), path-traversal-protected image serving, and graceful SIGTERM shutdown.

## Key Deliverables

- `vm/Dockerfile` — Multi-layer image: Node.js 22, system deps, Chromium, Claude Code CLI, Playwright
- `vm/vm-server.js` — Express server with `POST /command`, `GET /health`, `GET /images/:filename`
- `vm/package.json` — Express dependency
- `vm/.env.example` — ANTHROPIC_API_KEY, PORT, COMMAND_TIMEOUT_MS, GITHUB_TOKEN
- `vm/.mcp.json` — Playwright MCP configuration (headless, no-sandbox)
- `docker-compose.yml` — VM orchestration with 4GB memory limit

## Key Technical Decisions

- **`child_process.spawn` (not exec/execFile)**: No shell injection, no buffer limits, prompt via stdin to avoid ARG_MAX
- **Boolean mutex for concurrency**: Returns 409 if command already running; ~5 lines of code
- **5-minute default timeout**: Kill child process tree on timeout, return 408 with partial output
- **stdout only in `text` field**: stderr captured but only surfaced in error responses
- **Path traversal protection**: `path.resolve` + `startsWith` check on `/images/:filename`
- **Fail-fast env validation**: Exit immediately if `ANTHROPIC_API_KEY` missing

## Status

Completed
