---
title: "Phase 6: End-to-End Local — Progress Streaming & Approval Flow"
type: feat
status: completed
date: 2026-02-27
phase: 6
brainstorm: docs/brainstorms/2026-02-27-phase-6-e2e-local-brainstorm.md
---

# Phase 6: End-to-End Local — Progress Streaming & Approval Flow

## Overview

Wire the full local loop: text a command from your phone → Claude Code executes → progress updates stream to WhatsApp → diffs and screenshots delivered → reply "approve" to create a PR. All running on your Mac.

Two deliverables, implemented in order:
1. **Task 1 — Progress streaming**: VM POSTs milestone callbacks to the relay during execution; relay forwards them as WhatsApp messages
2. **Task 2 — Approval flow**: Relay state machine (`idle → working → awaiting_approval → idle`) with keyword routing for approve/reject/cancel

This is the **demo milestone**. At the end of Phase 6, the product works end-to-end from your phone.

## Architecture Decisions

All decisions from the brainstorm, plus gap resolutions from SpecFlow analysis.

### From Brainstorm (Confirmed)

| # | Decision | Detail |
|---|----------|--------|
| 1 | **VM-to-Relay communication** | `RELAY_CALLBACK_URL` env var. Docker uses `host.docker.internal:3000` |
| 2 | **Session identification** | Phone number (already the `userState` Map key) |
| 3 | **Milestone format** | Structured `::progress::` markers in Claude Code stdout |
| 4 | **Approval trigger** | `::approval::` marker → `approvalRequired: true` in VM response |
| 5 | **Approval delivery** | Dedicated `POST /approve` endpoint on VM |
| 6 | **State machine** | Replace `busy: boolean` with `state: 'idle' | 'working' | 'awaiting_approval'` |
| 7 | **Approval timeout** | 30 minutes, changes preserved on disk |

### Gap Resolutions (New)

| # | Gap | Decision |
|---|-----|----------|
| 8 | **Queue during `working`** | Keep the queue (max 5). "cancel" is a special keyword that bypasses the queue and kills the process |
| 9 | **Queue during `awaiting_approval`** | No queue. Only accept approve/reject/cancel keywords. Everything else → instruction reply |
| 10 | **Reject behavior** | `git checkout . && git clean -fd` — full cleanup of tracked and untracked changes |
| 11 | **Cancel mechanics** | AbortController on relay (abort in-flight fetch) + `POST /cancel` on VM (kill process group). Both fire in parallel |
| 12 | **Queue on non-normal transitions** | Clear queue on cancel, reject, and timeout. Preserve on normal idle transition |
| 13 | **Marker format** | `::progress:: <message>\n` and `::approval::\n` — must start a new line. VM uses line-buffered regex parser |
| 14 | **Phone in callback URL** | Strip `whatsapp:` prefix, use E.164 number. URL: `/callback/%2B14155551234` |
| 15 | **`::approval::` on non-zero exit** | Non-zero exit code overrides approval. Return error, not approval prompt |
| 16 | **Progress callback race** | VM awaits all in-flight callback POSTs before returning `/command` response |
| 17 | **Callback auth** | None for alpha (localhost only). TODO for Phase 7 |

## Data Flow

```
1. User sends WhatsApp message
2. Twilio → POST /webhook → relay
3. Relay: state idle → working, forward to VM
     POST /command { text, callbackPhone }
4. VM: spawn Claude Code, pipe prompt via stdin
5. Claude Code emits ::progress:: markers in stdout
6. VM: parse markers, POST /callback/:phone { type: 'progress', message }
7. Relay: receive callback, sendMessage() to WhatsApp
8. Claude Code finishes (may emit ::approval:: marker)
9. VM: await pending callbacks, respond to /command
     { text, images, diffs, diffSummary, approvalRequired, exitCode }
10. Relay: if approvalRequired → awaiting_approval, prompt user
11. User replies "approve"
12. Relay: POST /approve { approved: true } to VM
13. VM: git commit + gh pr create
14. VM: respond { text, prUrl }
15. Relay: send PR URL to WhatsApp, state → idle
```

## State Machine

```
                    new command
         ┌─────────────────────────┐
         ▼                         │
       IDLE ──── user message ───► WORKING
         ▲                         │  │
         │     ┌───────────────────┘  │
         │     │ no approval          │ approvalRequired
         │     │ (or error/timeout)   │
         │     ▼                      ▼
         │   IDLE            AWAITING_APPROVAL
         │                         │  │  │
         │   approve ──────────────┘  │  │
         │   (→ working → PR → idle)  │  │
         │                            │  │
         │   reject ──────────────────┘  │
         │   (→ git checkout+clean → idle) │
         │                               │
         │   timeout (30 min) ───────────┘
         │   (→ idle, changes preserved)
         │
         └── cancel (from working OR awaiting_approval)
              (→ kill process, clear queue → idle)
```

### State Transitions Table

| From | Trigger | To | Action |
|------|---------|-----|--------|
| `idle` | user message | `working` | Forward to VM via `POST /command` |
| `working` | VM responds (no approval) | `idle` | Send response to WhatsApp, process queue |
| `working` | VM responds (approvalRequired) | `awaiting_approval` | Send diffs + approval prompt, start 30-min timer |
| `working` | VM error/timeout | `idle` | Send error to WhatsApp, process queue |
| `working` | user sends "cancel" | `idle` | POST `/cancel` to VM, abort fetch, clear queue |
| `working` | user sends other message | `working` | Queue message (max 5) |
| `awaiting_approval` | "approve" / "a" | `working` → `idle` | POST `/approve {approved:true}`, send PR URL |
| `awaiting_approval` | "reject" / "r" | `idle` | POST `/approve {approved:false}`, VM does `git checkout . && git clean -fd` |
| `awaiting_approval` | "cancel" / "c" | `idle` | Same as reject, clear queue |
| `awaiting_approval` | timeout (30 min) | `idle` | Send "Approval timed out. Changes preserved." |
| `awaiting_approval` | other message | `awaiting_approval` | Reply: "Reply *approve* to create PR, *reject* to undo." |

## Task 1: Progress Streaming

### VM Changes (`vm/vm-server.js`)

#### 1.1 Add `RELAY_CALLBACK_URL` env var

```javascript
// vm/vm-server.js — top of file
const RELAY_CALLBACK_URL = process.env.RELAY_CALLBACK_URL || "";
```

Add to `vm/.env.example`:
```
RELAY_CALLBACK_URL=http://host.docker.internal:3000
```

#### 1.2 Line-buffered stdout parser

Replace the raw `stdoutChunks.push(data)` with a parser that scans for markers while still accumulating full output.

```javascript
// vm/vm-server.js — inside /command handler
let lineBuf = "";

child.stdout.on("data", (data) => {
  const chunk = data.toString();
  stdoutChunks.push(data); // still accumulate raw output

  // Line-buffer for marker parsing
  lineBuf += chunk;
  const lines = lineBuf.split("\n");
  lineBuf = lines.pop(); // keep incomplete last line in buffer

  for (const line of lines) {
    const progressMatch = line.match(/^::progress::\s*(.+)/);
    if (progressMatch && RELAY_CALLBACK_URL && callbackPhone) {
      postCallback(callbackPhone, { type: "progress", message: progressMatch[1] });
    }
  }
});
```

#### 1.3 Callback POST function

```javascript
// vm/vm-server.js — new helper
const pendingCallbacks = [];

async function postCallback(phone, payload) {
  const url = `${RELAY_CALLBACK_URL}/callback/${encodeURIComponent(phone)}`;
  const promise = fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch((err) => console.error(`Callback failed: ${err.message}`));
  pendingCallbacks.push(promise);
}
```

#### 1.4 Await pending callbacks before responding

In the `child.on("close")` handler, before `res.json(...)`:

```javascript
// Ensure all progress callbacks have been delivered before responding
await Promise.allSettled(pendingCallbacks);
pendingCallbacks.length = 0;
```

#### 1.5 Accept `callbackPhone` in `/command` request body

```javascript
// vm/vm-server.js — inside /command handler
const { text, callbackPhone } = req.body;
```

### Relay Changes (`server.js`)

#### 1.6 Add JSON body parser

```javascript
// server.js — middleware section
app.use(express.json()); // for VM callbacks
```

#### 1.7 New `POST /callback/:phone` endpoint

```javascript
// server.js — new endpoint
app.post("/callback/:phone", (req, res) => {
  const phone = decodeURIComponent(req.params.phone);
  const { type, message } = req.body;

  if (type === "progress" && message) {
    // Truncate to WhatsApp limit
    const truncated = message.length > MAX_MSG
      ? message.slice(0, MAX_MSG - 20) + "\n[truncated]"
      : message;
    sendMessage(phone, `⏳ ${truncated}`);
  }

  res.sendStatus(200);
});
```

#### 1.8 Pass `callbackPhone` in `forwardToVM()`

```javascript
// server.js — forwardToVM()
// Change: JSON.stringify({ text })
// To:     JSON.stringify({ text, callbackPhone: from })
```

### Docker Changes

#### 1.9 Add `extra_hosts` to `docker-compose.yml`

```yaml
services:
  vm:
    build: ./vm
    ports:
      - "3001:3001"
    extra_hosts:
      - "host.docker.internal:host-gateway"
    env_file:
      - ./vm/.env
    mem_limit: 4g
    restart: unless-stopped
```

#### 1.10 Add `RELAY_CALLBACK_URL` to `vm/.env`

```
RELAY_CALLBACK_URL=http://host.docker.internal:3000
```

### Testing Task 1

- [ ] Send a command that triggers Claude Code to emit `::progress::` markers
- [ ] Verify progress messages arrive on WhatsApp during execution
- [ ] Verify the final `/command` response still works normally
- [ ] Verify commands without progress markers still work (graceful degradation)
- [ ] Verify long progress messages are truncated to 4096 chars

---

## Task 2: Approval Flow

### Relay Changes (`server.js`)

#### 2.1 Replace `userState` shape

```javascript
// Before
userState.set(phone, { busy: false, queue: [] });

// After
userState.set(phone, { state: "idle", queue: [], approvalTimer: null, abortController: null });
```

Update `getState()` accordingly.

#### 2.2 Break `processCommand()` while-loop into two functions

The current `processCommand()` is a `while (current)` loop that owns the full lifecycle (execute → dequeue → repeat). The state machine requires splitting this into:

1. **`processCommand(from, text, state)`** — processes a single command. On `approvalRequired`, transitions state and returns (no loop). On normal completion, calls `processQueue()`.
2. **`processQueue(from, state)`** — dequeues the next message and calls `processCommand()`, or sets `state.state = "idle"` if empty.

```javascript
async function processCommand(from, text, state) {
  const data = await forwardToVM(text, from, state);
  // ... send response to WhatsApp (existing formatting logic) ...

  if (data.approvalRequired) {
    // Step 2.3 handles this path — state transitions, no queue processing
    return;
  }

  // Normal completion — process queue
  processQueue(from, state);
}

function processQueue(from, state) {
  if (state.queue.length > 0) {
    const next = state.queue.shift();
    processCommand(from, next, state);
  } else {
    state.state = "idle";
  }
}
```

This is the structural prerequisite for steps 2.3–2.6. The error handling (try/catch, safety-net reset) moves into `processCommand()` wrapping the single command, not a loop.

#### 2.3 Refactor webhook handler with state routing

The webhook handler needs to route messages based on state:

```javascript
// server.js — inside POST /webhook handler
const state = getState(from);
const normalized = body.trim().toLowerCase();

if (state.state === "awaiting_approval") {
  // Only accept keywords
  if (["approve", "a"].includes(normalized)) {
    handleApprove(from, state);
  } else if (["reject", "r"].includes(normalized)) {
    handleReject(from, state);
  } else if (["cancel", "c"].includes(normalized)) {
    handleCancel(from, state);
  } else {
    sendMessage(from, "Reply *approve* to create PR or *reject* to undo changes.");
  }
  return;
}

if (state.state === "working") {
  if (["cancel", "c"].includes(normalized)) {
    handleCancelWorking(from, state);
    return;
  }
  // Otherwise, queue as before (existing logic)
}

// state === "idle" — process the command (existing logic with state rename)
```

#### 2.3 Update `processCommand()` for state machine

Key change: after VM responds, check `approvalRequired`:

```javascript
// Inside processCommand, after forwardToVM returns
if (data.approvalRequired) {
  state.state = "awaiting_approval";
  state.approvalTimer = setTimeout(() => {
    state.state = "idle";
    state.approvalTimer = null;
    sendMessage(from, "⏰ Approval timed out (30 min). Changes preserved on disk.");
  }, 30 * 60 * 1000);

  // Send diffs + prompt (use existing formatting)
  sendMessage(from, formatApprovalPrompt(data));
  return; // Exit processCommand — don't process queue
}

// No approval needed — existing logic (send response, process queue)
```

#### 2.4 `handleApprove()` function

```javascript
async function handleApprove(from, state) {
  clearTimeout(state.approvalTimer);
  state.state = "working";
  state.approvalTimer = null;

  try {
    const response = await fetch(`${CLAUDE_HOST}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved: true }),
    });
    const data = await response.json();

    if (data.prUrl) {
      sendMessage(from, `✅ PR created: ${data.prUrl}`);
    } else {
      sendMessage(from, `✅ ${data.text || "Approved."}`);
    }
  } catch (err) {
    sendMessage(from, `❌ Failed to create PR: ${err.message}\nReply *approve* to retry.`);
    state.state = "awaiting_approval";
    // Restart timeout
    state.approvalTimer = setTimeout(() => {
      state.state = "idle";
      state.approvalTimer = null;
      sendMessage(from, "⏰ Approval timed out.");
    }, 30 * 60 * 1000);
    return;
  }

  state.state = "idle";
  // Process queue if any
  processQueue(from, state);
}
```

#### 2.5 `handleReject()` function

```javascript
async function handleReject(from, state) {
  clearTimeout(state.approvalTimer);
  state.state = "working";
  state.approvalTimer = null;

  try {
    await fetch(`${CLAUDE_HOST}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved: false }),
    });
    sendMessage(from, "↩️ Changes reverted. Ready for next command.");
  } catch (err) {
    sendMessage(from, `⚠️ Failed to revert: ${err.message}. Changes may still be on disk.`);
  }

  state.state = "idle";
  state.queue.length = 0; // Clear queue on reject
  processQueue(from, state);
}
```

#### 2.6 `handleCancelWorking()` function

```javascript
async function handleCancelWorking(from, state) {
  // 1. Abort the in-flight fetch
  if (state.abortController) {
    state.abortController.abort();
  }

  // 2. Tell VM to kill the process
  try {
    await fetch(`${CLAUDE_HOST}/cancel`, { method: "POST" });
  } catch (_) { /* VM may already be done */ }

  state.state = "idle";
  state.queue.length = 0; // Clear queue on cancel
  state.abortController = null;
  sendMessage(from, "🛑 Cancelled. Ready for next command.");
}
```

#### 2.7 Wire AbortController into `forwardToVM()` (signature change)

Current signature: `forwardToVM(text)`. New signature: `forwardToVM(text, from, state)`. Update all call sites (webhook handler, `processCommand()`).

```javascript
async function forwardToVM(text, from, state) {
  const controller = new AbortController();
  state.abortController = controller;

  try {
    const resp = await fetch(`${CLAUDE_HOST}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, callbackPhone: from }),
      signal: controller.signal,
      // ... existing timeout logic
    });
    // ... existing response handling
  } finally {
    state.abortController = null;
  }
}
```

#### 2.8 Format and send approval prompt (with images)

The approval path must also send images if the VM response includes them (e.g., screenshots taken during execution). Use the same media URL pattern as normal responses.

```javascript
function formatApprovalPrompt(data) {
  let msg = data.text || "Changes ready for review.";

  if (data.diffs) {
    msg += "\n\n" + formatDiffMessage(data.diffs, data.diffSummary, MAX_MSG - msg.length - 100);
  }

  msg += "\n\nReply *approve* to create PR or *reject* to undo.";

  return msg.slice(0, MAX_MSG);
}

// In processCommand, when approvalRequired:
const mediaUrls = (data.images || []).map((img) => `${PUBLIC_URL}${img.url}`);
await sendMessage(from, formatApprovalPrompt(data), mediaUrls);
```

### VM Changes (`vm/vm-server.js`)

#### 2.9 Parse `::approval::` marker in stdout

In the line-buffered parser (from Task 1), add:

```javascript
let approvalRequested = false;

// Inside the line parser loop
if (line.match(/^::approval::/)) {
  approvalRequested = true;
}
```

In the response (on success, exit code 0 only):

```javascript
res.json({
  text: textOut,
  images,
  diffs: diffResult?.diff || undefined,
  diffSummary: diffResult?.summary || undefined,
  approvalRequired: approvalRequested && code === 0, // Only on clean exit
  exitCode: 0,
  durationMs,
});
```

#### 2.10 New `POST /approve` endpoint

```javascript
app.post("/approve", async (req, res) => {
  const { approved } = req.body;

  if (busy) {
    return res.status(409).json({ error: "busy" });
  }

  busy = true;

  try {
    if (approved) {
      // Create PR using Claude Code
      const child = spawn("claude", ["-p", "--dangerously-skip-permissions", "-"], {
        detached: true,
        stdio: ["pipe", "pipe", "pipe"],
      });

      child.stdin.write("Create a git commit for all current changes and push a PR using `gh pr create`. Use a descriptive title based on the changes.");
      child.stdin.end();

      // ... collect stdout, wait for close (similar to /command but simpler)
      // Parse output for PR URL

      const prUrlMatch = stdout.match(/https:\/\/github\.com\/[^\s]+\/pull\/\d+/);
      res.json({
        text: stdout,
        prUrl: prUrlMatch ? prUrlMatch[0] : null,
      });
    } else {
      // Reject: full cleanup
      execSync("git checkout . && git clean -fd", { cwd: process.cwd(), timeout: 5000 });
      res.json({ text: "Changes reverted." });
    }
  } catch (err) {
    res.status(500).json({ error: "approve_failed", message: err.message });
  } finally {
    busy = false;
  }
});
```

#### 2.11 New `POST /cancel` endpoint

```javascript
app.post("/cancel", (req, res) => {
  if (activeChild) {
    try {
      process.kill(-activeChild.pid, "SIGTERM");
    } catch (_) { /* already dead */ }
    res.json({ cancelled: true });
  } else {
    res.json({ cancelled: false, message: "no active process" });
  }
});
```

### System Prompt Changes

#### 2.12 Add marker instructions to `vm/CLAUDE.md`

Append the following to `vm/CLAUDE.md`. Claude Code reads this file automatically — no system prompt injection needed:

```markdown
## Progress Reporting

When executing multi-step tasks, emit progress markers to keep the user informed:

- Use `::progress:: <message>` on its own line to report milestones
- Use `::approval::` on its own line when you've made code changes that need user approval before creating a PR

Example:
::progress:: Reading codebase and understanding structure
::progress:: Making changes to src/components/Navbar.tsx
::progress:: Running tests
::approval::

Guidelines:
- Emit 3-6 progress markers per task (not too many, not too few)
- Keep messages short and descriptive
- Always emit ::approval:: after making code changes, before creating a PR
- Do NOT emit ::approval:: if no code changes were made
```

### Testing Task 2

- [ ] Send a command → verify state transitions to `working`
- [ ] Verify queued messages still work while `working`
- [ ] Send "cancel" while working → verify process killed, state returns to idle
- [ ] Send a command that triggers `::approval::` → verify `awaiting_approval` state
- [ ] Reply "approve" → verify PR is created and URL is sent
- [ ] Reply "reject" → verify `git checkout . && git clean -fd` runs, state returns to idle
- [ ] Send non-keyword while `awaiting_approval` → verify instruction reply
- [ ] Wait 30 min (or shorten timeout for testing) → verify timeout message
- [ ] Send "approve" after VM error → verify error handling and retry prompt
- [ ] Verify existing flows (no approval) still work unchanged

---

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `vm/vm-server.js` | Modify | Line-buffered stdout parser, `::progress::`/`::approval::` detection, callback POSTs, `/approve` endpoint, `/cancel` endpoint, accept `callbackPhone` |
| `server.js` | Modify | State machine (replace `busy` boolean), `/callback/:phone` endpoint, approval/reject/cancel handlers, AbortController in `forwardToVM`, JSON body parser |
| `docker-compose.yml` | Modify | Add `extra_hosts` for `host.docker.internal` |
| `vm/.env.example` | Modify | Add `RELAY_CALLBACK_URL` |
| `vm/.env` | Modify | Add `RELAY_CALLBACK_URL=http://host.docker.internal:3000` |
| `ARCHITECTURE.md` | Modify | Document callback flow and state machine |

## Implementation Order

1. **Task 1 first** (progress streaming) — delivers value independently, testable in isolation
2. **Task 2 second** (approval flow) — layers state machine on top of Task 1's infrastructure

Within each task, implement VM changes first (new endpoints/parsing), then relay changes (routing/state), then test end-to-end.

## Institutional Learnings Applied

| Learning | Source | How Applied |
|----------|--------|-------------|
| Reset → Accumulate → Drain | screenshot pipeline | Progress callbacks drained via `Promise.allSettled` before `/command` response |
| Process group kill | Docker VM setup | Cancel uses `process.kill(-child.pid, "SIGTERM")` |
| Partial results on error | compression pipeline | Diffs/screenshots returned even on error/timeout |
| Budget-aware formatting | diff pipeline | Progress messages and approval prompts respect 4096-char limit |
| Transport-agnostic API | web chat bypass | State machine logic decoupled from WhatsApp transport |

## Open Items (Deferred)

- **Callback authentication** — Add shared secret header for Phase 7 (production deploy)
- **Progress message batching** — If Claude emits markers rapidly, consider debouncing/batching into fewer WhatsApp messages
- **Approval retry UX** — If PR creation fails, current plan retries in `awaiting_approval`. Consider a max retry count.
