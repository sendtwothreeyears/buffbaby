---
title: "Deploy to Fly.io (Phase 7)"
type: feat
status: active
date: 2026-02-27
---

# Deploy to Fly.io (Phase 7)

## Overview

Deploy the WhatsApp Agentic Cockpit to Fly.io so it works when the laptop is closed. Two Fly.io Machines: an always-on relay server and an auto-stop VM with persistent storage. Same experience as local — send a WhatsApp message, get a response.

```
Phone → Twilio → Relay (always-on Fly.io Machine)
                    │         ~$3-5/month
                    └──→ VM (Fly.io Machine + auto-stop + Volume)
                              ~$4-7/month active
                              Sleeps when idle, wakes on request
```

**Total estimated cost:** ~$7-12/month for single-user deployment.

## Problem Statement / Motivation

The system currently requires a laptop running ngrok, the relay server, and a Docker container. Close the laptop → system goes offline. Phase 7 moves everything to the cloud so it's always available.

## Proposed Solution

Deploy both components to Fly.io Machines with private networking between them. The relay is always-on to catch Twilio webhooks instantly. The VM auto-stops after idle to save cost, and Fly Proxy wakes it on demand. A Fly Volume persists screenshot images across VM sleep/wake cycles.

### Architecture Decisions (from brainstorm)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Relay hosting | Always-on Fly.io Machine | Twilio webhooks need instant response (15s timeout) |
| VM hosting | Fly.io Machine + auto-stop + Volume | Same Docker image, pay-per-use when idle |
| Networking | Flycast (`.flycast` address) | Enables Fly Proxy auto-start for stopped VM (see Risk 1 below) |
| Image persistence | Fly Volume at `/data/images` | Persists across Machine stop/start cycles |
| Cold start UX | "Waking up..." acknowledgment | User knows system received their message |

## Technical Approach

### Risk 1 (Blocking): `.internal` DNS vs Flycast for Auto-Start

**Issue:** The brainstorm assumes `.internal` DNS for relay→VM communication. However, `.internal` DNS resolves directly to the Machine's private IPv6 — it **bypasses Fly Proxy**, meaning a stopped VM won't auto-start on incoming requests. This is the same limitation documented for Sprites in `docs/future-plans/sprites-migration.md` (Sprites can't reach `.internal` because they're on a different network; similarly, `.internal` doesn't route through Fly Proxy for auto-start).

**Solution:** Use **Flycast** instead of `.internal` DNS. Flycast allocates a private IPv6 address that routes through Fly Proxy, enabling auto-start for stopped Machines. The relay connects to the VM via `http://vm-app.flycast:3001` instead of `http://vm-app.internal:3001`.

**Validation step (Phase 4d):** After deploying the VM, manually stop it (`fly machine stop`), then curl the Flycast address from the relay Machine. If auto-start works → proceed. If not → fall back to the Machines API (`fly machine start`) triggered from the relay on ECONNREFUSED (would require additional code in `forwardToVM()` — not scoped in this plan; treat as a blocker and investigate).

> **Config change from brainstorm:**
> - `CLAUDE_HOST`: `http://vm-app.flycast:3001` (not `.internal`)
> - `RELAY_CALLBACK_URL`: `http://relay-app.flycast:3000` (not `.internal`)

### Risk 2 (Critical): Cold Start Retry Window Too Short

**Issue:** Current `forwardToVM()` retries once after 4 seconds (`server.js:464-467`). Fly.io Machine cold start for this Docker image (Node 22 + Chromium + Playwright + Claude Code) will be 10-20 seconds. The single retry will fail, and the user gets an error despite seeing "Waking up...".

**Solution:** Replace the single 4s retry with a polling loop:
- Send "Waking up..." message once on first ECONNREFUSED
- Retry every 3 seconds for up to 30 seconds total
- Check VM `/health` endpoint (lightweight) instead of re-sending the full `/command`
- Once `/health` responds OK, send the original `/command`

### Risk 3 (Critical): VM Auto-Stops During Approval Window

**Issue:** The VM's `IDLE_TIMEOUT_MS` defaults to 30 minutes. The relay's `APPROVAL_TIMEOUT_MS` is also 30 minutes. If a command returns with `approvalRequired: true` and the user takes 20 minutes to review diffs, the VM will shut itself down. When the relay sends `POST /approve`, the VM is gone — and its in-memory approval state is lost.

**Solution:** Set `IDLE_TIMEOUT_MS=3600000` (60 minutes) in production. This ensures the VM stays alive longer than the approval window. Cost impact is negligible since it's pay-per-use.

### Risk 4 (High): Image Proxy Fails When VM Is Stopped

**Issue:** Twilio fetches images asynchronously (5-60s after the relay sends the message). If the VM auto-stops between response delivery and Twilio's image fetch, the relay's image proxy (`server.js:59-83`) gets ECONNREFUSED and returns 502 to Twilio → broken image for the user.

**Solution:** Accept this for MVP. The VM's 60-minute idle timeout (Risk 3 fix) makes this extremely unlikely in practice — the VM won't stop within seconds of serving a response. If it becomes an issue later, the relay can cache images on first proxy fetch.

## Implementation Phases

### Phase 1: Code Changes (Small — 3 files)

These are the only code changes. Everything else is config/infrastructure.

#### 1a. Make `IMAGES_DIR` configurable

**File:** `vm/vm-server.js:24`

```javascript
// Before
const IMAGES_DIR = "/tmp/images";

// After
const IMAGES_DIR = process.env.IMAGES_DIR || "/tmp/images";
```

No other changes needed — the cleanup interval (`vm-server.js:392-425`) and path traversal check (`vm-server.js:254-262`) already reference the `IMAGES_DIR` constant.

**File:** `vm/Dockerfile:47` — Keep the existing `/tmp/images` creation for local dev. Add `/data/images` creation for production:

```dockerfile
# Before
RUN mkdir -p /tmp/images && chown appuser:appuser /tmp/images

# After
RUN mkdir -p /tmp/images /data/images && chown appuser:appuser /tmp/images /data/images
```

> Note: In production, Fly Volume mounts at `/data` will override the container's `/data` directory. Creating it in the Dockerfile is a fallback for local dev / Volume-less runs.

#### 1b. Cold start UX + retry loop in relay

**File:** `server.js:438-474` — Replace the `forwardToVM` function's catch block:

```javascript
// Current: single 4s retry
catch (err) {
  if (err.cause?.code === "ECONNREFUSED" || err.message.includes("ECONNREFUSED")) {
    console.log("[RETRY] VM connection refused, retrying in 4s (cold start?)");
    await new Promise((r) => setTimeout(r, 4000));
    return await doFetch();
  }
  throw err;
}

// New: "Waking up..." + health-check polling loop
catch (err) {
  if (err.cause?.code === "ECONNREFUSED" || err.message.includes("ECONNREFUSED")) {
    console.log("[COLD-START] VM not reachable, sending wake-up notice");
    await sendMessage(from, "⏳ Waking up your VM...");

    // Poll /health every 3s for up to 30s
    const MAX_WAIT = 30_000;
    const POLL_INTERVAL = 3_000;
    const start = Date.now();

    while (Date.now() - start < MAX_WAIT) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL));
      try {
        const healthRes = await fetch(`${CLAUDE_HOST}/health`, {
          signal: AbortSignal.timeout(2_000),
        });
        if (healthRes.ok) {
          console.log("[COLD-START] VM is up, sending command");
          return await doFetch();
        }
      } catch {
        // Still waking up, keep polling
      }
    }

    // Final attempt after max wait
    console.log("[COLD-START] Max wait reached, final attempt");
    return await doFetch();
  }
  throw err;
}
```

#### 1c. Add SIGTERM handler to relay

**File:** `server.js` — Add at end of file (near existing server.listen):

```javascript
process.on("SIGTERM", () => {
  console.log("[SHUTDOWN] SIGTERM received, closing server");
  server.close(() => {
    console.log("[SHUTDOWN] Server closed");
    process.exit(0);
  });
  // Force exit after 10s if connections don't drain
  setTimeout(() => process.exit(0), 10_000);
});
```

### Phase 2: Relay Dockerfile

**New file:** `Dockerfile` (project root)

```dockerfile
FROM node:22-slim

RUN useradd -m -s /bin/bash appuser

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --production

COPY server.js ./

RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 3000

CMD ["node", "server.js"]
```

Simple — no Chromium, no Playwright. Three dependencies (`dotenv`, `express`, `twilio`). The `dotenv` library gracefully no-ops when no `.env` file exists (which is the case on Fly.io where secrets are injected as env vars).

**Update `.dockerignore`:** The existing `.dockerignore` already excludes `.env`, `node_modules`, `.git`, `docs/`, etc. No changes needed.

### Phase 3: Fly.io Configuration

#### 3a. Relay `fly.toml`

**New file:** `fly.toml` (project root)

```toml
app = "textslash-relay"
primary_region = "ord"

[build]

[env]
  PORT = "3000"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = "off"
  auto_start_machines = true
  min_machines_running = 1

[[vm]]
  size = "shared-cpu-1x"
  memory = "512mb"
```

- **Always-on:** `auto_stop_machines = "off"`, `min_machines_running = 1`
- **Public HTTPS:** Twilio webhooks hit `https://textslash-relay.fly.dev/webhook`
- **Minimal resources:** 512MB RAM is plenty for Express + Twilio SDK
- **Region:** `ord` (Chicago) — good US latency, pick based on preference

#### 3b. VM `fly.toml`

**New file:** `vm/fly.toml`

```toml
app = "textslash-vm"
primary_region = "ord"

[build]

[env]
  PORT = "3001"
  IMAGES_DIR = "/data/images"
  IDLE_TIMEOUT_MS = "3600000"
  ENABLE_TEST_APP = "false"

[http_service]
  internal_port = 3001
  force_https = false
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 0

[checks]
  [checks.health]
    port = 3001
    type = "http"
    interval = "30s"
    timeout = "5s"
    path = "/health"

[[vm]]
  size = "shared-cpu-2x"
  memory = "2048mb"

[mounts]
  source = "vm_data"
  destination = "/data"
```

- **Auto-stop/start:** Machine stops when idle, Fly Proxy wakes on request
- **Private-only:** Public IPs released after deploy (Phase 4d), then Flycast allocated. VM is only reachable from the relay over private network.
- **Volume:** `vm_data` mounted at `/data` — persists images at `/data/images`
- **2GB RAM:** Chromium + Playwright + Claude Code needs headroom. Start here, monitor, scale to 4GB if OOM
- **Health check:** Fly uses `/health` to determine readiness after cold start
- **60-min idle timeout:** Outlasts the 30-min approval window (Risk 3 fix)

### Phase 4: Deploy

Execute in this order — each step depends on the previous.

#### 4a. Create Fly.io apps

```bash
# From project root (names must be globally unique on Fly.io — adjust if taken)
fly apps create textslash-relay
fly apps create textslash-vm
```

#### 4b. Create Volume for VM

```bash
fly volumes create vm_data --app textslash-vm --region ord --size 3
```

3GB Volume (~$0.45/month).

#### 4c. Set secrets on both apps

**Relay secrets:**
```bash
fly secrets set \
  TWILIO_ACCOUNT_SID="..." \
  TWILIO_AUTH_TOKEN="..." \
  TWILIO_WHATSAPP_NUMBER="+14155238886" \
  PUBLIC_URL="https://textslash-relay.fly.dev" \
  ALLOWED_PHONE_NUMBERS="+1XXXXXXXXXX" \
  CLAUDE_HOST="http://textslash-vm.flycast:3001" \
  --app textslash-relay
```

**VM secrets:**
```bash
fly secrets set \
  ANTHROPIC_API_KEY="..." \
  GITHUB_TOKEN="..." \
  RELAY_CALLBACK_URL="http://textslash-relay.flycast:3000" \
  --app textslash-vm
```

> Note: `IMAGES_DIR`, `IDLE_TIMEOUT_MS`, `PORT`, and `ENABLE_TEST_APP` are set in `fly.toml` `[env]` since they're not sensitive.

#### 4d. Deploy VM first (private, no external traffic)

```bash
cd vm && fly deploy --app textslash-vm
```

After deploy:
- **Make VM private-only** (critical — otherwise `/command` is publicly accessible):
  ```bash
  # List IPs — note the public ones
  fly ips list --app textslash-vm
  # Release public IPs (fly deploy allocates these by default)
  fly ips release <public-ipv4> --app textslash-vm
  fly ips release <public-ipv6> --app textslash-vm
  # Allocate Flycast (private, routed through Fly Proxy for auto-start)
  fly ips allocate-v6 --private --app textslash-vm
  ```
- Verify health from relay: `fly ssh console --app textslash-relay -C "curl -s http://textslash-vm.flycast:3001/health"`
- **Test auto-start (Risk 1 validation):** `fly machine stop <machine-id> --app textslash-vm`, wait 5s, repeat the health curl. If the VM wakes → Flycast auto-start works. If ECONNREFUSED → investigate before proceeding.

#### 4e. Deploy relay (public, but Twilio still pointing to ngrok)

```bash
# From project root (uses root fly.toml + root Dockerfile)
fly deploy --app textslash-relay
```

After deploy:
- Allocate Flycast address (for VM→relay callbacks): `fly ips allocate-v6 --private --app textslash-relay`
- Verify public health: `curl https://textslash-relay.fly.dev/health`
- Verify relay→VM connectivity: `fly ssh console --app textslash-relay -C "curl -s http://textslash-vm.flycast:3001/health"`

#### 4f. Update Twilio webhook (the cutover moment)

In the Twilio Console:
1. Navigate to: Messaging → Try it out → Send a WhatsApp message → Sandbox Configuration
2. Change webhook URL from `https://xxxx.ngrok-free.app/webhook` to `https://textslash-relay.fly.dev/webhook`
3. Save

**Rollback:** If anything breaks, change the webhook back to the ngrok URL. Keep ngrok running until you've confirmed production works.

### Phase 5: Verification

- [ ] `curl https://textslash-relay.fly.dev/health` → `{"status":"ok"}`
- [ ] Close laptop, send WhatsApp message, get a response
- [ ] Test cold start: `fly machine stop <vm-id>`, send WhatsApp message → see "Waking up..." → get response
- [ ] Test screenshot: ask for a screenshot → image delivered in WhatsApp
- [ ] Test approval flow: trigger a code change → receive diffs → reply "approve" → PR created
- [ ] Test cancel: send a command → immediately reply "cancel" → command cancelled
- [ ] Check `fly logs --app textslash-relay` and `fly logs --app textslash-vm` for errors

## Acceptance Criteria

### Functional Requirements

- [ ] Send a WhatsApp message with laptop closed → receive a response
- [ ] Cold start sends "Waking up..." message, then processes the command successfully
- [ ] Screenshots are delivered as WhatsApp images (persisted on Volume across VM restarts)
- [ ] Approval flow works: diffs displayed, "approve" creates PR, "reject" rolls back
- [ ] Progress messages ("Working on it...", etc.) are delivered during long commands
- [ ] Cancel command stops in-progress work
- [ ] VM auto-stops after 60 minutes of idle
- [ ] VM auto-starts when relay sends a new command

### Non-Functional Requirements

- [ ] Cold start time < 30 seconds (measured from first ECONNREFUSED to successful response)
- [ ] Relay responds to Twilio webhook within 15 seconds (Twilio timeout)
- [ ] No secrets in fly.toml or committed files — all sensitive values via `fly secrets set`
- [ ] Local development (`docker-compose up` + `node server.js`) still works unchanged

## Dependencies & Risks

### Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| Fly.io account | Required | Sign up at fly.io, add billing |
| `flyctl` CLI | Required | `brew install flyctl` |
| Twilio Console access | Required | To update webhook URL |
| Working Phase 6 (local e2e) | Done | All flows verified locally |

### Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Flycast doesn't trigger auto-start | Blocking | Test immediately after deploy (Phase 4d). If Flycast fails, investigate before proceeding — Machines API fallback is out of scope |
| VM publicly accessible after deploy | Critical | Release public IPs immediately after `fly deploy` completes (Phase 4d), before Twilio cutover |
| VM OOMs on 2GB | High | Monitor `fly logs`. Scale to 4GB if needed (`fly scale memory 4096 --app textslash-vm`) |
| Cold start exceeds 30s | High | Increase `MAX_WAIT` in retry loop. Consider keeping VM warm longer |
| Twilio webhook signature mismatch | Medium | `PUBLIC_URL` must exactly match Twilio's configured webhook URL. Test thoroughly |
| Relay restart loses in-memory state | Low | Deferred to post-deploy enhancements. Single-user impact is minimal — resend message |

## Known Limitations (MVP, Documented)

1. **Working directory is ephemeral.** Git repos and uncommitted changes are lost when the VM stops. Only `/data/images` persists via Volume. Git repo persistence deferred to `docs/future-plans/post-deploy-enhancements.md`.
2. **Relay state is in-memory.** If the relay restarts mid-conversation, user state resets to idle. Persistence deferred to `docs/future-plans/post-deploy-enhancements.md`.
3. **No monitoring/alerting.** Logs available via `fly logs` but not persisted. Acceptable for single-user MVP.
4. **No callback auth.** VM→relay callbacks (`POST /callback/:phone`) are trusted over private network. Auth deferred to multi-user phase.

## Deliverables Summary

| File | Action | Description |
|------|--------|-------------|
| `vm/vm-server.js` | Edit | Make `IMAGES_DIR` configurable via env var |
| `vm/Dockerfile` | Edit | Add `/data/images` directory creation |
| `server.js` | Edit | Cold start "Waking up..." + retry loop, SIGTERM handler |
| `Dockerfile` | Create | Relay container image (Node.js slim, 3 deps) |
| `fly.toml` | Create | Relay Fly.io config (always-on, public HTTPS) |
| `vm/fly.toml` | Create | VM Fly.io config (auto-stop, Volume, Flycast-only) |

## Config Changes (Local → Production)

| Config | Local | Production |
|--------|-------|------------|
| `PUBLIC_URL` | `https://xxxx.ngrok-free.app` | `https://textslash-relay.fly.dev` |
| `CLAUDE_HOST` | `http://localhost:3001` | `http://textslash-vm.flycast:3001` |
| `RELAY_CALLBACK_URL` | `http://host.docker.internal:3000` | `http://textslash-relay.flycast:3000` |
| `ENABLE_TEST_APP` | `true` | `false` |
| `IMAGES_DIR` | `/tmp/images` (default) | `/data/images` (Volume) |
| `IDLE_TIMEOUT_MS` | `1800000` (30 min) | `3600000` (60 min) |
| Twilio webhook | ngrok URL | `https://textslash-relay.fly.dev/webhook` |
| Secrets | `.env` files | `fly secrets set` |

## References & Research

### Internal References

- Brainstorm: `docs/brainstorms/2026-02-27-phase-7-deploy-brainstorm.md`
- Phase plan: `docs/plans/phases/07-phase-deploy.md`
- Sprites investigation: `docs/future-plans/sprites-migration.md`
- Post-deploy enhancements: `docs/future-plans/post-deploy-enhancements.md`
- Architecture: `ARCHITECTURE.md`
- Security: `SECURITY.md`

### Key Code Paths

- Relay `forwardToVM()`: `server.js:438-474` — cold start retry logic
- Relay image proxy: `server.js:59-83` — proxies VM images for Twilio
- VM idle shutdown: `vm/vm-server.js:451-457` — `IDLE_TIMEOUT_MS` + `process.exit(0)`
- VM SIGTERM handler: `vm/vm-server.js:428-434` — graceful child process cleanup
- VM image dir: `vm/vm-server.js:24` — hardcoded `/tmp/images` to make configurable
- VM Dockerfile: `vm/Dockerfile:47` — `/tmp/images` directory creation
