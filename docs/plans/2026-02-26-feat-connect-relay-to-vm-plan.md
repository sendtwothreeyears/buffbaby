---
title: "feat: Connect WhatsApp Relay to Cloud VM with Message Queue"
type: feat
status: completed
date: 2026-02-26
phase: 3
brainstorm: docs/brainstorms/2026-02-26-phase-3-command-brainstorm.md
---

# feat: Connect WhatsApp Relay to Cloud VM with Message Queue

## Overview

Phase 3 connects the relay server to the Cloud VM — the core transport. The relay receives WhatsApp messages via Twilio webhook, forwards the message to Claude Code's HTTP API in the Docker container, and returns Claude's response as a WhatsApp message. This replaces the Phase 1 echo logic with real Claude Code interaction.

Three additions inspired by NanoClaw (a prior WhatsApp-based CLI project — see brainstorm for details) expand the original scope: session resume (`--continue` flag), relay-side message queue, and container idle shutdown.

**Done when:** You text "what is 2+2" to the Twilio WhatsApp number, Claude Code answers, and you get the answer back as a WhatsApp message.

## Problem Statement / Motivation

After Phase 1 (echo server) and Phase 2 (Docker VM), the two components exist independently. The relay echoes WhatsApp messages, the VM runs Claude Code via HTTP — but they don't talk to each other. Phase 3 closes the gap.

Additionally:
- The relay has **no webhook signature validation** — anyone who knows the URL can forge requests and exhaust the Anthropic API key (P0 security gap)
- The VM has **no session continuity** — each command starts a fresh conversation
- The VM runs 24/7 even when idle — wasteful for cloud deployment

## Proposed Solution

### Core Transport (server.js)

Replace the echo handler with an async forwarding pipeline:

1. Twilio POSTs webhook → relay validates signature → checks allowlist → responds `200 OK` immediately
2. Relay POSTs `{ text: messageBody }` to `CLAUDE_HOST/command` via native `fetch`
3. On VM response, relay sends Claude's text as outbound WhatsApp message via Twilio REST API

### Webhook Signature Validation (server.js)

Add `twilio.webhook()` Express middleware on the `/sms` route. Must configure the `url` option with `PUBLIC_URL + '/sms'` to handle the ngrok proxy — Express sees `localhost:3000` but Twilio signs against the ngrok URL.

### Message Queue (server.js, ~30 LOC)

Upgrade the concurrency guard from "reject when busy" to "queue when busy":
- Per-user state: `Map<phone, { busy: boolean, queue: string[] }>`
- When idle: set busy, forward to VM
- When busy: queue message (up to 5), reply "Got it, I'll process this next"
- On response: check queue, dequeue and process next, or set idle
- Queue full (6+): reply "Queue full, please wait for current tasks to finish"

### Session Resume (vm-server.js, 1-line change)

Add `--continue` to Claude Code spawn args. First invocation (no prior conversation) is a no-op. Must verify `--continue` works with `-p` (piped mode) during implementation — if it doesn't, omit it and defer session resume to Phase 10.

### Idle Shutdown (vm-server.js, ~15 LOC)

Track `lastActivity` timestamp, updated on each `/command`. `setInterval` checks: if `Date.now() - lastActivity > IDLE_TIMEOUT_MS` and `!busy`, call `process.exit(0)`. Docker Compose `restart: unless-stopped` auto-restarts.

## Technical Considerations

### Relay-Side Fetch Timeout

Node 22's native `fetch` has no default timeout. The relay must use `AbortController` with a timeout slightly longer than `COMMAND_TIMEOUT_MS` (e.g., 330 seconds vs VM's 300 seconds) to prevent indefinite hangs:

```javascript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 330_000);
try {
  const res = await fetch(url, { signal: controller.signal, ... });
} finally {
  clearTimeout(timeout);
}
```

### VM Error Response Mapping

The VM returns different HTTP status codes. The relay must map each to a user-friendly WhatsApp message:

| VM Response | User Message |
|-------------|----------|
| `200 OK` | Send `response.text` (Claude's answer) |
| `400 Bad Request` | "I couldn't process that message. Try rephrasing." |
| `408 Timeout` | "That took too long. Try a simpler request." |
| `409 Busy` | Should not happen (relay-side queue prevents), but defensive: requeue |
| `500 Error` | "Something went wrong. Try again in a moment." |
| `ECONNREFUSED` | Trigger cold-start retry (once), then error message |
| Fetch abort (timeout) | "Claude is taking too long. Try again." |

**Critical:** Never forward raw VM error details (stack traces, file paths) to the user — log them server-side only.

### Response Truncation

Claude can produce multi-kilobyte responses. WhatsApp supports up to 4096 chars per message. Truncate at **1500 chars** with suffix: `\n\n[Response truncated]`

Full pagination (`Reply 'more'`) is deferred to Phase 16 (UX Polish).

### Cold-Start Retry

The idle shutdown and message queue interact: the VM may shut down between processing two queued messages. On `ECONNREFUSED`:

1. Wait 4 seconds (container restarting)
2. Retry once
3. If retry also fails, send error message and clear the user's queue

### Twilio Webhook Validation Behind ngrok

The `twilio.webhook()` middleware validates using the request URL. Behind ngrok, Express sees `http://localhost:3000/sms` but Twilio signed against `https://abc123.ngrok.io/sms`. Fix: pass `{ url: process.env.PUBLIC_URL + '/sms' }` to the middleware.

### Inbound Media / Empty Messages

- **Empty/whitespace body:** Check before forwarding. Reply "I received an empty message."
- **WhatsApp media (images):** Phase 3 is text-only. If `NumMedia > 0`, reply "I can only process text messages for now." Log the media URLs for future reference.

### Busy Flag Atomicity

JavaScript's single-threaded event loop makes the check-then-set safe **only if no `await` occurs between check and set**. The implementation must set `busy = true` synchronously before the first `await` (see MVP code, `state.busy = true` line before `await processCommand`).

### Forward Compatibility

The VM response shape already includes `images[]` — relay ignores it for now, no refactoring needed when Phase 4 adds image handling.

## Acceptance Criteria

### Functional

- [x] Text "what is 2+2" → receive Claude's answer as WhatsApp message
- [x] Text while Claude is busy → receive "Got it, I'll process this next" and message processes after current command
- [x] Send 6th message while busy → receive "Queue full" message
- [x] Forged HTTP POST to `/sms` (no valid Twilio signature) → rejected with 403
- [x] VM returns 408 timeout → user receives friendly error message
- [x] VM is down (idle shutdown) → relay retries once after delay, user gets response or error
- [x] VM idle for 30 min → container exits, Docker restarts it on next request
- [x] Claude remembers previous messages within a session (`--continue`)
- [x] Empty message body → user receives "I received an empty message"
- [x] Long Claude response (>1500 chars) → truncated with `[Response truncated]`

### Non-Functional

- [x] Relay responds `200 OK` to Twilio within 1 second (before any VM processing)
- [x] No new npm dependencies (uses Node 22 native `fetch`)
- [x] All errors logged server-side with prefixes; no internal details leaked to user
- [x] `.env.example` and `vm/.env.example` updated with new variables

## MVP

### server.js

```javascript
// New imports: none (native fetch, existing twilio SDK)
import "dotenv/config";
import express from "express";
import twilio from "twilio";

// --- Env vars (add CLAUDE_HOST) ---
const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER,
        PUBLIC_URL, ALLOWED_PHONE_NUMBERS, CLAUDE_HOST = "http://localhost:3001",
        PORT = 3000 } = process.env;

// --- Fail-fast validation (add CLAUDE_HOST) ---

// --- Twilio client + Express app (unchanged) ---
const allowedNumbers = new Set(ALLOWED_PHONE_NUMBERS.split(",").map(n => n.trim()));
const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
const app = express();
app.use(express.urlencoded({ extended: false }));

// --- Per-user state ---
const userState = new Map(); // Map<phone, { busy: boolean, queue: string[] }>

function getState(phone) {
  if (!userState.has(phone)) {
    userState.set(phone, { busy: false, queue: [] });
  }
  return userState.get(phone);
}

// --- Twilio webhook signature validation ---
const webhookValidator = twilio.webhook(TWILIO_AUTH_TOKEN, {
  url: PUBLIC_URL + "/sms",
});

// --- Health endpoint (unchanged) ---
app.get("/health", (req, res) => res.json({ status: "ok", service: "textslash-relay" }));

// --- Core message handler ---
app.post("/sms", webhookValidator, async (req, res) => {
  const from = req.body.From;
  const body = (req.body.Body || "").trim();

  // Phone allowlist
  if (!allowedNumbers.has(from)) {
    console.log(`[BLOCKED] ${from}`);
    return res.sendStatus(200);
  }

  // Immediate 200 OK — async pattern
  res.sendStatus(200);

  console.log(`[INBOUND] ${from}: ${body.substring(0, 80)}`);

  // Empty message check
  if (!body) {
    return sendMessage(from, "I received an empty message.");
  }

  // Media check (text-only for Phase 3)
  if (parseInt(req.body.NumMedia || "0", 10) > 0) {
    return sendMessage(from, "I can only process text messages for now.");
  }

  // Queue or forward
  const state = getState(from);
  if (state.busy) {
    if (state.queue.length >= 5) {
      console.log(`[QUEUE_FULL] ${from}`);
      return sendMessage(from, "Queue full, please wait for current tasks to finish.");
    }
    state.queue.push(body);
    console.log(`[QUEUED] ${from} (depth: ${state.queue.length})`);
    return sendMessage(from, "Got it, I'll process this next.");
  }

  state.busy = true; // Synchronous — before any await
  await processCommand(from, body, state);
});

// --- Forward to VM and process queue ---
async function processCommand(from, text, state) {
  try {
    console.log(`[FORWARD] ${from}: ${text.substring(0, 80)}`);
    const data = await forwardToVM(text);

    if (data.text) {
      const response = data.text.length > 1500
        ? data.text.substring(0, 1500) + "\n\n[Response truncated]"
        : data.text;
      console.log(`[RESPONSE] ${from} (${data.durationMs}ms, exit ${data.exitCode})`);
      await sendMessage(from, response);
    } else {
      await sendMessage(from, "Claude returned an empty response.");
    }
  } catch (err) {
    console.error(`[ERROR] ${from}: ${err.message}`);
    // Map VM status codes to user-friendly messages
    const message = err.status === 400 ? "I couldn't process that message. Try rephrasing."
      : err.status === 408 ? "That took too long. Try a simpler request."
      : "Something went wrong. Try again in a moment.";
    await sendMessage(from, message);
  }

  // Process queue (iterative — avoids stack growth with deep queues)
  while (state.queue.length > 0) {
    const next = state.queue.shift();
    console.log(`[DEQUEUED] ${from} (remaining: ${state.queue.length})`);
    try {
      console.log(`[FORWARD] ${from}: ${next.substring(0, 80)}`);
      const data = await forwardToVM(next);
      if (data.text) {
        const response = data.text.length > 1500
          ? data.text.substring(0, 1500) + "\n\n[Response truncated]"
          : data.text;
        await sendMessage(from, response);
      }
    } catch (err) {
      console.error(`[ERROR] ${from}: ${err.message}`);
      await sendMessage(from, "Something went wrong. Try again in a moment.");
    }
  }
  state.busy = false;
}

// --- HTTP to VM with timeout + cold-start retry ---
async function forwardToVM(text) {
  const doFetch = async () => {
    const controller = new AbortController();
    const RELAY_TIMEOUT_MS = 330_000; // VM's COMMAND_TIMEOUT_MS (300s) + 30s buffer
    const timeout = setTimeout(() => controller.abort(), RELAY_TIMEOUT_MS);
    try {
      const res = await fetch(`${CLAUDE_HOST}/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw Object.assign(new Error(errBody.error || `VM returned ${res.status}`), {
          status: res.status,
        });
      }
      return await res.json();
    } finally {
      clearTimeout(timeout);
    }
  };

  try {
    return await doFetch();
  } catch (err) {
    // Cold-start retry on connection error
    if (err.cause?.code === "ECONNREFUSED" || err.message.includes("ECONNREFUSED")) {
      console.log("[RETRY] VM connection refused, retrying in 4s (cold start?)");
      await new Promise(r => setTimeout(r, 4000));
      return await doFetch();
    }
    throw err;
  }
}

// --- Outbound message helper ---
async function sendMessage(to, body) {
  try {
    await client.messages.create({
      to,
      from: TWILIO_PHONE_NUMBER,
      body,
    });
    console.log(`[OUTBOUND] ${to}: ${body.substring(0, 80)}`);
  } catch (err) {
    console.error(`[OUTBOUND_ERROR] ${to}: ${err.message}`);
  }
}

// --- Start server ---
app.listen(PORT, () => {
  console.log(`[STARTUP] Relay listening on port ${PORT}`);
  console.log(`[STARTUP] VM target: ${CLAUDE_HOST}`);
});
```

### vm-server.js (add ~20 LOC)

```javascript
// --- Add near top, after existing constants ---
const IDLE_TIMEOUT_MS = parseInt(process.env.IDLE_TIMEOUT_MS || "1800000", 10);
let lastActivity = Date.now();

// --- Add --continue to spawn args (line ~48) ---
// Before: ["−p", "−−dangerously-skip-permissions", "−"]
// After:  ["−p", "−−continue", "−−dangerously-skip-permissions", "−"]

// --- Update lastActivity on each command (inside POST /command handler) ---
lastActivity = Date.now();

// --- Add idle shutdown timer (after app.listen) ---
setInterval(() => {
  if (!busy && Date.now() - lastActivity > IDLE_TIMEOUT_MS) {
    console.log(`[IDLE] No activity for ${IDLE_TIMEOUT_MS / 1000}s, shutting down`);
    process.exit(0);
  }
}, 60_000); // Check every 60 seconds
```

### .env.example (add one line)

```
CLAUDE_HOST=http://localhost:3001
```

### vm/.env.example (add one line)

```
IDLE_TIMEOUT_MS=1800000
```

## Implementation Tasks

Five steps, ordered by dependency:

### 1. Upgrade server.js — relay forwarding + queue (~150-200 LOC total)

Replace the echo server with the full forwarding pipeline in one pass:
- Add `twilio.webhook()` middleware with `{ url: PUBLIC_URL + '/sms' }` (P0 security)
- Replace echo handler with async forwarding: immediate `200 OK`, POST to `CLAUDE_HOST/command` via `fetch` with `AbortController` timeout (330s = `COMMAND_TIMEOUT_MS` + 30s buffer), send response via Twilio REST API
- Add per-user state `Map<phone, { busy, queue[] }>` with 5-message cap, ack message, dequeue loop
- Map VM status codes (400, 408, 500) to user-friendly messages; handle empty body, media, truncation (>1500 chars)
- Add cold-start retry on `ECONNREFUSED` (wait 4s, retry once)
- Remove Phase 1 test-image.png endpoint
- Logging: `[FORWARD]`, `[RESPONSE]`, `[QUEUED]`, `[DEQUEUED]`, `[QUEUE_FULL]`, `[RETRY]`, `[OUTBOUND_ERROR]`

### 2. Upgrade vm-server.js — session resume + idle shutdown (~20 LOC added)

Two surgical additions:
- Add `--continue` to spawn args. Verify it works with `-p` during implementation — if not, omit and defer to Phase 10
- Add idle shutdown: `lastActivity` timestamp updated on each `/command`, `setInterval` (60s) checks if idle > `IDLE_TIMEOUT_MS` and `!busy`, calls `process.exit(0)`
- Logging: `[IDLE]`

### 3. Update config files

- Add `CLAUDE_HOST=http://localhost:3001` to `.env.example`
- Add `IDLE_TIMEOUT_MS=1800000` to `vm/.env.example`

### 4. Update docs

- **SECURITY.md:** Remove "No Twilio webhook signature validation" from known limitations. Add note about in-memory queue state loss on relay restart.
- **Phase doc** (`docs/plans/phases/03-phase-command.md`): Fix `CLAUDE_HOST` port (3000→3001), fix `ALLOWED_PHONE_NUMBER`→`ALLOWED_PHONE_NUMBERS`, add expanded scope (queue, `--continue`, idle shutdown).

### 5. Manual end-to-end test

- Text "what is 2+2" → verify Claude answers via WhatsApp
- Text while Claude is busy → verify queue ack and dequeue processing
- Forge an HTTP POST to `/sms` without Twilio signature → verify 403 rejection
- Let VM idle for >30 min (or temporarily lower `IDLE_TIMEOUT_MS`) → verify shutdown and auto-restart

## Dependencies & Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `--continue` doesn't work with `-p` flag | Medium | Low | Omit it; defer session resume to Phase 10 |
| Webhook validation fails behind ngrok | Medium | High | Use `url` option with `PUBLIC_URL`; test explicitly |
| Cold-start delay > 4 seconds | Low | Medium | Increase retry delay; add health check polling if needed |
| Relay restart loses in-memory queue + busy state | Low | Medium | Known limitation for MVP; persistent queue deferred |

## Known Limitations (Acceptable for MVP)

- **In-memory queue:** Lost on relay restart. Persistent queue (SQLite) can be added if needed.
- **No rate limiting:** Deferred to future phase. Webhook validation is the primary defense.
- **No VM `/command` authentication:** Acceptable for local dev (Docker network). Required for Phase 7 (Deploy).
- **Single-user session assumption:** `--continue` picks up the most recent conversation globally. Multi-user session isolation deferred to Phase 10.
- **Response loss on relay restart:** If relay crashes while VM is processing, the response is lost. User must resend.
- **No media handling:** Inbound images acknowledged but not processed. Deferred to Phase 4.

## References & Research

### Internal References

- Brainstorm: `docs/brainstorms/2026-02-26-phase-3-command-brainstorm.md`
- NanoClaw learnings: `docs/brainstorms/2026-02-26-nanoclaw-learnings-brainstorm.md`
- Phase 1 compound: `docs/solutions/developer-experience/sms-echo-server-twilio-ngrok-setup-20260225.md`
- Phase 2 compound: `docs/solutions/developer-experience/docker-vm-claude-code-headless-setup-20260225.md`
- Relay server: `server.js` (~207 LOC post-implementation)
- VM server: `vm/vm-server.js` (~163 LOC post-implementation)
- Docker setup: `docker-compose.yml`, `vm/Dockerfile`
- Architecture: `ARCHITECTURE.md`
- Security: `SECURITY.md` (lines 26-29 — known limitations)

### Existing Phase Plans

- Phase 3 plan: `docs/plans/phases/03-phase-command.md` (updated — expanded scope documented, review PASS)
