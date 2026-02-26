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

## Review

**Status:** PASS
**Reviewed:** 2026-02-26

### Validation Results

| Criterion | Status | Evidence |
|-----------|--------|----------|
| `POST /screenshot` captures JPEG screenshots | PASS | `vm/vm-server.js:173-219` — Playwright chromium, `--no-sandbox`, JPEG output, UUID filenames |
| Mobile (390x844 @ 2x) and desktop (1440x900 @ 2x) viewports | PASS | `vm/vm-server.js:28-29` — both viewport configs with `deviceScaleFactor: 2` |
| `pendingImages` tracks images per `/command` | PASS | Reset on entry (line 63), appended by `/screenshot` (line 203), drained on exit (lines 149-150) and timeout (lines 127-128) |
| `GET /images/:filename` on VM with path traversal protection | PASS | `vm/vm-server.js:162-170` — `path.resolve` + `startsWith` check |
| `GET /images/:filename` proxy on relay | PASS | `server.js:57-81` — strict UUID regex, proxies from VM, 5-min cache header |
| Relay sends MMS via Twilio `mediaUrl` | PASS | `server.js:147-149` constructs URLs, `sendMessage` (line 223) passes `mediaUrl` to Twilio API |
| `vm/CLAUDE.md` documents `/screenshot` endpoint | PASS | 37-line file with usage, params, response format, "When to Use" guidance |
| Static test app on port 8080 | PASS | `vm/test-app/index.html` (44 LOC), served conditionally via `ENABLE_TEST_APP` env var |
| TTL-based image cleanup (30-min, 100-file cap) | PASS | `vm/vm-server.js:222-255` — 30-min TTL, 5-min interval, 100-file cap with oldest-first eviction |
| JPEG compression < 600KB target | PASS | Quality 75 → fallback 50 if > 600KB (`vm/vm-server.js:195-200`) |
| Backward compatibility (text-only commands) | PASS | `images` defaults to empty array; `sendMessage` only adds `mediaUrl` when array non-empty |
| ARCHITECTURE.md updated | PASS | Screenshot pipeline data flow documented, `/screenshot` endpoint listed |
| SECURITY.md updated | PASS | Public image proxy, UUID-based access, Playwright URL navigation risks documented |
| Dockerfile copies CLAUDE.md and test-app | PASS | `vm/Dockerfile:41-42` — `COPY CLAUDE.md`, `COPY test-app/` |

### Code Quality

Implementation is clean and well-structured. Key patterns from institutional knowledge (path traversal protection, non-root user, process group management) are correctly applied. Defense-in-depth: relay uses strict UUID regex validation while VM uses `path.resolve` + `startsWith` — both independently prevent traversal. Logging follows established `[PREFIX]` conventions throughout.

The compression strategy was simplified from the plan's iterative loop (80→70→60→50 + DPR fallback) to a 2-step approach (75→50). This is a reasonable simplification for alpha — the iterative loop can be added if real-world screenshots exceed thresholds.

### Issues Found

- None blocking.

### Tech Debt

- **Stale "Playwright MCP" references:** Phase 4d task claims stale references were addressed, but "Playwright MCP" / `.mcp.json` still appears in 20+ files (`PRD_SMS_AGENTIC_COCKPIT.md`, `PHASE_PLAN_SMS_AGENTIC_COCKPIT.md`, `00-overview.md`, `02-phase-docker.md`, `07-phase-deploy.md`, `12-phase-conversational-nav.md`, `14-phase-cicd.md`, etc.). Only the phase 4 doc itself was cleaned up. Not a functional issue but accumulates documentation drift.
- **No hard 1MB ceiling enforcement:** If quality-50 JPEG exceeds 1MB, it passes through. Twilio may reject it. Low risk for typical web pages but worth adding the DPR fallback before production (Phase 7).
- **Images lost on non-zero exit:** When Claude Code exits with error, `pendingImages` are not included in the error response (`vm/vm-server.js:139-147`). Partial screenshots from failed commands are discarded. Acceptable for alpha.

### Next Steps

Phase complete. Next: Phase 5 (Diffs) — start with `/workflow:brainstorm` or `/workflow:plan`.
