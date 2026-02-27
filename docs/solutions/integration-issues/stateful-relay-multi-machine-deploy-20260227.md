---
module: Relay Server
date: 2026-02-27
problem_type: integration_issue
component: fly_io_deployment
symptoms:
  - "Fly.io creates 2 machines by default on fly deploy, despite min_machines_running = 1"
  - "Approval flow breaks: user replies 'approve' but it's treated as a new command"
  - "In-memory userState Map is not shared across load-balanced machines"
root_cause: "Fly.io fly deploy creates 2 machines by default for HA redundancy. min_machines_running controls auto-stop minimum, not total machine count. Fly Proxy load-balances across both machines, so sequential webhook requests from the same user may hit different machines with separate in-memory state."
resolution_type: config_change
severity: critical
tags: [fly-io, deployment, state-management, load-balancing, in-memory-state, stateful-server]
---

# Troubleshooting: Fly.io Multi-Machine Deployment Breaks In-Memory Relay State

## Problem

After deploying the relay server to Fly.io with `fly deploy`, the approval flow broke silently. A user's WhatsApp message would be processed correctly, but when they replied "approve" to create a PR, the relay treated "approve" as a new Claude Code command instead of an approval action.

## Environment

- Module: Relay Server (`server.js`)
- Affected Component: Fly.io deployment, in-memory `userState` Map
- Date: 2026-02-27

## Symptoms

- `fly status --app textslash-relay` shows 2 machines running (expected 1)
- Approval flow: user sends command, gets diffs, replies "approve" — but "approve" is forwarded to Claude Code as a new task instead of triggering PR creation
- `fly.toml` has `min_machines_running = 1` but 2 machines exist after deploy
- Basic stateless flows (e.g., "Hi Claude!") work fine — only stateful flows break

## What Didn't Work

**Attempted Solution 1:** Setting `min_machines_running = 1` in `fly.toml`
- **Why it failed:** `min_machines_running` controls the minimum number of machines that stay running (for auto-stop behavior), NOT the total machine count. Fly.io still creates 2 machines on initial `fly deploy` for redundancy.

## Solution

Scale the relay to a single machine:

```bash
fly scale count 1 --app textslash-relay
```

**Code involved** (`server.js:44-51`):

```javascript
// This in-memory state is per-process — not shared across machines
const userState = new Map();

function getState(phone) {
  if (!userState.has(phone)) {
    userState.set(phone, { state: "idle", queue: [], approvalTimer: null, abortController: null });
  }
  return userState.get(phone);
}
```

**Failure scenario with 2 machines:**

1. User sends "make a button" → Twilio webhook hits Machine A
2. Machine A processes command, `userState` transitions to `awaiting_approval`
3. User replies "approve" → Fly Proxy routes to Machine B
4. Machine B has no state for this user (defaults to `idle`) → "approve" forwarded to Claude Code as a new command
5. Claude Code receives the literal text "approve" as a task instead of triggering PR creation

**For future multi-machine scaling**, externalize state via:
- Redis/Upstash for distributed session store
- SQLite on a Fly Volume for lightweight persistence
- `fly-replay` header for sticky sessions (temporary bridge only)

## Why This Works

With `fly scale count 1`, Fly Proxy has only one target machine. All Twilio webhooks for a given user route to the same process instance. The in-memory `userState` Map is stable across the full conversation flow: idle → working → awaiting_approval → approve → idle.

The Fly.io default of 2 machines is designed for production HA (one machine can restart while the other handles traffic). For a single-user development tool, that resilience is unnecessary and actively harmful because it splits in-memory state across processes.

## Prevention

- **After every `fly deploy`, verify machine count:** `fly machines list -a <app-name>` — should show exactly 1 machine for stateful single-instance apps
- **Add `fly scale count 1` to deployment scripts/runbooks** for any app using in-memory state
- **Document the assumption in code:** Add a comment near `const userState = new Map()` explaining single-machine requirement
- **For Phase 8+ scaling:** Pre-architect state externalization. Use an environment variable (`STATE_STORAGE=memory|redis`) to make the transition explicit
- **Fly.io-specific gotcha:** `min_machines_running` and `max_machines_running` are auto-stop/start controls, not deployment controls. Machine count is set by `fly scale count` or the initial `fly deploy` default (2)

## Related Issues

- See also: [docker-vm-claude-code-headless-setup-20260225.md](../developer-experience/docker-vm-claude-code-headless-setup-20260225.md) — Docker container architecture for the VM
- See also: [screenshot-pipeline-architecture-playwright-relay-whatsapp-20260226.md](../best-practices/screenshot-pipeline-architecture-playwright-relay-whatsapp-20260226.md) — Relay state management patterns for `pendingImages`
- See also: [e2e-demo-loop-progress-approval-cancel-20260227.md](../integration-issues/e2e-demo-loop-progress-approval-cancel-20260227.md) — End-to-end approval flow validation
