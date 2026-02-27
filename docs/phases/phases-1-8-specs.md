---
phases: 1-8
condensed: true
originals: archive/phases/
---

# Phases 1–8: Completed Phase Specs (TextSlash Era)

All completed phase specifications for the WhatsApp Agentic Development Cockpit (TextSlash). Phases 1-8 validated the core architecture: relay → VM → Claude Code → WhatsApp.

Phases 9-16 were scrapped on 2026-02-27 when the project pivoted to BuffBaby (multi-channel, multi-agent, open-source). See `docs/PRD_BUFFBABY.md` for the new direction.

---

## Phase 1: Echo — PASS

**Stage:** Local Development | **Depends on:** Nothing | **Done when:** Text the Twilio number, get your message echoed back with a test image via WhatsApp.

Minimal single-file Express server (`server.js`, 64 LOC) that receives WhatsApp via Twilio webhook, echoes the body, and sends a static test image. Phone allowlist from `.env` (comma-separated E.164). Silent drop for non-allowlisted. No webhook signature validation (deferred to Phase 3). ngrok for local tunneling. Throwaway code replaced in Phase 3. Deliverables: `server.js`, `package.json`, `.env.example`, `assets/test-image.png`. No issues found during review.

## Phase 2: Docker — PASS

**Stage:** Local Development | **Depends on:** Nothing (parallel with Phase 1) | **Done when:** `docker run` starts container, `curl POST /command` returns Claude Code output.

Docker image with Claude Code CLI, Playwright, Node.js, git, Chromium. Single-file Express server (`vm-server.js`, 157 LOC) with `POST /command`, `GET /health`, `GET /images/:filename`. `child_process.spawn` (not exec) to avoid shell injection. Boolean mutex concurrency guard (409 if busy). 5-min timeout with process group kill. Path traversal protection. Fail-fast on missing `ANTHROPIC_API_KEY`. Non-root `appuser` required — Claude Code refuses `--dangerously-skip-permissions` under root. Prompt piped via stdin to avoid `ARG_MAX`. 10MB stdout/stderr buffer caps. `.mcp.json` removed (Playwright used via Node.js API, not MCP).

## Phase 3: Command — PASS

**Stage:** Local Development | **Depends on:** Phases 1, 2 | **Done when:** Text "what is 2+2", get Claude Code's answer back via WhatsApp.

Relay forwards WhatsApp to VM `/command`, returns response as WhatsApp message. Async webhook pattern: immediate 200 OK, process in background, send via Twilio REST API (Twilio gives only 15s). Twilio webhook signature validation via `twilio.webhook()`. Per-user message queue (Map, up to 5). `--continue` flag for session resume. Idle shutdown after 30min (`IDLE_TIMEOUT_MS`), Docker `restart: unless-stopped`. Cold-start retry (4s wait, retry once on ECONNREFUSED). Response truncation at 4096 chars. AbortController fetch timeout 330s (VM's 300s + 30s buffer). In-memory queue state lost on relay restart (acceptable for alpha).

## Phase 4: Screenshots — PASS

**Stage:** Local Development | **Depends on:** Phase 3 | **Done when:** Text "show me the app", receive screenshot on phone via WhatsApp.

`POST /screenshot` VM endpoint with Playwright capture. Mobile viewport 390x844 @ 2x DPR (default), desktop 1440x900 available. Iterative JPEG compression: quality 75 → 50, targeting <600KB. Browser launched per-request (~1-2s). `pendingImages` array tracks screenshots per `/command`, drained into response on all exit paths (success, error, timeout). UUID filenames for security. Relay pipes VM image response directly to Twilio (no disk write). Relay `GET /images/:filename` proxy with strict UUID.jpeg regex. `vm/CLAUDE.md` teaches Claude Code about `/screenshot`. Static test app (`vm/test-app/index.html`) on port 8080. TTL cleanup: 30-min expiry, 5-min interval, 100-file cap. P1 fixed during review: error path wasn't draining `pendingImages`.

## Phase 4.1: Web Chat — PASS

**Stage:** Local Development | **Depends on:** Phase 4 | **Done when:** Open relay URL in phone browser, send message, see response with screenshots inline.

Browser-based chat UI bypassing Twilio — dev tool for testing without WhatsApp Sandbox. `POST /chat` JSON API calling same `forwardToVM()` as WhatsApp. `GET /` serves `public/index.html` — single 310-line HTML file with inline CSS/JS. No queuing (UI disables send while in-flight). No text truncation (no 4096-char limit). No auth (dev-only). `express.json()` middleware added (safe alongside `express.urlencoded()`). XSS-safe: user content via `textContent`, no `innerHTML` with user input. Smart auto-scroll, elapsed-time counter, dark theme. Tech debt: `GET /` will conflict with landing page — gate behind env var before production.

## Phase 4.2: WhatsApp Channel + Pivot — PASS

**Stage:** Local Development | **Depends on:** Phase 4.1 | **Done when:** WhatsApp message to Twilio Sandbox returns Claude Code response. SMS code fully removed.

Two sub-phases. First: added WhatsApp via Twilio Sandbox (~20 lines). `whatsapp:` prefix stripped for allowlist check, raw `From` (with prefix) used for state keying. Second: pivoted to WhatsApp-only — removed SMS paths, renamed `/sms` → `/webhook`, made `TWILIO_WHATSAPP_NUMBER` required, bumped truncation from 1500 → 4096 chars. `sendMessage()` handles 1-media-per-message WhatsApp constraint (first image with text, remaining as separate messages). Documentation sweep across 26+ files eliminated SMS/MMS terminology. PRD renamed to `PRD_WHATSAPP_AGENTIC_COCKPIT.md`. VM completely unchanged — transport-agnostic by design. 24-hour session window documented as known limitation.

## Phase 5: Diffs — PASS

**Stage:** Local Development | **Depends on:** Phase 4 | **Done when:** Command that changes code → monospace text diff in WhatsApp.

Text-only diffs (PNG rendering deferred to Phase 5b/16). `collectDiffs()` in VM runs `git diff HEAD --no-color` after every `/command` — 2s timeout, 512KB buffer cap. Returns `diffs` + `diffSummary` on all exit paths (success, error, timeout). Relay `formatDiffMessage()` wraps in triple-backtick code blocks. `truncateAtFileBoundary()` splits on `diff --git` headers — no mid-hunk cuts. Budget-aware: inline when fits, follow-up message on overflow, summary stats appended. Visual separator `--- Changes ---`. `busy` flag cleared in `finally` block after `res.json()` to prevent race condition. Zero new dependencies.

## Phase 6: End-to-End Local — PASS

**Stage:** Local Development | **Depends on:** Phases 3, 4, 5 | **Done when:** Full loop from phone — command, progress updates, diffs/screenshots, approve → PR created.

Demo milestone. Two deliverables: (1) Progress streaming — VM line-buffered stdout parser for `::progress::` and `::approval::` markers, `postCallback()` POSTs to relay `/callback/:phone`, relay forwards as WhatsApp messages. `pendingCallbacks` drained via `Promise.allSettled` before response. (2) Approval flow — state machine replaces `busy` boolean: `idle → working → awaiting_approval → idle`. `handleApprove()` POSTs to VM `/approve`, VM runs Claude Code to commit + create PR. `handleReject()` runs `git checkout . && git clean -fd`. `handleCancelWorking()` uses AbortController + process group SIGTERM. 30-min approval timeout. Relay 514 LOC, VM 457 LOC. P1 fixed: Playwright Chromium user mismatch — Dockerfile ran `npx playwright install chromium` as root but app runs as `appuser`.

## Phase 7: Deploy — PASS

**Stage:** Production | **Depends on:** Phase 6 | **Done when:** Close laptop, send WhatsApp message, get response.

Two Fly.io Machines: always-on relay (~$3-5/mo, 512MB) + auto-stop VM with Volume (~$4-7/mo active, 2GB RAM). Flycast private networking (not `.internal` — Flycast routes through Fly Proxy for auto-start). `http://textslash-vm.flycast` on port 80 (Fly Proxy maps to internal_port). VM private-only (public IPs released). Fly Volume at `/data` for persistent screenshots. `IMAGES_DIR` env var configurable. Cold-start UX: health-check polling every 3s for 30s, "Waking up..." message (not triggered in practice — Flycast auto-start ~1.2s is transparent). SIGTERM graceful shutdown. Message chunking at 1600 chars (WhatsApp sandbox limit, stricter than 4096). P1 fixed: `fly deploy` created 2 machines by default — `fly scale count 1` for stateful single-machine. P2 fixed: `/data/images` missing after Volume mount overlay — `mkdirSync` on startup.

## Phase 8: Provisioning — PASS

**Stage:** Production | **Depends on:** Phase 7 | **Done when:** User clones repo, runs `scripts/setup.sh`, gets working relay + VM on their own Fly.io account.

CLI-first self-hosted provisioning (phone-only wizard deferred). Interactive `scripts/setup.sh`: prerequisite checks, credential collection, app creation, volume creation, secret setting via `fly secrets set`, build from local Dockerfiles via `fly deploy --dockerfile`, `--ha=false` + `fly scale count 1`, health polling. `scripts/teardown.sh` for clean removal. Template configs `deploy/relay.fly.toml` and `deploy/vm.fly.toml`. Flycast networking: `CLAUDE_HOST=http://{prefix}-vm.flycast`, `RELAY_CALLBACK_URL=http://{prefix}-relay.flycast` — both port 80. README self-hosting section with prerequisites, quick start, cost estimate (~$7-12/mo). P1 fixed during review: `RELAY_CALLBACK_URL` had `:3000` (would cause ECONNRESET). Simplified post-review: removed GHCR dependency — users build from their own Dockerfiles.



---

_Phases 9-16 removed on 2026-02-27 (project pivoted to BuffBaby). Original specs archived in `archive/phases/`._
