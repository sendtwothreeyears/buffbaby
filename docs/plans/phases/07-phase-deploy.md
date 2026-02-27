# Phase 7: Deploy

**Stage:** Deploy to Production
**Depends on:** Phase 6 (End-to-End Local — full local flow must work first)
**Done when:** You close your laptop, text the Twilio number, get a response. Same experience as local.

## What You Build

Push the same Docker image to Fly.io. Deploy the relay server to Fly.io (or Railway). Update Twilio's webhook URL from ngrok to the Fly.io public URL. No code changes — this is a config change.

Deliverables:
- `fly.toml` for the Docker VM container (Claude Code + Playwright)
- `fly.toml` for the relay server (or Railway config)
- Docker image pushed to Fly.io registry
- Twilio webhook URL updated from ngrok to Fly.io
- `.env.production` with Fly.io URLs
- **Relay-to-VM networking:** Configured via Fly.io private networking (`.internal` DNS) or public URL with auth
- **Secrets management:** `fly secrets set` for `ANTHROPIC_API_KEY`, `GITHUB_TOKEN`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` on both apps

## Tasks

- [ ] Create Fly.io app configs (fly.toml) for relay server and VM container, deploy both, update Twilio webhook URL
  - Plan: `/workflow:plan Fly.io deployment — push Docker image and relay server, configure networking and secrets, swap Twilio webhook URL`
  - Ship: `/workflow:ship docs/plans/YYYY-MM-DD-feat-fly-deploy-plan.md`

## Notes

- This should be straightforward if Docker-first development was done properly. The exact same image runs on Fly.io.
- **Docker image size:** The image may be 1-2 GB (Chromium + Playwright + Claude Code). Use multi-stage builds if deploy times are slow. Fly.io charges for builder resources.
- **Machine sizing:** VM must accommodate Chromium + Claude Code in memory. Start with shared-cpu-1x / 1GB RAM (~$5/month). Monitor memory usage; may need 2GB (~$10/month).
- Fly.io Machines are always-on by default — no cold start concerns.
- The relay needs to know the VM's Fly.io URL. In single-user mode (your own deployment), this is hardcoded in `.env`. Multi-user routing comes in Phase 8.
- `/tmp/images/` is ephemeral on Fly.io — machine restarts clear it. Images need to persist long enough for the relay to fetch them. Consider a Fly.io volume mount or ensure the relay fetches images eagerly after each response.
- Test thoroughly: text from your phone with laptop closed. Every feature from Phase 6 should work identically.
- Cost: ~$5-10/month for the VM, ~$5/month for the relay = ~$10-15/month total.
