---
date: 2026-02-26
topic: nanoclaw-learnings
phase: 3+
---

# NanoClaw Learnings: What to Adopt

## What We're Building

Three features inspired by [NanoClaw](https://github.com/qwibitai/nanoclaw) (an open-source messaging→container→Claude agent project), incorporated into Phase 3 and beyond. These improve the WhatsApp experience without detracting from the MVP.

**MVP features (Phase 3+):**

1. **Session resume** — Claude remembers previous messages across invocations
2. **Relay-side message queue** — users can text while Claude is busy; messages process in order
3. **Container idle shutdown** — VM shuts down after inactivity to save costs

**Deferred (post-MVP):**

4. **Scheduled tasks** — cron/interval jobs ("text me a standup every morning at 9am")
5. **Mid-execution injection** — follow-up messages fed into Claude while it's still thinking
6. **Explicit session IDs** — multiple conversations per user, needed for multi-project support

## Why This Approach

### NanoClaw Comparison

NanoClaw validates that the messaging→container→Claude pattern works at scale (v1.1.3, 15k stars, 26 days old). It uses the Claude Agent SDK directly; we use the Claude Code CLI. Different tradeoff: they get more control, we get the full Claude Code ecosystem (skills, CLAUDE.md, MCP servers) for free.

Four areas where NanoClaw is more mature than our current implementation:

| Area | NanoClaw | Us (today) | Us (after this brainstorm) |
|------|----------|------------|---------------------------|
| Session continuity | SQLite + explicit session IDs | None (stateless one-shot) | `--continue` flag (MVP) |
| Message queuing | Filesystem IPC + MessageStream | 409 rejection when busy | Relay-side in-memory queue |
| Container lifecycle | Spawn-on-demand + 30min idle timeout | Always-on via Docker Compose | Idle shutdown timer |
| Scheduled tasks | SQLite + cron-parser + task scheduler | None | Deferred to post-MVP |

### Why These Three for MVP

- **Session resume** — Without it, every message is like talking to a stranger. Claude has no idea what you said in your last text. The experience feels broken.
- **Relay-side queue** — Users will inevitably text while Claude is busy. Returning "busy, try again" is a terrible UX. Queuing is the minimum viable behavior.
- **Idle shutdown** — Always-on VMs cost $5/month per user whether they're active or not. Idle shutdown is a cost-efficiency feature that should be baked in from the start, not bolted on later.

### Why Not the Others

- **Scheduled tasks** — Cool feature, but interactive messaging must work first. Add it when the core loop is solid.
- **Mid-execution injection** — Best UX but requires changing how we invoke Claude Code (can't use simple `claude -p` anymore). Sequential processing is good enough for MVP.
- **Explicit session IDs** — Only needed for multi-project support. One VM = one conversation works for MVP.

## Key Decisions

### 1. Session Resume: `--continue` Flag

Use Claude Code CLI's `--continue` flag, which automatically resumes the most recent conversation on the VM.

- **Why not `--resume <id>`:** One VM per user means one conversation. No ambiguity about which session to resume. Zero tracking code needed.
- **Upgrade path:** When multi-project support is added, switch to `--resume <id>` with session IDs stored in SQLite (NanoClaw's pattern).
- **Implementation:** Change `claude -p` to `claude -p --continue` in `vm-server.js`. That's it for MVP.

### 2. Message Queue: Relay-Side, In-Memory

The relay holds a per-user queue of incoming messages. When the VM finishes a command, the relay sends the next queued message.

- **Why relay-side:** Keeps the VM simple (no changes to vm-server.js). The relay already knows about per-user routing — adding a queue is natural.
- **Why not VM-side:** Would require the VM to accept messages while busy (new endpoint or queue mechanism). More VM complexity for the same result.
- **Why not mid-execution injection:** Requires replacing `claude -p` with a persistent process and IPC layer. Too complex for MVP.
- **Behavior:** User texts while Claude is busy → relay queues it → relay sends "Got it, I'll process this next" → Claude finishes → relay sends queued message → Claude processes it.
- **Upgrade path:** Mid-execution injection (NanoClaw's MessageStream pattern) can be added later by switching the VM from one-shot `claude -p` to a persistent Claude Code process with stdin IPC.

### 3. Container Idle Shutdown: Timer-Based

VM shuts itself down after N minutes of no incoming commands.

- **How NanoClaw does it:** Host writes a `_close` sentinel file to the container's IPC directory. Container detects it and exits. 30-minute default.
- **Our approach:** Simpler — the VM server tracks the timestamp of the last command. A periodic check (setInterval) compares against an idle threshold. When exceeded, the process exits gracefully. Docker's restart policy or Fly.io's auto-restart handles the "wake up on next request" behavior.
- **Local dev:** Timer runs but Docker Compose's `restart: unless-stopped` brings it back immediately. Effectively always-on during development.
- **Production (Fly.io):** Fly.io Machines support auto-stop and auto-start. The VM exits on idle, Fly.io stops the machine. Next HTTP request from the relay auto-starts it. Small cold start (~2-5 seconds) which is acceptable for WhatsApp (users won't notice a few extra seconds).
- **Default timeout:** 30 minutes (same as NanoClaw). Configurable via `IDLE_TIMEOUT_MS` env var.

## Where These Fit in the Phase Plan

These features weave into existing phases rather than creating new ones:

| Feature | Phase | How It Integrates |
|---------|-------|-------------------|
| Session resume (`--continue`) | Phase 3 (Command) | One-line change to `claude -p` invocation |
| Relay-side message queue | Phase 3 (Command) | Part of the relay→VM forwarding logic. Natural place to add queuing. |
| Container idle shutdown | Phase 3 (Command) | Add timer to vm-server.js. Configure Docker Compose restart policy. |

All three are Phase 3 additions because Phase 3 is where the relay and VM first connect. That's when these behaviors matter.

## Prior Learnings (from Phase 1-2 Compounds)

Two past solutions in `docs/solutions/` are relevant to this work:

- **Docker VM + Claude Code Headless Setup** (`docs/solutions/developer-experience/docker-vm-claude-code-headless-setup-20260225.md`) — Process group management (`detached: true` + `process.kill(-child.pid)`), graceful SIGTERM handling, output buffer caps (10MB). Directly relevant to **idle shutdown**: the VM already has a SIGTERM handler; idle shutdown needs to trigger a clean exit that follows the same pattern. Also: non-root user requirement for `--dangerously-skip-permissions`.
- **WhatsApp Echo Server with Twilio/ngrok Setup** (`docs/solutions/developer-experience/sms-echo-server-twilio-ngrok-setup-20260225.md`) — Webhook parsing (`application/x-www-form-urlencoded`), phone allowlist as Set, WhatsApp media serving. Directly relevant to **relay-side queue**: the relay already parses incoming messages and routes by phone number; the queue is a natural extension of that routing logic.

_Note: Phase 2 compound is still in progress. Additional learnings may surface and should be incorporated during `/workflow:plan`._

## Open Questions

_None — all questions resolved during brainstorm dialogue._

## Deferred Features (Post-MVP)

### Scheduled Tasks

NanoClaw's implementation: SQLite table (`scheduled_tasks`) with cron/interval/one-time support, a 60-second poll loop, tasks share the container concurrency pool, results sent back via messaging channel. A separate `task_run_logs` table records execution history.

**When to add:** After Phase 6 (end-to-end local flow is working). Scheduled tasks need session resume and message delivery to be solid first.

**Implementation sketch:** Add a scheduler to the relay (not the VM) that fires WhatsApp-formatted commands at configured intervals. The relay already handles message routing — scheduling is just "send this message at this time." Store schedules in SQLite or a JSON file.

### Mid-Execution Injection

NanoClaw's implementation: Filesystem IPC with atomic writes, a `MessageStream` async iterable that bridges polling with the Claude SDK's async iterator, messages injected during active `query()` calls.

**When to add:** After MVP, when users report wanting to course-correct mid-task.

**Implementation sketch:** Replace one-shot `claude -p` with a persistent Claude Code process (using `--continue` in interactive mode). VM accepts messages via a new endpoint and writes them to stdin. Requires significant vm-server.js rewrite.

### Explicit Session IDs

NanoClaw's implementation: SQLite `sessions` table (1:1 group→session mapping), session IDs flow from container to host via stdout markers, passed to next container via stdin JSON. `resumeAt` (last assistant UUID) enables efficient multi-turn within a container.

**When to add:** When multi-project support is added (Phase 10+ in current plan).

**Implementation sketch:** Replace `--continue` with `--resume <id>`. Store session IDs per user per project in the relay's database. Route messages to the correct session based on active project context.

## Next Steps

> `/workflow:plan` for Phase 3 implementation details, incorporating these three features alongside the existing Phase 3 scope (relay→VM connection).
