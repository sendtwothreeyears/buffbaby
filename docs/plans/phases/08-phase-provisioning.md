# Phase 8: Provisioning

**Stage:** Deploy to Production
**Depends on:** Phase 7 (Deploy)
**Done when:** You call the provisioning API with test credentials, a new Fly.io VM is created, and you can text it via the relay.

## What You Build

Automated VM creation via the Fly.io Machines API. A backend endpoint that accepts user credentials (phone number, GitHub token, API keys) and creates a new Fly.io machine from the Docker base image, configured with those credentials. The relay is updated to route phone numbers to their assigned VM.

Deliverables:
- Provisioning endpoint: `POST /provision` accepts user credentials, calls Fly.io Machines API, returns VM URL
- VM created with Fly.io secrets for user credentials (Fly.io encrypts secrets at rest — no custom encryption layer needed for V1)
- **VM health check after creation:** Verify the machine responds on `/health` before returning success
- **Machine restart policy:** Configure auto-restart via Machines API during provisioning
- Relay updated to route phone numbers to their assigned VM (phone → VM mapping, initially in-memory or JSON file)
- Teardown endpoint: `DELETE /provision/:vmId` destroys the VM
- **Endpoint authentication:** `POST /provision` and `DELETE /provision` require a shared API key (set as env var on both relay and onboarding page in Phase 9)

## Tasks

- [ ] Build provisioning endpoint that calls Fly.io Machines API to create per-user VMs, verify health, and configure routing
  - Brainstorm: `/workflow:brainstorm Fly.io Machines API provisioning — create/destroy per-user VMs, health checks, secrets`
  - Plan: `/workflow:plan automated VM provisioning via Fly.io Machines API`
  - Ship: `/workflow:ship docs/plans/YYYY-MM-DD-feat-vm-provisioning-plan.md`

## Notes

- **Fly.io Machines API:** `POST https://api.machines.dev/v1/apps/{app}/machines` to create, `DELETE /machines/{id}` to destroy. Reference the PRD's example payload (image: `registry.fly.io/sms-cockpit-vm:latest`, services: port 3000).
- **Credential handling for V1:** Use `fly secrets set` to inject user credentials as environment variables on each machine. Fly.io encrypts these at rest. This avoids building a custom encryption layer for V1. Custom AES-256 encryption with per-user keys can be added later if needed.
- The phone → VM mapping doesn't need a database yet — can use a JSON file or in-memory store for testing. Phase 9 adds the real database.
- Test with a second phone number (or Twilio test credentials) to verify multi-user routing works.
- Consider VM lifecycle: Fly.io auto-restarts machines, but the relay should handle the VM being temporarily unavailable (retry with backoff, send "Your VM is restarting..." SMS).
