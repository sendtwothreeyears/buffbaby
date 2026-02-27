---
date: 2026-02-26
topic: phase-3-command
phase: 3
---

# Phase 3: Command — Expanded Scope

## What We're Building

Phase 3 connects the relay to the VM — the core transport. This brainstorm expands the original Phase 3 plan with three NanoClaw-inspired features and incorporates learnings from Phase 1-2 compounds.

**Original Phase 3 scope:**
- Relay forwards WhatsApp message to Claude Code via HTTP, returns response as WhatsApp message
- Async webhook pattern (immediate 200 OK, process in background)
- Twilio webhook signature validation
- Concurrency guard (upgraded to message queue — see below)

**New additions (from NanoClaw brainstorm):**
- Session resume (`--continue` flag) — Claude remembers previous messages
- Relay-side message queue — users can text while Claude is busy, messages process in order
- Container idle shutdown — VM exits after 30 min idle to save costs

## Why This Approach

### Building on Phase 1-2 Learnings

The research agents surfaced critical patterns from prior compounds that directly inform Phase 3:

**From Docker VM compound:**
- Non-root user requirement for `--dangerously-skip-permissions` (already in Dockerfile)
- Process group management: `detached: true` + `process.kill(-child.pid)` (already in vm-server.js)
- SIGTERM handler for graceful shutdown (already in vm-server.js)
- Output buffer cap at 10MB (already in vm-server.js)
- Idle shutdown should verify `!busy` before exiting — don't kill mid-command

**From WhatsApp Echo Server compound:**
- Webhook parsing: Twilio sends `application/x-www-form-urlencoded`, not JSON (already handled in server.js)
- Phone allowlist in E.164 format (already in server.js)
- Webhook signature validation deferred from Phase 1, explicitly planned for Phase 3
- Logging prefixes: `[INBOUND]`, `[BLOCKED]`, `[ERROR]`, `[OUTBOUND]` — extend with `[FORWARD]`, `[RESPONSE]`, `[QUEUED]`, `[IDLE]`
- ngrok URL instability: must update `.env` AND Twilio console on restart

**From Docker Compose compound:**
- `mem_limit` (not `deploy.resources.limits.memory`) for standalone Docker Compose
- Verify with `docker inspect` after changes

### NanoClaw-Inspired Additions

These three features are documented in detail in `docs/brainstorms/2026-02-26-nanoclaw-learnings-brainstorm.md`. Summary of decisions:

| Feature | Approach | Complexity |
|---------|----------|------------|
| Session resume | `--continue` flag on `claude -p` invocation | One-line change to vm-server.js |
| Message queue | Relay-side in-memory `Map<phone, { busy, queue[] }>` | ~30 lines in server.js |
| Idle shutdown | `setInterval` timer in vm-server.js, `process.exit(0)` when idle | ~15 lines in vm-server.js |

### Concurrency Guard → Message Queue (Upgrade)

The original Phase 3 plan specifies a concurrency guard that rejects messages while busy ("I'm still working on your last request."). The NanoClaw brainstorm upgrades this to a **queue** — instead of rejecting, the relay acknowledges ("Got it, I'll process this next") and processes queued messages after the current command finishes.

This is a natural evolution of the same per-phone-number state tracking. The `busy` flag becomes a `{ busy: boolean, queue: string[] }` object.

## Key Decisions

### 1. Relay is the primary work target

The relay goes from 68 LOC echo server to ~150-200 LOC forwarding + queue server. The VM changes are surgical (~15-30 lines added). Docker Compose needs no changes — networking already works.

### 2. Async webhook pattern is non-negotiable

Twilio gives 15 seconds for webhook response. Claude Code takes longer. Respond immediately with `200 OK` (empty TwiML), process async, send result via Twilio REST API. This is the same pattern as Phase 1 but the outbound message contains Claude's response instead of an echo.

### 3. Acknowledge queued messages

When the user texts while Claude is busy, reply "Got it, I'll process this next." Don't silently queue — the user needs to know their message wasn't lost.

### 4. Session resume uses `--continue`

One-line change: add `--continue` to the `claude` spawn args. First invocation (no prior conversation) is a no-op. Upgrade to `--resume <id>` when multi-project is added. **Verify during implementation** that `--continue` works in combination with `-p` (piped/prompt mode) — if not, fall back to `--resume` with session ID tracking.

### 5. Idle shutdown checks `!busy` before exiting

The idle timer should not fire while a command is running. Check `!busy` before calling `process.exit(0)`. Docker Compose's `restart: unless-stopped` handles automatic restart in local dev. Fly.io's auto-start handles it in production.

### 6. Relay retries once on VM connection failure

Idle shutdown and the message queue interact: the VM may shut down between processing two queued messages. The relay sends the next queued message and hits a dead container. Fix: relay retries once after a connection error with a short delay (e.g., 3-5 seconds) to allow Docker Compose / Fly.io to restart the container. If the retry also fails, send an error message. This covers the cold-start window without adding a health-check polling loop.

### 7. In-memory queue is acceptable for MVP

Messages queued in the relay's memory are lost on relay restart. This is fine — the relay is lightweight and rarely restarts. Persistent queue (SQLite) can be added if needed. Cap queue depth at 5 messages per user — reply "Queue full, please wait for current tasks to finish" beyond that.

### 8. Node 22 native `fetch` for HTTP client

No new dependency needed. Node 22 has global `fetch`. The relay uses it to `POST` to `CLAUDE_HOST/command`.

### 9. New env vars

| Var | Component | Default | Purpose |
|-----|-----------|---------|---------|
| `CLAUDE_HOST` | Relay | `http://localhost:3001` | VM URL |
| `IDLE_TIMEOUT_MS` | VM | `1800000` (30 min) | Idle shutdown threshold |

### 10. Logging extensions

Add to existing prefix convention:
- `[FORWARD]` — request sent to VM
- `[RESPONSE]` — response received from VM
- `[QUEUED]` — message queued (user texted while busy)
- `[DEQUEUED]` — queued message sent to VM
- `[IDLE]` — idle shutdown triggered

## Open Questions

_None — all questions resolved during brainstorm dialogue._

## Next Steps

> Update `docs/plans/phases/03-phase-command.md` directly via `/workflow:plan` to incorporate these additions into the existing Phase 3 plan.
>
> Note: The existing Phase 3 plan has `CLAUDE_HOST=http://localhost:3000` — this should be corrected to `http://localhost:3001` (vm-server.js port) during the plan update.
