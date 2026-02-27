# Phase 7: Deploy to Production — Brainstorm

**Date:** 2026-02-27
**Phase:** 7 — Deploy
**Stage:** Deploy to Production
**Status:** Complete

## What We're Building

Deploy the WhatsApp Agentic Cockpit to the cloud so it works when the laptop is closed. Same experience as local — send a WhatsApp message, get a response.

### Architecture

```
Phone → Twilio → Relay (always-on Fly.io Machine)
                    │         ~$3-5/month
                    │
                    └──→ VM (Fly.io Machine + auto-stop + Volume)
                              ~$4-7/month active
                              Sleeps when idle, wakes on request
```

**Total estimated cost:** ~$7-12/month for single-user deployment.

## Why This Approach

### Relay: Always-On Fly.io Machine

- **Must be always-on** — Twilio webhooks need an instant response (15s timeout)
- **Lightweight** — Express server, ~500 LOC, minimal resources (~$3-5/mo)
- **Hub for all VMs** — in multi-user mode (Phase 8+), relay routes by phone number to per-user VMs
- **Instant acknowledgment** — can immediately send "Waking up..." when it detects a cold VM

### VM: Fly.io Machine with Auto-Stop

- **Uses existing Docker image** — same `vm/Dockerfile`, no changes needed
- **Auto-stop after idle** — self-managed via `vm-server.js` idle timeout (already has `IDLE_TIMEOUT_MS`)
- **Auto-start on request** — Fly Proxy wakes the Machine when relay sends a request
- **Fly Volume** — persistent storage at `/data` for images
- **Private networking** — relay talks to VM over `.internal` DNS, no auth needed
- **Cold start: 10-20s** — mitigated by relay sending "Waking up..." acknowledgment

### Why Not Sprites (Deferred)

Fly.io Sprites were investigated as an alternative (faster wake, built-in persistence, checkpoint/restore). Deferred because:

1. No private networking with Fly Machines (separate network, `.internal` DNS doesn't resolve)
2. Reliability is poor (beta, community reports of frequent timeouts/503s)
3. No fork/clone from checkpoint yet (needed for multi-user provisioning)

See `docs/future-plans/sprites-migration.md` for the full analysis and migration path.

## Key Decisions

### 1. Relay Hosting → Always-on Fly.io Machine

- Guarantees instant Twilio webhook response
- Can detect VM cold start and send user acknowledgment
- ~$3-5/month (shared-cpu-1x, 256MB-1GB RAM)

### 2. VM Hosting → Fly.io Machine with Auto-Stop + Volume

- Same Docker image as local development
- Self-managed idle shutdown via existing `IDLE_TIMEOUT_MS` in `vm-server.js`
- Fly Proxy auto-starts on incoming HTTP request from relay
- Volume at `/data` for persistent storage (~$0.45/month for 3GB)
- Cold start ~10-20s, relay sends "Waking up..." during this time

### 3. Networking → Private (.internal DNS)

- Relay → VM via `http://vm-app.internal:3001`
- VM → Relay via `http://relay-app.internal:3000`
- No application-level auth needed — network isolation IS the auth
- VM port (3001) never exposed to public internet

### 4. Screenshot Persistence → Fly Volume

- Mount Volume at `/data/images` (replaces ephemeral `/tmp/images`)
- Persists across Machine stop/start cycles

### 5. Cold Start UX → Immediate Acknowledgment

- Relay detects VM is cold (ECONNREFUSED or timeout on first request)
- Immediately sends WhatsApp message: "Waking up..." (before retrying)
- Small code change: add `sendMessage()` call in `forwardToVM()` before existing retry
- User knows the system received their message
- No silence gap — existing retry logic in `forwardToVM()` handles the rest

## What Needs to Be Created

| Deliverable | Description |
|-------------|-------------|
| `Dockerfile` (relay) | Containerize the relay server for Fly.io deployment |
| `fly.toml` (relay) | Fly.io app config — always-on, shared-cpu-1x, public HTTPS |
| `fly.toml` (VM) | Fly.io app config — auto-stop, Volume mount, private networking |
| Secrets | `fly secrets set` for both apps (Twilio, Anthropic, GitHub tokens) |
| Twilio webhook update | Point from ngrok URL to relay's Fly.io public URL |
| Volume mount changes | Update `vm-server.js` to use `/data/images` instead of `/tmp/images` |
| Cold start acknowledgment | Update relay `forwardToVM()` to send "Waking up..." on ECONNREFUSED |
| `.env.production` template | Document all production env vars |

## Deferred

Git repo persistence and relay state persistence moved to `docs/future-plans/post-deploy-enhancements.md` — not needed for MVP deployment.

## Open Questions

_None — all questions resolved during brainstorm._

## Config Changes (Local → Production)

| Config | Local | Production |
|--------|-------|------------|
| `PUBLIC_URL` | `https://xxxx.ngrok-free.app` | `https://relay-app.fly.dev` |
| `CLAUDE_HOST` | `http://localhost:3001` | `http://vm-app.internal:3001` |
| `RELAY_CALLBACK_URL` | `http://host.docker.internal:3000` | `http://relay-app.internal:3000` |
| `ENABLE_TEST_APP` | `true` | `false` |
| Twilio webhook | ngrok URL | `https://relay-app.fly.dev/webhook` |
| Secrets | `.env` files | `fly secrets set` |
| Image storage | `/tmp/images` | `/data/images` (Volume) |

## Next Steps

1. Run `/workflow:plan` to create implementation plan from this brainstorm
2. Phase 7 is primarily infrastructure/config — one small code change (`forwardToVM` acknowledgment)
3. Test: close laptop, send WhatsApp message, get response
