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

**Status:** PARTIAL PASS (code complete, deploy pending)
**Reviewed:** 2026-02-27

### Context

Phase 7 has two distinct halves: (1) code/config changes to make the system deployable, and (2) the actual Fly.io deployment + Twilio cutover. This review covers half 1. Half 2 requires a Fly.io account and is manual infrastructure work.

### Validation Results

| Criterion | Status | Evidence |
|-----------|--------|----------|
| `fly.toml` for VM container | PASS | `vm/fly.toml` — auto-stop, 2GB RAM, Volume mount, health check, 60-min idle |
| `fly.toml` for relay server | PASS | `fly.toml` — always-on, public HTTPS, 512MB |
| Relay Dockerfile | PASS | `Dockerfile` — Node 22 slim, npm ci, runs as appuser. `docker build --check` passes |
| VM Dockerfile updated | PASS | `/data/images` dir added alongside `/tmp/images`. `docker compose build` passes |
| `IMAGES_DIR` configurable | PASS | `process.env.IMAGES_DIR \|\| "/tmp/images"` in vm-server.js |
| Cold-start UX | PASS | Health-check polling (3s interval, 30s max) + "Waking up..." notification. Tested locally — ECONNREFUSED detected, message sent, polling ran |
| SIGTERM graceful shutdown | PASS | `server.close()` + 10s force exit. Standard Fly.io pattern |
| Local dev still works | PASS | `docker compose build vm` succeeds, `curl localhost:3001/health` returns OK, WhatsApp flow works with VM up |
| JS syntax | PASS | `node -c` passes on both server.js and vm-server.js |
| TOML syntax | PASS | `taplo lint` passes on both fly.toml files |
| Docker image pushed to Fly.io registry | NOT YET | Requires `fly deploy` — infrastructure step |
| Twilio webhook URL updated | NOT YET | Requires Fly.io deploy + Twilio Console update |
| `.env.production` | N/A | Superseded by `fly secrets set` + `fly.toml [env]` — no `.env.production` file needed |
| Relay-to-VM networking (Flycast) | NOT YET | Configured in plan (`fly.toml` uses Flycast addresses), validated after deploy |
| Secrets management | NOT YET | `fly secrets set` commands documented in plan, executed during deploy |

### Code Quality

Clean, minimal changes. 107 lines added across 6 files. No YAGNI violations. Cold-start retry is well-structured — polls health instead of blind retries. SIGTERM handler is standard. All changes follow existing codebase patterns.

### Issues Found

None. No P1 or P2 issues from self-review or simplicity pass.

### Tech Debt

- Cold-start "Waking up..." is sent even if the error is a transient network blip, not a stopped VM. Acceptable for MVP — on Fly.io private networking, ECONNREFUSED reliably means "VM is stopped."
- No `.env.production` file — production config lives in `fly secrets set` and `fly.toml [env]`. This is better than a committed file but diverges from the phase plan's original deliverable.

### Remaining Work (Infrastructure)

The following steps require a Fly.io account and are executed manually per the plan (`docs/plans/2026-02-27-feat-deploy-to-fly-io-plan.md` Phases 4-5):

1. `fly apps create` for both apps
2. `fly volumes create vm_data`
3. `fly secrets set` on both apps
4. `fly deploy` for both apps
5. Release VM public IPs, allocate Flycast
6. Update Twilio webhook URL
7. End-to-end verification (laptop closed test)

### Next Steps

Code is PR-ready (#8). Once merged and deployed to Fly.io, re-run this review to validate the infrastructure deliverables and flip status to PASS. The "done when" criterion — "close laptop, send WhatsApp, get response" — can only be validated after deploy.

## Notes

- This should be straightforward if Docker-first development was done properly. The exact same image runs on Fly.io.
- **Docker image size:** The image may be 1-2 GB (Chromium + Playwright + Claude Code). Use multi-stage builds if deploy times are slow. Fly.io charges for builder resources.
- **Machine sizing:** VM must accommodate Chromium + Claude Code in memory. Start with shared-cpu-1x / 1GB RAM (~$5/month). Monitor memory usage; may need 2GB (~$10/month).
- Fly.io Machines are always-on by default — no cold start concerns.
- The relay needs to know the VM's Fly.io URL. In single-user mode (your own deployment), this is hardcoded in `.env`. Multi-user routing comes in Phase 8.
- `/tmp/images/` is ephemeral on Fly.io — machine restarts clear it. Images need to persist long enough for the relay to fetch them. Consider a Fly.io volume mount or ensure the relay fetches images eagerly after each response.
- Test thoroughly: send a WhatsApp message from your phone with laptop closed. Every feature from Phase 6 should work identically.
- Cost: ~$5-10/month for the VM, ~$5/month for the relay = ~$10-15/month total.
