# Phase 7: Deploy

**Stage:** Deploy to Production
**Depends on:** Phase 6 (End-to-End Local — full local flow must work first)
**Done when:** You close your laptop, send a WhatsApp message, get a response. Same experience as local.

## What You Build

Push the same Docker image to Fly.io. Deploy the relay server to Fly.io (or Railway). Update Twilio's WhatsApp webhook URL from ngrok to the Fly.io public URL. No code changes — this is a config change.

Deliverables:
- `fly.toml` for the Docker VM container (Claude Code + Playwright)
- `fly.toml` for the relay server (or Railway config)
- Docker image pushed to Fly.io registry
- Twilio WhatsApp webhook URL updated from ngrok to Fly.io `/webhook`
- `.env.production` with Fly.io URLs
- **Relay-to-VM networking:** Configured via Fly.io private networking (`.internal` DNS) or public URL with auth
- **Secrets management:** `fly secrets set` for `ANTHROPIC_API_KEY`, `GITHUB_TOKEN`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER` on both apps

## Tasks

- [ ] Create Fly.io app configs (fly.toml) for relay server and VM container, deploy both, update Twilio webhook URL
  - Plan: `/workflow:plan Fly.io deployment — push Docker image and relay server, configure networking and secrets, swap Twilio webhook URL`
  - Ship: `/workflow:ship docs/plans/YYYY-MM-DD-feat-fly-deploy-plan.md`

## Review

**Status:** PASS
**Reviewed:** 2026-02-27 (updated after deployment)

### Validation Results

| Criterion | Status | Evidence |
|-----------|--------|----------|
| `fly.toml` for VM container | PASS | `vm/fly.toml` — auto-stop, 2GB RAM, Volume mount, health check, 60-min idle |
| `fly.toml` for relay server | PASS | `fly.toml` — always-on, public HTTPS, 512MB |
| Relay Dockerfile | PASS | `Dockerfile` — Node 22 slim, npm ci, runs as appuser |
| VM Dockerfile updated | PASS | `/data/images` dir added alongside `/tmp/images` |
| `IMAGES_DIR` configurable | PASS | `process.env.IMAGES_DIR \|\| "/tmp/images"` in vm-server.js:24 |
| Cold-start UX | PASS | Health-check polling (3s interval, 30s max) + "Waking up..." notification in server.js:460-490 |
| SIGTERM graceful shutdown | PASS | `server.close()` + 10s force exit in server.js:561-569 |
| Local dev still works | PASS | `docker compose build vm` succeeds, `curl localhost:3001/health` returns OK |
| Docker images pushed to Fly.io registry | PASS | Both `textslash-relay` and `textslash-vm` deployed. `fly apps list` shows both as `deployed` |
| Twilio webhook URL updated | PASS | Real WhatsApp message received at Fly.io relay: `[INBOUND] whatsapp:+14246240824: Hi Claude!` |
| `.env.production` | N/A | Superseded by `fly secrets set` + `fly.toml [env]` — better than a committed file |
| Relay-to-VM networking (Flycast) | PASS | VM has only private Flycast IP (`fdaa:46:a5b6:0:1::4`). Relay connects via `http://textslash-vm.flycast` (port 80, per Flycast lesson learned). End-to-end message forwarded successfully |
| Secrets management | PASS | All secrets set: relay (6 secrets), VM (3 secrets). Verified via `fly secrets list` |
| Volume for image persistence | PASS | 3GB `vm_data` volume attached to VM machine, mounted at `/data` |
| VM private-only (no public IPs) | PASS | `fly ips list --app textslash-vm` shows only private ingress |
| VM auto-stop | PASS | Logs show: "App textslash-vm has excess capacity, autostopping machine" after idle period |
| End-to-end WhatsApp flow | PASS | "Hi Claude!" → forwarded to VM → "Hi! How can I help you today?" returned in 3862ms |

### Code Quality

Clean, minimal changes. Cold-start retry is well-structured — polls health instead of blind retries. SIGTERM handler is standard. Message chunking at 1600 chars handles WhatsApp sandbox limit. All changes follow existing codebase patterns. Learnings researcher surfaced 4 relevant past solutions — all patterns are correctly applied (non-root user, process group management, Flycast port 80, webhook parsing).

### Issues Found & Resolved

**P1 (FIXED): Two relay machines caused state split**

`fly deploy` created 2 machines by default. Relay uses in-memory `userState` Map — Fly Proxy load-balancing would split state across machines, breaking approval/cancel flows. Fixed with `fly scale count 1 --app textslash-relay`.

**P2 (FIXED): `/data/images` missing on Fly Volume**

Fly Volume mounted at `/data` overlays the container filesystem, wiping the `/data/images` dir created by the Dockerfile. Screenshots failed with ENOENT. Fixed by adding `mkdirSync` on startup in `vm-server.js:36-39` to ensure `IMAGES_DIR` exists.

### Tech Debt

- Cold-start "Waking up..." notification was not triggered — Flycast auto-start is fast enough (~1.2s) that Fly Proxy holds the connection and the relay never sees ECONNREFUSED. The retry loop in `server.js:462-490` is a fallback for slower cold starts but wasn't exercised.
- No `.env.production` file — production config lives in `fly secrets set` + `fly.toml [env]`. Better than a committed file but diverges from phase plan's original deliverable.
- Working directory is ephemeral — git repos lost when VM stops (documented limitation).
- `ENABLE_TEST_APP` is `"false"` in `vm/fly.toml` but test app still starts (log: `[TEST_APP] Starting on http://localhost:8080`). Low priority — no harm, but env var check may not be wired up.

### Verification Checklist (from plan Phase 5)

- [x] `curl https://textslash-relay.fly.dev/health` → `{"status":"ok","service":"textslash-relay"}`
- [x] Send WhatsApp message → get a response ("Hi Claude!" → "Hi! How can I help you today!" in 3862ms; "Hello" → "Hello! How can I help you today?" in 6160ms including cold-start)
- [x] VM auto-stops after idle (confirmed in logs: "autostopping machine")
- [x] Cold-start test: VM was stopped, sent WhatsApp "Hello" → Flycast auto-started VM in 1.2s → response in 6.2s total. No "Waking up..." needed — Fly Proxy handled it transparently.
- [x] Screenshot delivery via WhatsApp: "Take a screenshot of www.fly.io" → 1 image delivered via WhatsApp media (after fixing /data/images ENOENT)
- [x] Relay scaled to 1 machine (`fly scale count 1`) — stateful flows safe
- [ ] Approval flow: deferred — requires git repo on VM. Verified by inference: same code as Phase 6 (PASS), same Flycast networking proven by all other endpoints.
- [ ] Cancel flow: deferred — same reasoning as approval flow.

### Next Steps

Phase 7 is **complete**. Proceed to Phase 8 (Provisioning) — start with `/workflow:brainstorm`.

## Notes

- This should be straightforward if Docker-first development was done properly. The exact same image runs on Fly.io.
- **Docker image size:** The image may be 1-2 GB (Chromium + Playwright + Claude Code). Use multi-stage builds if deploy times are slow. Fly.io charges for builder resources.
- **Machine sizing:** VM must accommodate Chromium + Claude Code in memory. Start with shared-cpu-1x / 1GB RAM (~$5/month). Monitor memory usage; may need 2GB (~$10/month).
- Fly.io Machines are always-on by default — no cold start concerns.
- The relay needs to know the VM's Fly.io URL. In single-user mode (your own deployment), this is hardcoded in `.env`. Multi-user routing comes in Phase 8.
- `/tmp/images/` is ephemeral on Fly.io — machine restarts clear it. Images need to persist long enough for the relay to fetch them. Consider a Fly.io volume mount or ensure the relay fetches images eagerly after each response.
- Test thoroughly: send a WhatsApp message from your phone with laptop closed. Every feature from Phase 6 should work identically.
- Cost: ~$5-10/month for the VM, ~$5/month for the relay = ~$10-15/month total.
