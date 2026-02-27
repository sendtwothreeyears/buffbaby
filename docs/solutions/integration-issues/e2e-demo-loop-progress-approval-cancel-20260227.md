---
module: WhatsApp Agentic Cockpit
date: 2026-02-27
problem_type: integration_issue
component: relay-vm-e2e
symptoms:
  - "No user feedback during long-running Claude Code execution"
  - "No approval gate before PR creation — code pushed autonomously"
  - "No way to cancel an in-flight command or reject proposed changes"
  - "Components (relay, VM, Claude Code) built in Phases 1-5 not wired together"
root_cause: "Phases 1-5 built isolated components (relay webhook handling, VM command execution, screenshot pipeline, diff formatting) but lacked the integration layer: progress streaming from VM to WhatsApp, conversational approval flow, and cancel/reject mechanics"
resolution_type: code_fix
severity: high
tags: [phase-6, end-to-end, integration, progress-streaming, approval-flow, state-machine, callback, cancel, demo-milestone]
---

# Troubleshooting: End-to-End Demo Loop — Progress, Approval, and Cancel

## Problem

Phases 1-5 built isolated capabilities (Twilio webhooks, VM command execution, screenshots, diffs) but the system had no way to stream progress during execution, gate code changes behind user approval, or cancel in-flight work. Phase 6 wired everything into a complete WhatsApp-controlled agentic development loop.

## Environment

- Module: WhatsApp Agentic Cockpit
- Affected Components: `server.js` (relay), `vm/vm-server.js` (VM), `vm/CLAUDE.md` (system prompt), `docker-compose.yml`
- Date: 2026-02-27

## Symptoms

- User sends a command and receives nothing until the job finishes (minutes of silence)
- Claude Code autonomously pushes code and creates PRs with no review opportunity
- No way to abort a long-running command from WhatsApp
- No way to reject proposed changes and revert

## What Didn't Work

**Direct solution:** Phase 6 was a planned integration milestone, not a debugging exercise. Two design alternatives were evaluated and rejected during the brainstorm phase:

**Alternative 1: WebSocket/SSE for real-time streaming**
- **Why rejected:** Adds complexity (persistent connections, reconnection logic). WhatsApp doesn't need sub-second streaming — HTTP callback POSTs at milestone boundaries are sufficient.

**Alternative 2: Polling from relay to VM**
- **Why rejected:** Relay would need to poll VM on a timer, adding latency and wasted requests. Push-based callbacks (VM→Relay) are simpler and deliver updates immediately.

## Solution

Two features built across `server.js` (+229 LOC) and `vm/vm-server.js` (+120 LOC):

### Feature 1: Progress Streaming via Callbacks

**Pattern: Line-buffered marker parsing + fire-and-forget HTTP callbacks**

Claude Code emits structured `::progress::` markers on stdout. The VM parses these in a line-buffered loop and immediately POSTs to the relay, which forwards to WhatsApp.

**VM: Line-buffered marker parser** (`vm/vm-server.js`):

```javascript
let lineBuf = "";

child.stdout.on("data", (chunk) => {
  stdoutBytes += chunk.length;
  if (stdoutBytes <= MAX_OUTPUT_BYTES) stdoutChunks.push(chunk);

  lineBuf += chunk.toString();
  const lines = lineBuf.split("\n");
  lineBuf = lines.pop(); // keep incomplete last line in buffer

  for (const line of lines) {
    if (line.match(/^::approval::/)) {
      approvalRequested = true;
    }
    const progressMatch = line.match(/^::progress::\s*(.+)/);
    if (progressMatch && RELAY_CALLBACK_URL && callbackPhone) {
      postCallback(callbackPhone, { type: "progress", message: progressMatch[1] });
    }
  }
});
```

**VM: Fire-and-forget with settled await** (`vm/vm-server.js`):

```javascript
const pendingCallbacks = [];

async function postCallback(phone, payload) {
  const url = `${RELAY_CALLBACK_URL}/callback/${encodeURIComponent(phone)}`;
  const promise = fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch((err) => console.error(`[CALLBACK] Failed: ${err.message}`));
  pendingCallbacks.push(promise);
}

// Before responding — ensures all progress updates are delivered
await Promise.allSettled(pendingCallbacks);
pendingCallbacks.length = 0;
```

**Relay: Callback receiver** (`server.js`):

```javascript
app.post("/callback/:phone", async (req, res) => {
  const { type, message } = req.body;
  if (type === "progress") {
    await sendMessage(req.params.phone, `⏳ ${message}`);
  }
  res.sendStatus(200);
});
```

**VM: Marker stripping** (prevents markers from leaking into user-visible text):

```javascript
const textOut = rawOut
  .split("\n")
  .filter((line) => !line.match(/^::progress::\s/) && !line.match(/^::approval::/))
  .join("\n")
  .trim();
```

### Feature 2: Approval Flow State Machine

**Pattern: Per-user state machine with keyword routing**

The relay maintains a three-state machine per user phone number:

```
idle → (command received) → working → (::approval:: detected) → awaiting_approval
  ↑                            |                                        |
  |                            ↓                                        ↓
  ←──── (complete/cancel) ─────←──── (approve/reject/cancel/timeout) ───←
```

**Relay: State definition** (`server.js`):

```javascript
const userState = new Map();

function getState(phone) {
  if (!userState.has(phone)) {
    userState.set(phone, {
      state: "idle",       // "idle" | "working" | "awaiting_approval"
      queue: [],
      approvalTimer: null,
      abortController: null,
    });
  }
  return userState.get(phone);
}
```

**Relay: State-gated webhook routing** (`server.js`):

```javascript
if (state.state === "awaiting_approval") {
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
```

**Relay: Approval transition with 30-minute timeout** (`server.js`):

```javascript
if (data.approvalRequired) {
  state.state = "awaiting_approval";
  state.approvalTimer = setTimeout(() => {
    state.state = "idle";
    state.approvalTimer = null;
    sendMessage(from, "Approval timed out (30 min). Changes preserved on disk.");
  }, APPROVAL_TIMEOUT_MS);

  const mediaUrls = (data.images || []).map((img) => `${PUBLIC_URL}${img.url}`);
  await sendMessage(from, formatApprovalPrompt(data), mediaUrls);
  return;
}
```

**VM: /approve endpoint** — creates PR or reverts (`vm/vm-server.js`):

```javascript
app.post("/approve", async (req, res) => {
  const { approved } = req.body || {};

  if (approved) {
    // Spawn Claude Code to commit and create PR
    const child = spawn("claude", ["-p", "--dangerously-skip-permissions", "-"], { ... });
    child.stdin.write(
      "Create a git commit for all current changes and push a PR. Use a descriptive title."
    );
    child.stdin.end();
    // ... extract PR URL from stdout
    const prUrlMatch = stdout.match(/https:\/\/github\.com\/[^\s]+\/pull\/\d+/);
    res.json({ text: stdout, prUrl: prUrlMatch ? prUrlMatch[0] : null });
  } else {
    execSync("git checkout . && git clean -fd", { cwd: process.cwd(), timeout: 5000 });
    res.json({ text: "Changes reverted." });
  }
});
```

**VM: /cancel endpoint** — kills entire process group (`vm/vm-server.js`):

```javascript
app.post("/cancel", (_req, res) => {
  if (activeChild) {
    try {
      process.kill(-activeChild.pid, "SIGTERM"); // negative PID = kill process group
    } catch (_) { /* already dead */ }
    res.json({ cancelled: true });
  } else {
    res.json({ cancelled: false, message: "no active process" });
  }
});
```

**Claude system prompt** (`vm/CLAUDE.md`) — marker emission guidelines:

```
::progress:: Reading codebase and understanding structure
::progress:: Making changes to src/components/Navbar.tsx
::progress:: Running tests
::approval::

Guidelines:
- Emit 3-6 progress markers per task
- Always emit ::approval:: after code changes, before PR creation
- Do NOT emit ::approval:: if no code changes were made
```

## Why This Works

1. **Root cause:** Phases 1-5 built components in isolation. The relay could receive webhooks and send messages, the VM could execute commands, but there was no feedback channel (VM→Relay during execution) or conversational flow control (approval/reject/cancel).

2. **Callback-over-WebSocket:** HTTP POSTs from VM to relay are stateless, simple, and don't require persistent connections. `Promise.allSettled` before the final response guarantees delivery ordering without blocking execution.

3. **Structured markers over fuzzy parsing:** `::progress::` and `::approval::` markers are regex-anchored to line starts (`^`). Claude Code output will never accidentally match these — eliminating false positives that would plague heuristic approaches.

4. **State machine over boolean flags:** The previous `busy: boolean` couldn't represent "waiting for approval." Three explicit states (`idle`, `working`, `awaiting_approval`) with guarded transitions prevent impossible state combinations and enable clean keyword routing.

5. **Process group kill:** `detached: true` on spawn + `process.kill(-pid, "SIGTERM")` kills the entire subtree (Claude Code + any child tools it spawned), not just the parent process.

## Prevention

### Issues Found and Fixed During Phase 6

**P1: Marker stripping bug** — `::progress::` and `::approval::` markers leaked into response text sent to WhatsApp.
- **Prevention:** Always filter markers in the same code path where stdout is assembled for the response. Test with marker-heavy output.

**P1: State race in handleApprove** — State set to `idle` before `processQueue()` ran, creating a window for concurrent command execution.
- **Prevention:** Let `processQueue()` own the transition to `idle`. Never set idle before queue processing completes.

**P1: Unhandled promise rejection in processQueue** — Async error in queued command would reject silently without resetting state.
- **Prevention:** Wrap all async state-changing operations in try/catch with a safety net that resets to `idle`.

**P2: Missing response.ok check in handleApprove** — VM 500 errors silently treated as success.
- **Prevention:** Always check `response.ok` before reading response body on all HTTP calls.

### Best Practices for Callback + State Machine Patterns

- **Reset → Accumulate → Drain:** Collect callbacks during execution, await `Promise.allSettled` before responding. This pattern (from Phase 4's screenshot pipeline) generalizes to any fire-and-forget side-effect.
- **State transitions are atomic:** Only one code path should transition out of a given state. Centralize transition logic.
- **Budget-aware formatting:** All messages flowing to WhatsApp must respect the 4096-char limit. Truncate at semantic boundaries.
- **Process group management:** Always spawn long-running processes with `detached: true` and kill via negative PID.

### Testing Recommendations

- Unit test each state + event → expected new state transition
- Test concurrent message arrival during state transitions (approve + new command simultaneously)
- Test callback delivery ordering (all callbacks arrive before `/command` response)
- Test cancel during `working` vs `awaiting_approval` (different code paths)
- Test 30-minute approval timeout (mock timers)
- Test marker filtering with markers at start, middle, end, and consecutive lines

### Known Tech Debt for Future Phases

- **Callback auth:** Currently localhost-only. Production needs HMAC or shared secret on `/callback/:phone`.
- **Progress batching:** Rapid markers generate multiple WhatsApp messages. Batch within a time window (e.g., 2s).
- **Relay LOC growth:** 514 LOC (target was 200-300). Consider extracting state machine, formatters, and handlers into modules.
- **Approval→PR e2e test:** Full loop requires GitHub token on VM. Deferred to manual testing in Phase 7.

## Related Issues

- [Screenshot Pipeline Architecture](../best-practices/screenshot-pipeline-architecture-playwright-relay-whatsapp-20260226.md) — Establishes the Reset → Accumulate → Drain pattern reused for progress callbacks
- [Text Diff Pipeline Formatting](../best-practices/text-diff-pipeline-formatting-patterns-20260227.md) — Budget-aware formatting and partial results on error paths
- [Docker VM Claude Code Headless Setup](../developer-experience/docker-vm-claude-code-headless-setup-20260225.md) — Process group management pattern (`detached: true` + `process.kill(-pid)`)
- [MMS Screenshot Compression Pipeline](../integration-issues/mms-screenshot-compression-pipeline-20260226.md) — WhatsApp media constraints and error path handling
- [Web Chat Dev Tool](../developer-experience/web-chat-dev-tool-twilio-bypass-20260226.md) — Enabled e2e testing of approval flows during Phase 6
