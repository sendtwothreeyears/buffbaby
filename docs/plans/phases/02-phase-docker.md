# Phase 2: Docker

**Stage:** Local Development
**Depends on:** Nothing (can be built in parallel with Phase 1)
**Done when:** `docker run` starts the container, you can `curl` the HTTP endpoint with a prompt, and Claude Code responds with text.

## What You Build

A Docker image containing the full VM runtime: Claude Code CLI, Playwright MCP, Node.js, git, and Chromium. Inside the container, a thin HTTP API wrapper accepts a command string via POST, runs it through Claude Code in headless mode (`claude -p --dangerously-skip-permissions`), and returns a structured JSON response.

Deliverables:
- `Dockerfile` with Claude Code CLI, Playwright MCP (`@playwright/mcp`), Node.js, git, Chromium
- Thin HTTP API wrapper exposing:
  - `POST /command` — accepts `{ text: "..." }`, returns `{ text: "...", images: [] }` (images array empty for now, used in Phase 4+)
  - `GET /health` — returns `{ status: "ok" }` (used by relay and Fly.io health checks)
  - `GET /images/:filename` — serves files from `/tmp/images/` (directory created but empty until Phase 4)
- `docker-compose.yml` for easy local startup
- `.mcp.json` pre-configured with Playwright MCP server
- `.env.example` documenting all required environment variables

## Tasks

- [x] Build Dockerfile with Claude Code CLI + Playwright MCP + Node.js + git + Chromium, expose HTTP API that accepts a command and returns Claude Code headless output
  - Brainstorm: `/workflow:brainstorm Docker image design — Claude Code headless + Playwright MCP + HTTP API wrapper`
  - Plan: `/workflow:plan Docker image with Claude Code CLI headless mode and HTTP API wrapper`
  - Ship: `/workflow:ship docs/plans/YYYY-MM-DD-feat-docker-vm-plan.md`

## Notes

- **`--dangerously-skip-permissions` is required in Docker.** There is no interactive TTY in the container to approve tool use, so `claude -p` would hang waiting for confirmation that never comes. The flag auto-approves all tool use — which is safe here because Docker itself is the sandbox. Use `claude -p --dangerously-skip-permissions "prompt"` for single-turn execution.
- The HTTP API wrapper spawns `claude -p` as a child process. Use `child_process.execFile` or `spawn` (not `exec`) to avoid shell injection. Capture both stdout and stderr.
- Set a maximum execution timeout on the child process (5-10 minutes) to prevent zombie processes.
- The response shape `{ text: "...", images: [] }` is designed for forward-compatibility with Phase 4 (Screenshots). The `images` array will carry `{ type: "screenshot"|"diff", url: "/images/xxx.png" }` objects once the image pipeline is built.
- Playwright MCP needs `--no-sandbox` flag in Docker (Chromium sandboxing conflicts with Docker's own sandboxing).
- **Validate Playwright MCP works:** After building the image, test with a prompt like "take a screenshot of https://example.com" to confirm the MCP server is properly configured. Catch config issues now, not in Phase 4.
- The same Docker image must run identically on Mac (local dev) and Fly.io (production). No platform-specific code.
- API keys are passed as environment variables — never baked into the image. Also set `GITHUB_TOKEN` for PR creation (needed in Phase 6).
- **Memory:** Chromium + Claude Code is memory-heavy. Allocate at least 2GB Docker memory for local dev. Fly.io VM sizing will matter in Phase 7.
- Keep the API wrapper in a single file. It's not the product — it's plumbing.

## Review

**Status:** PASS
**Reviewed:** 2026-02-25

### Validation Results

| Criterion | Status | Evidence |
|-----------|--------|----------|
| `docker build` succeeds | PASS | All 11 layers build. Image: `textslash-vm:latest` |
| `docker-compose up` starts container | PASS | Container starts, logs `[STARTUP] VM server listening on port 3001` |
| `GET /health` returns `{"status":"ok"}` | PASS | `curl http://localhost:3001/health` → `{"status":"ok"}` |
| `POST /command` with prompt → Claude Code responds | PASS | `{"text":"4\n","images":[],"exitCode":0,"durationMs":2870}` — prompt "What is 2+2?" returned correct answer. Root-user blocker fixed by adding non-root `appuser`. |
| Missing `text` field returns 400 | PASS | Empty body and empty string both return 400 |
| `/images/nonexistent.png` returns 404 | PASS | Returns `Not Found` with 404 |
| Path traversal (`../../etc/passwd`) returns 400 | PASS | Returns `Bad Request` with 400 |
| Missing `ANTHROPIC_API_KEY` → fail-fast exit | PASS | Container exits with code 1 and clear error message |
| `SIGTERM` graceful shutdown | PASS | Container stops cleanly after `docker kill --signal SIGTERM` |
| `.mcp.json` with Playwright MCP | N/A | Deliberately removed in 177f86f — replaced with Playwright CLI |

### Blocker Found & Fixed

**Claude Code refuses to run as root.** Initial Dockerfile ran as `root` (Docker default). Claude Code CLI rejects `--dangerously-skip-permissions` under root/sudo privileges. Fixed by adding a non-root `appuser` — also a Docker security best practice.

### Code Quality

- **157 LOC** single-file server — clean and focused
- Proper `detached: true` + process group killing prevents orphan processes
- 10MB stdout/stderr buffer caps prevent OOM
- Startup validation of `ANTHROPIC_API_KEY` and `COMMAND_TIMEOUT_MS`
- Path traversal protection on `/images/:filename`
- Concurrency guard (boolean mutex, 409 response)
- Logging follows relay conventions (`[COMMAND]`, `[SPAWN]`, `[DONE]`, etc.)
- `spawn` (not `exec`) avoids shell injection
- Prompt piped via stdin avoids `ARG_MAX` limits

### Issues Found

None remaining. Root-user blocker resolved during review.

### Tech Debt

- Plan document (`docs/plans/2026-02-25-feat-docker-vm-image-plan.md`) still references `.mcp.json` and old Dockerfile — stale after the Playwright CLI refactor
- Phase 4 notes assume `.mcp.json` exists — will need updating when Phase 4 starts
- Claude Code CLI version not pinned in Dockerfile (risk noted in plan but not yet addressed)

### Next Steps

Phase complete. Next: **Phase 3 — Command** (`03-phase-command.md`). Start with `/workflow:brainstorm` or `/workflow:plan` for connecting the relay to the Docker VM.
