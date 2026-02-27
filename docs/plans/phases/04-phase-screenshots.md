# Phase 4: Screenshots

**Stage:** Local Development
**Depends on:** Phase 3 (Command)
**Done when:** You text "show me the app" and receive a screenshot of the running app on your phone via WhatsApp.

## What You Build

Claude Code calls `POST /screenshot` on the VM server, which uses Playwright to capture screenshots. The VM server tracks images produced during each `/command` execution and includes them in the response. The relay proxies images from the VM and sends them to the user via Twilio WhatsApp.

This phase adds one new capability: **images flow from the VM to the phone**.

Deliverables:
- `POST /screenshot` VM endpoint — Playwright captures JPEG screenshots with iterative compression
- Screenshots at **2x DPR** at both **mobile (390x844)** and **desktop (1440x900)** viewports
- `pendingImages` array tracks screenshots per `/command` execution — included in response `images` field
- Image serving: `GET /images/:filename` on VM (Phase 2 stub), `GET /images/:filename` proxy on relay
- Relay sends WhatsApp media via Twilio `mediaUrl` when images are present in response
- `vm/CLAUDE.md` documents `/screenshot` endpoint so Claude Code knows how to use it
- Static test app (`vm/test-app/index.html`) served on port 8080 for end-to-end testing
- TTL-based image cleanup (30-min expiry, 100-file cap)
- JPEG compression with quality cascade (75 → 50) targeting < 600KB for fast mobile delivery

## Tasks

- [x] Implement screenshot pipeline: `POST /screenshot` endpoint, pendingImages tracking, relay image proxy, WhatsApp media delivery
  - Plan: `docs/plans/2026-02-26-feat-phase-4-screenshots-plan.md`
  - Ship: `/workflow:ship docs/plans/2026-02-26-feat-phase-4-screenshots-plan.md`

## Notes

- Claude Code calls `curl POST http://localhost:3001/screenshot` during `/command` execution — the VM server tracks the resulting image and includes it in the `/command` response
- The structured JSON approach avoids fragile regex parsing of Claude Code's free-text output
- The relay constructs public URLs (`PUBLIC_URL + /images/filename`) and passes them to Twilio as `mediaUrl` — Twilio asynchronously fetches images from the relay proxy
- `/tmp/images/` is volatile — container restarts clear it. 30-minute TTL cleanup prevents disk fill. For production (Phase 7+), Fly.io volumes or R2/S3 may be needed.
- Image filenames use UUIDs (unguessable). Token-based auth deferred to Phase 7.
- No `.mcp.json` or Playwright MCP — screenshots use the Playwright Node.js API directly via `POST /screenshot`

## Review

**Status:** PASS
**Reviewed:** 2026-02-26

### Validation Results

| Criterion | Status | Evidence |
|-----------|--------|----------|
| `POST /screenshot` VM endpoint with iterative compression | PASS | `vm/vm-server.js:172-219` — Playwright captures JPEG, quality cascade 75 → 50 at 600KB threshold |
| 2x DPR at mobile (390x844) and desktop (1440x900) | PASS | `vm/vm-server.js:28-29` — `MOBILE_VIEWPORT` and `DESKTOP_VIEWPORT` constants with `deviceScaleFactor: 2` |
| `pendingImages` tracks screenshots, included in response `images` field | PASS | All three exit paths (timeout line 126-136, error line 139-150, success line 153-156) drain `pendingImages` and include `images` in the response. Fixed during this review — error path was missing the drain. |
| Image serving: `GET /images/:filename` on VM + relay proxy | PASS | VM: `vm/vm-server.js:161-170` with `path.resolve()` + `startsWith()` traversal protection. Relay: `server.js:55-80` with strict UUID.jpeg regex validation. |
| Relay sends WhatsApp media via Twilio `mediaUrl` | PASS | `server.js:147` constructs public URLs, `server.js:228-238` sends first image with text, splits remaining into separate messages (1-per-message WhatsApp constraint). |
| `vm/CLAUDE.md` documents `/screenshot` endpoint | PASS | Documents URL, parameters, response format, and "when to use" guidance. References WhatsApp delivery correctly. |
| Static test app on port 8080 | PASS | `vm/test-app/index.html` — simple card layout with viewport info. Served via `npx serve` when `ENABLE_TEST_APP` is set (`vm/vm-server.js:270-278`). |
| TTL-based image cleanup (30-min, 100-file cap) | PASS | `vm/vm-server.js:221-255` — cleanup interval every 5 min, deletes expired files then oldest if over cap. ENOENT errors gracefully handled. |
| JPEG compression with quality cascade targeting < 600KB | PASS | `vm/vm-server.js:194-200` — quality 75 first, falls to 50 if >600KB. WhatsApp supports 16MB so no hard ceiling needed. |

### Code Quality

The screenshot endpoint, image proxy, pendingImages pattern, TTL cleanup, and WhatsApp media delivery are well-implemented. The relay's UUID regex validation and VM's path traversal protection provide defense-in-depth. The `busy` flag enforces single concurrency, making `pendingImages` safe from race conditions.

### Issues Found

- **(P1, fixed) Error path didn't drain pendingImages.** `vm/vm-server.js:139-150` now drains `pendingImages` and includes `images` + `text` in the error response, consistent with timeout and success paths.

### Tech Debt

- **Parallel branch divergence.** A branch containing the web chat dev tool (`4d3d44b`+), legacy DPR fallback (`3defa9e` — no longer needed), and Phase 4.1 review diverged from `9113e90` and was never merged into `feat/whatsapp-channel`. The web chat work (Phase 4.1) may need to be re-applied on this branch if desired.

### Next Steps

Phase complete. Next: **Phase 5 — Diffs** (`05-phase-diffs.md`) — start with `/workflow:brainstorm` or `/workflow:plan`.
