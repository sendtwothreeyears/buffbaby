# Phase 3: Command

**Stage:** Local Development
**Depends on:** Phase 1 (Echo), Phase 2 (Docker)
**Done when:** You text "what is 2+2" to the Twilio number, Claude Code answers, you get the answer back as SMS.

## What You Build

Connect the relay server (Phase 1) to the Docker container (Phase 2). The relay receives an incoming SMS via Twilio webhook, forwards the message body to Claude Code's HTTP API inside the Docker container, and sends Claude Code's text response back as SMS via Twilio.

This is the core transport — SMS in, Claude Code processes, SMS out. The relay is a dumb pipe.

Deliverables:
- Relay server upgraded from echo to forwarding: receives SMS → POSTs to Docker container's `/command` endpoint → sends response as SMS
- **Async webhook pattern:** Relay responds to Twilio's inbound webhook immediately with `200 OK` (empty TwiML `<Response></Response>`). Claude Code command runs asynchronously. Response sent as a new outbound SMS via Twilio REST API. This is required because Claude Code takes longer than Twilio's 15-second webhook timeout.
- **Twilio webhook signature validation:** Verify that incoming requests are actually from Twilio using `twilio.validateRequest()`. Reject forged requests.
- Phone number authentication: only the allowed phone number from `.env` can send commands
- Error handling: connection refused, 500, timeout from Docker container → user receives a sensible error SMS ("Something went wrong. Try again in a moment.")
- Concurrency guard with per-user message queue (5-message cap): if the user sends a message while a command is processing, it queues and auto-processes after the current command
- `.env` updated with `CLAUDE_HOST=http://localhost:3001`
- `.env.example` with all required variables: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `ALLOWED_PHONE_NUMBERS`, `CLAUDE_HOST`
- Session resume: `--continue` flag on Claude Code for conversation continuity
- Idle shutdown: VM exits after 30 min idle, Docker `restart: unless-stopped` handles restart
- Response truncation at 1500 chars for SMS-friendly output

## Tasks

- [x] Relay forwards incoming SMS text to Claude Code HTTP API in Docker container and sends the response back via Twilio SMS
  - Plan: `docs/plans/2026-02-26-feat-connect-relay-to-vm-plan.md`
  - Ship: `/workflow:ship docs/plans/2026-02-26-feat-connect-relay-to-vm-plan.md`

## Notes

- **The async pattern is not optional.** Twilio gives 15 seconds for a webhook response. Claude Code takes longer for anything non-trivial. If you respond synchronously, Twilio will timeout and retry, causing duplicate messages. Respond immediately with `200 OK`, process async, send result via Twilio Messages API.
- The relay replaces the echo logic from Phase 1 — same server, upgraded behavior.
- The concurrency guard is a per-phone-number queue. If `busy`, queue the message (up to 5) and reply "Got it, I'll process this next." When Claude Code responds, dequeue and process next, or set idle. Queue full (6+) replies "Queue full, please wait."
- Claude Code may return long responses. SMS segments are 160 chars — Twilio handles concatenation, but consider truncating very long responses with a note. Full "Reply 'more'" support is deferred to Phase 16 (UX Polish).

## Review

**Status:** PASS
**Reviewed:** 2026-02-26

### Validation Results

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Text "what is 2+2", get answer back as SMS | PASS | Relay forwards to VM `/command`, Claude Code responds, relay sends SMS. User confirmed working via live test during ship. |
| Relay forwards SMS to VM `/command` | PASS | `server.js:191` — `fetch(CLAUDE_HOST/command)` with JSON body `{ text }` |
| Async webhook pattern (immediate 200 OK) | PASS | `server.js:100` — `res.sendStatus(200)` before any async processing |
| Twilio webhook signature validation | PASS | `server.js:84-86` — `twilio.webhook()` middleware on `/sms` route |
| Phone number allowlist | PASS | `server.js:94-97` — checks `allowlist.has(from)`, silently drops non-allowlisted |
| Error handling (connection refused, 500, timeout) | PASS | `server.js:163-171` — maps error codes to user-friendly SMS messages. Cold-start retry on ECONNREFUSED (`server.js:211-216`) |
| Per-user queue (5-message cap) | PASS | `server.js:42` — `Map<phone, {busy, queue[]}>`. Cap at 5 (`server.js:118`). "Got it, I'll process this next" on queue. "Queue full" at cap. |
| `.env.example` with CLAUDE_HOST | PASS | `.env.example:13` — `CLAUDE_HOST=http://localhost:3001` |
| Session resume (`--continue` flag) | PASS | `vm-server.js:69` — `spawn("claude", ["-p", "--continue", "--dangerously-skip-permissions", "-"])` |
| Idle shutdown (30 min) | PASS | `vm-server.js:281-286` — checks `lastActivity` every 60s, exits after `IDLE_TIMEOUT_MS` (default 1800000 = 30 min). `docker-compose.yml:9` — `restart: unless-stopped` |
| Response truncation at 1500 chars | PASS | `server.js:153-155` — truncates with `[Response truncated]` suffix |

### Code Quality

- **Relay (`server.js`):** Clean async pattern. Per-user state via Map. Safety net clears busy flag on unhandled errors (`server.js:130-134`). Logging follows established prefix conventions.
- **VM (`vm-server.js`):** `spawn` with `detached: true` + process group killing. `lastActivity` updated on both command start and completion. Prompt piped via stdin (avoids `ARG_MAX`).
- **Cold-start retry:** Single retry after 4s on `ECONNREFUSED` — handles Docker container cold starts gracefully.
- **Concurrency:** Synchronous `state.busy = true` before any `await` prevents race conditions on the relay side. VM has its own `busy` boolean mutex returning 409.
- **Learnings applied:** Webhook parsing uses `express.urlencoded()` (not JSON). Non-root user. Process group management. All confirmed from `docs/solutions/`.

### Issues Found

None. All deliverables implemented correctly. Code matches the plan.

### Tech Debt

- **In-memory queue state** — relay queue is lost on restart. Queued messages and busy flags reset. Acceptable for alpha; production needs persistence or at minimum logging of dropped messages.
- **Hardcoded relay timeout** (`RELAY_TIMEOUT_MS = 330_000`) — derived from VM's `COMMAND_TIMEOUT_MS` (300s + 30s buffer) but not dynamically linked. If VM timeout changes, relay timeout must be manually updated.
- **No plan file on main** — `docs/plans/2026-02-26-feat-connect-relay-to-vm-plan.md` referenced in tasks but wasn't committed (likely in the untracked files on the feature branch).

### Next Steps

Phase complete. Next: **Phase 4 — Screenshots** (`04-phase-screenshots.md`).
