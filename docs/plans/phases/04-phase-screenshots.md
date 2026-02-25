# Phase 4: Screenshots

**Stage:** Local Development
**Depends on:** Phase 3 (Command)
**Done when:** You text "show me the app" and receive a screenshot of the running app on your phone via MMS.

## What You Build

Claude Code uses Playwright MCP inside the Docker container to capture screenshots of a running dev server. The Docker container serves screenshots via an HTTP endpoint. The relay fetches the screenshot from the container and sends it via Twilio MMS.

This phase adds one new capability: **images flow from the VM to the phone**.

Deliverables:
- Playwright MCP configured and working inside Docker (headless Chromium, `--no-sandbox`)
- Screenshots captured at **2x device pixel ratio** (retina quality) at both **mobile (390px)** and **desktop (1440px)** viewports for readability when pinch-to-zoomed on a phone
- **ImageStore interface** with `upload(buffer, filename)` and `getUrl(filename)` methods. V1 implementation: local filesystem (`/tmp/images/`). Swappable to R2/S3 later.
- Image serving endpoint in the Docker container: `GET /images/:filename` serves files from `/tmp/images/` (already stubbed in Phase 2)
- **Structured image response:** The API wrapper's `/command` response includes images in the `images` array: `{ text: "...", images: [{ type: "screenshot", url: "/images/screenshot-123.png" }] }`. The relay reads this array — no regex parsing of Claude Code's free-text output.
- Relay updated: reads `images` array from response, fetches each from `CLAUDE_HOST`, sends via Twilio MMS
- **Playwright screenshot-to-file pipeline:** A wrapper that takes Playwright MCP's base64-encoded screenshot output, decodes it, saves to `/tmp/images/` with a UUID filename, and registers it in the response's `images` array
- A sample dev server (simple Vite or Next.js app) running inside Docker for Playwright to screenshot
- Images compressed to < 1MB: JPEG for screenshots (photo-quality UI), PNG reserved for diffs (Phase 5)

## Tasks

- [ ] Configure Playwright MCP in Docker, build ImageStore interface, add structured image response to API, relay fetches screenshots and sends via Twilio MMS
  - Plan: `/workflow:plan screenshot pipeline — Playwright MCP, ImageStore interface, structured JSON response, relay MMS delivery`
  - Ship: `/workflow:ship docs/plans/YYYY-MM-DD-feat-screenshot-pipeline-plan.md`

- [ ] Start a sample dev server (Vite or Next.js) inside the Docker container that Playwright can capture
  - Plan: `/workflow:plan sample dev server inside Docker for Playwright screenshot testing`
  - Ship: `/workflow:ship docs/plans/YYYY-MM-DD-feat-sample-dev-server-plan.md`

## Notes

- Playwright MCP is already configured in `.mcp.json` — Claude Code calls its tools natively (e.g., `browser_screenshot`, `browser_navigate`).
- The structured JSON approach for image delivery avoids fragile regex parsing. The API wrapper knows when screenshots are taken (it's running the command) and includes them in the response. The relay never parses Claude Code's free-text output for image paths.
- Consider how the relay knows the Docker container's image URL. In local dev: `http://localhost:3000/images/screenshot-123.png`. In production: `https://user-vm.fly.dev/images/screenshot-123.png`. This is a `.env` config (`IMAGE_HOST`).
- `/tmp/images/` is volatile — container restarts clear it. Acceptable for local dev. For production (Phase 7+), images need to persist long enough for the relay to fetch them. Fly.io volumes or a cleanup TTL should be considered.
- Image filenames should use UUIDs to prevent guessing. In production, add token-based auth to the image endpoint.
