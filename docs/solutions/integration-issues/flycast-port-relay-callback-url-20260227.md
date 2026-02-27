---
module: provisioning
date: 2026-02-27
problem_type: integration_issue
component: flycast_relay_networking
symptoms:
  - "RELAY_CALLBACK_URL with :3000 causes ECONNRESET"
  - "VM cannot reach relay via Flycast when port is specified"
root_cause: "Flycast routes through Fly Proxy which maps port 80 to internal_port — specifying :3000 tries to hit port 3000 on Fly Proxy directly, which doesn't exist"
resolution_type: config_change
severity: critical
tags: [flycast, networking, port-mapping, relay, fly-io, econnreset]
---

# Troubleshooting: Flycast Port 80 Gotcha in RELAY_CALLBACK_URL

## Problem

The setup script set `RELAY_CALLBACK_URL=http://{prefix}-relay.flycast:3000` but Flycast URLs must use port 80 (the default). Specifying `:3000` causes ECONNRESET because Fly Proxy doesn't listen on that port.

## Environment
- Module: Provisioning (Phase 8)
- Affected Component: Flycast networking (VM → Relay callback)
- Date: 2026-02-27

## Symptoms
- `RELAY_CALLBACK_URL=http://{prefix}-relay.flycast:3000` returns ECONNRESET
- VM cannot send callbacks to the relay service
- Same pattern as the earlier `CLAUDE_HOST` lesson (`:3001` → ECONNRESET)

## What Didn't Work

**Direct solution:** The problem was identified during code review before deployment. The same Flycast port lesson had already been documented for `CLAUDE_HOST` but wasn't applied consistently to the new `RELAY_CALLBACK_URL`.

## Solution

Remove the explicit port from the Flycast URL.

**Code changes:**

```bash
# Before (broken — explicit port on Flycast URL):
VM_SECRETS=(
  "ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY"
  "RELAY_CALLBACK_URL=http://${PREFIX}-relay.flycast:3000"
)

# After (fixed — default port 80, Fly Proxy maps to internal_port):
VM_SECRETS=(
  "ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY"
  "RELAY_CALLBACK_URL=http://${PREFIX}-relay.flycast"
)
```

Both Flycast URLs now follow the same pattern:
- `CLAUDE_HOST=http://{prefix}-vm.flycast` (port 80 → internal_port 3001)
- `RELAY_CALLBACK_URL=http://{prefix}-relay.flycast` (port 80 → internal_port 3000)

## Why This Works

Fly.io's `.flycast` domain routes through the Fly Proxy:
1. Fly Proxy listens on port **80**
2. Fly Proxy maps port 80 → the app's `internal_port` (from `fly.toml`)
3. Specifying `:3000` tries to reach port 3000 on Fly Proxy itself — which doesn't exist → ECONNRESET

The `.internal` domain bypasses Fly Proxy and goes directly to the machine — there you might need the actual port. But `.flycast` always goes through the proxy, so always use port 80 (the default, i.e., omit the port).

## Prevention

- **Rule:** NEVER specify a port in `.flycast` URLs. Flycast = Fly Proxy = port 80 always.
- **Watch for:** Any URL containing `flycast:[0-9]` — this is always wrong.
- **Checklist for new Flycast URLs:** Does it omit the port? Does it use `.flycast` (not `.internal`)? Both must be true.
- **This is the second occurrence.** First: `CLAUDE_HOST` with `:3001`. Now: `RELAY_CALLBACK_URL` with `:3000`. The pattern is now well-established — treat any port on a `.flycast` URL as a P1 bug.

## Related Issues

- See also: [stateful-relay-multi-machine-deploy-20260227.md](../integration-issues/stateful-relay-multi-machine-deploy-20260227.md) — first documentation of the Flycast port 80 lesson (for `CLAUDE_HOST`)
- CLAUDE.md Lessons Learned: "Flycast: Use port 80 (default), NOT the internal_port"
