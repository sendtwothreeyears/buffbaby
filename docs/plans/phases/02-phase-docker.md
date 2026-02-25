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

- [ ] Build Dockerfile with Claude Code CLI + Playwright MCP + Node.js + git + Chromium, expose HTTP API that accepts a command and returns Claude Code headless output
  - Brainstorm: `/workflow:brainstorm Docker image design — Claude Code headless + Playwright MCP + HTTP API wrapper`
  - Plan: `/workflow:plan Docker image with Claude Code CLI headless mode and HTTP API wrapper`
  - Ship: `/workflow:ship docs/plans/YYYY-MM-DD-feat-docker-vm-plan.md`

## Notes

- **CRITICAL: `--dangerously-skip-permissions` is required.** `claude -p` without this flag will hang on any prompt that triggers tool use (file writes, bash commands) waiting for confirmation that never comes. Use `claude -p --dangerously-skip-permissions "prompt"` for single-turn execution.
- The HTTP API wrapper spawns `claude -p` as a child process. Use `child_process.execFile` or `spawn` (not `exec`) to avoid shell injection. Capture both stdout and stderr.
- Set a maximum execution timeout on the child process (5-10 minutes) to prevent zombie processes.
- The response shape `{ text: "...", images: [] }` is designed for forward-compatibility with Phase 4 (Screenshots). The `images` array will carry `{ type: "screenshot"|"diff", url: "/images/xxx.png" }` objects once the image pipeline is built.
- Playwright MCP needs `--no-sandbox` flag in Docker (Chromium sandboxing conflicts with Docker's own sandboxing).
- **Validate Playwright MCP works:** After building the image, test with a prompt like "take a screenshot of https://example.com" to confirm the MCP server is properly configured. Catch config issues now, not in Phase 4.
- The same Docker image must run identically on Mac (local dev) and Fly.io (production). No platform-specific code.
- API keys are passed as environment variables — never baked into the image. Also set `GITHUB_TOKEN` for PR creation (needed in Phase 6).
- **Memory:** Chromium + Claude Code is memory-heavy. Allocate at least 2GB Docker memory for local dev. Fly.io VM sizing will matter in Phase 7.
- Keep the API wrapper in a single file. It's not the product — it's plumbing.
