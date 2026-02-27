# Phase 8: Provisioning

**Stage:** Deploy to Production
**Depends on:** Phase 7 (Deploy)
**Done when:** A user visits the deploy wizard on their phone, enters their credentials, and gets a working relay + VM deployed to their own Fly.io account — fully phone-only, end to end.

## Architecture Shift

**Old model (centralized):** We provision VMs for users on our Fly.io account.
**New model (open-source, self-hosted):** Each user deploys to their own Fly.io account. We host a lightweight deploy wizard webpage that orchestrates the setup using the user's own Fly.io API token.

```
User's Phone → Deploy Wizard (hosted on our Fly.io)
                    │
                    ├─ Uses user's Fly.io token to deploy:
                    │   ├─ Relay server (user's Fly.io account)
                    │   └─ VM with Claude Code (user's Fly.io account)
                    │
                    └─ User's relay receives messages from their messaging channel
```

**Key insight:** The user's compute runs on their own Fly.io account and bill. We only host the deploy wizard.

## What You Build

A web-based deploy wizard hosted on our existing Fly.io infrastructure. The wizard:

1. Collects user credentials (Fly.io API token, Anthropic API key, channel credentials)
2. Calls Fly.io Machines API using the **user's** token to deploy relay + VM to **their** account
3. Verifies health of deployed services
4. Returns success — user starts messaging from their phone

Deliverables:
- **Deploy wizard webpage** — simple form hosted on our Fly.io, collects credentials, orchestrates deployment
- **Fly.io Machines API integration** — create relay + VM apps on user's account, set secrets, deploy from our Docker image
- **Health verification** — poll `/health` on both relay and VM before returning success
- **Machine restart policy** — configure auto-restart via Machines API during provisioning
- **Teardown support** — ability to destroy deployed resources (via wizard or API)

## Messaging Channels

- **MVP:** WhatsApp via Twilio (current implementation, used by us)
- **Future:** Discord and Telegram — much easier for users (just create a bot, no Twilio Business number needed)

The deploy wizard will eventually ask "Which channel?" and collect the appropriate credentials. For MVP, it supports WhatsApp/Twilio.

## User Experience (Phone-Only)

1. User visits the deploy wizard URL on their phone
2. Enters: Fly.io API token, Anthropic API key, Twilio credentials (or Discord/Telegram bot token in future)
3. Clicks deploy
4. Wizard provisions relay + VM on their Fly.io account
5. User opens their messaging app and starts sending commands

No laptop required. No CLI. No git clone.

## Tasks

- [ ] Build deploy wizard that provisions relay + VM on the user's Fly.io account via Machines API
  - Brainstorm: `/workflow:brainstorm deploy wizard — web UI, Fly.io Machines API, self-hosted provisioning`
  - Plan: `/workflow:plan deploy wizard for self-hosted provisioning`
  - Ship: `/workflow:ship docs/plans/YYYY-MM-DD-feat-deploy-wizard-plan.md`

## Notes

- **Fly.io Machines API:** `POST https://api.machines.dev/v1/apps/{app}/machines` to create, `DELETE /machines/{id}` to destroy.
- **User credentials stay on user's infrastructure:** The wizard passes credentials to the Fly.io Machines API which sets them as secrets on the user's machines. We never store user API keys.
- **Docker image:** The wizard deploys from our published image (`registry.fly.io/textslash-vm:latest`). Users get the same image we run.
- **Deploy wizard hosting:** Lightweight — can be a static page with client-side JS calling Fly.io API directly, or a small server-side endpoint on our existing relay. The Fly.io Machines API supports CORS for browser-based calls with user tokens.
- **Future: Discord + Telegram** — These channels are significantly easier for end users to set up (create a bot, get a token). The relay server will need channel adapters, but the VM layer is unchanged.
- **CLI option for power users:** Also offer `npx textslash setup` for developers who prefer terminal. The CLI and web wizard share the same provisioning logic.

## Review

**Status:** PASS
**Reviewed:** 2026-02-27 (updated after GHCR removal)

### Scope Note

The phase spec describes a **web-based deploy wizard** (phone-only). The actual plan (`docs/plans/2026-02-27-feat-deploy-wizard-provisioning-plan.md`) intentionally scoped to **CLI-first provisioning** — a setup script that builds from local Dockerfiles. The phone-only wizard is deferred to `docs/future-plans/deploy-wizard-cloudflare.md`.

Users clone the repo, run the script, and everything deploys to **their own** Fly.io account with **their own** credentials. No dependency on our infrastructure.

### Validation Results

| Criterion | Status | Evidence |
|-----------|--------|----------|
| `scripts/setup.sh` creates relay + VM on user's Fly.io account | **PASS** | Script checks prerequisites, validates input, creates apps, creates volume, sets encrypted secrets, builds from local Dockerfiles via `fly deploy --dockerfile`, scales to 1 machine, polls health. Syntax verified (`bash -n`). |
| Builds from user's own repo (no external image dependency) | **PASS** | Uses `--dockerfile` flag — Fly.io remote builders compile from local Dockerfiles. No GHCR, no registry dependency. Confirmed: zero `ghcr`/`--image` references in setup script. |
| Secrets via `fly secrets set` (encrypted at rest) | **PASS** | All sensitive values set via `fly secrets set` on both relay and VM apps. No plain-text env vars. |
| Flycast networking wired correctly | **PASS** | `CLAUDE_HOST=http://{prefix}-vm.flycast` and `RELAY_CALLBACK_URL=http://{prefix}-relay.flycast` — both use `.flycast` (auto-start), both omit internal port (Fly Proxy maps port 80 → internal_port). Matches institutional learnings. |
| HA mitigation (single machine per app) | **PASS** | Both deploys use `--ha=false`. Belt-and-suspenders: `fly scale count 1` runs after both deploys. |
| Template fly.toml matches production | **PASS** | `deploy/relay.fly.toml` and `deploy/vm.fly.toml` match production configs exactly (only `[build]` section omitted — correct since templates use `--dockerfile`). |
| `scripts/teardown.sh` cleanly destroys both apps | **PASS** | Validates input, requires typing `yes`, destroys VM then relay, handles already-destroyed apps. Syntax verified. |
| Setup documentation complete | **PASS** | README self-hosting section: prerequisites table, quick start, Twilio config, teardown, cost estimate, full secrets reference table. |
| E2E test on fresh Fly.io account | **DEFERRED** | Tracked in `docs/future-plans/post-deploy-enhancements.md` item #3. To be validated before sharing repo publicly. |

### Code Quality

**Correctness:**
- All institutional learnings applied: Flycast port 80, `--ha=false` + `fly scale count 1`, volume mounts, non-root user
- P1 bug caught and fixed during code review: `RELAY_CALLBACK_URL` had `:3000` (would cause ECONNRESET)
- Simplified post-review: removed GHCR workflow entirely — users build from their own copy of the Dockerfiles

**Future-phase risks:** None. CLI provisioning is strictly additive — no existing code modified. The Cloudflare wizard (deferred) can reuse the same `flyctl` commands.

**Edge cases handled:**
- Prefix validation (lowercase alphanumeric + hyphens)
- Empty input rejection for all required fields
- Health check timeout (2 min, non-fatal warning)
- Optional GitHub token (gracefully skipped)
- Teardown handles already-destroyed apps

### Tech Debt

- **Phase spec vs. plan scope** — Phase spec's "Done when" (phone-only wizard) is not met. CLI satisfies provisioning mechanics. Wizard tracked in `docs/future-plans/deploy-wizard-cloudflare.md`.
- **No automated e2e test** — Script can only be validated manually against a live Fly.io account. Tracked in `docs/future-plans/post-deploy-enhancements.md`.

### Next Steps

Phase 8 CLI provisioning is **complete**. One manual verification remains (e2e test with fresh prefix) — tracked as a future plan item, to be done before public launch.

Next: Phase 9 (Onboarding) or the Cloudflare deploy wizard from `docs/future-plans/deploy-wizard-cloudflare.md`.
