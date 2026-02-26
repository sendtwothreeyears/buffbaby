# Phase 4: Screenshots

**Stage:** Local Development
**Depends on:** Phase 3 (Command)
**Done when:** You text "show me the app" and receive a screenshot of the running app on your phone via MMS.

## What You Build

Claude Code calls `POST /screenshot` on the VM server, which uses Playwright to capture screenshots. The VM server tracks images produced during each `/command` execution and includes them in the response. The relay proxies images from the VM and sends them to the user via Twilio MMS.

This phase adds one new capability: **images flow from the VM to the phone**.

Deliverables:
- `POST /screenshot` VM endpoint — Playwright captures JPEG screenshots with iterative compression
- Screenshots at **2x DPR** at both **mobile (390x844)** and **desktop (1440x900)** viewports
- `pendingImages` array tracks screenshots per `/command` execution — included in response `images` field
- Image serving: `GET /images/:filename` on VM (Phase 2 stub), `GET /images/:filename` proxy on relay
- Relay sends MMS via Twilio `mediaUrl` when images are present in response
- `vm/CLAUDE.md` documents `/screenshot` endpoint so Claude Code knows how to use it
- Static test app (`vm/test-app/index.html`) served on port 8080 for end-to-end testing
- TTL-based image cleanup (30-min expiry, 100-file cap)
- JPEG compression to < 600KB target, < 1MB hard ceiling

## Tasks

- [x] Implement screenshot pipeline: `POST /screenshot` endpoint, pendingImages tracking, relay image proxy, MMS delivery
  - Plan: `docs/plans/2026-02-26-feat-phase-4-screenshots-plan.md`
  - Ship: `/workflow:ship docs/plans/2026-02-26-feat-phase-4-screenshots-plan.md`

## Notes

- Claude Code calls `curl POST http://localhost:3001/screenshot` during `/command` execution — the VM server tracks the resulting image and includes it in the `/command` response
- The structured JSON approach avoids fragile regex parsing of Claude Code's free-text output
- The relay constructs public URLs (`PUBLIC_URL + /images/filename`) and passes them to Twilio as `mediaUrl` — Twilio asynchronously fetches images from the relay proxy
- `/tmp/images/` is volatile — container restarts clear it. 30-minute TTL cleanup prevents disk fill. For production (Phase 7+), Fly.io volumes or R2/S3 may be needed.
- Image filenames use UUIDs (unguessable). Token-based auth deferred to Phase 7.
- No `.mcp.json` or Playwright MCP — screenshots use the Playwright Node.js API directly via `POST /screenshot`
