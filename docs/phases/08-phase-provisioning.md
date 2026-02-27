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

**Status:** PARTIAL PASS
**Reviewed:** 2026-02-27

### Scope Note

The phase spec describes a **web-based deploy wizard** (phone-only, no CLI). The actual plan (`docs/plans/2026-02-27-feat-deploy-wizard-provisioning-plan.md`) intentionally scoped this to **CLI-first provisioning** — a setup script + GHCR images — deferring the phone-only wizard to `docs/future-plans/deploy-wizard-cloudflare.md`. This was a deliberate architectural decision: prove the provisioning mechanics via CLI first, then layer the wizard UI on top.

The review validates against the **plan's acceptance criteria**, not the original phase spec's "Done when."

### Validation Results

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Docker images published to GHCR on push to `main` | **PASS** | GHA workflow `publish-images.yml` triggered on merge of PR #11. Run #22506474132 completed successfully. Both matrix jobs (`publish (relay, .)` and `publish (vm, ./vm)`) succeeded. |
| Images are publicly pullable (no auth required) | **UNVERIFIED** | Cannot check via CLI (gh token lacks `read:packages` scope). Requires manual check: GitHub Settings → Packages → set visibility to public. |
| `scripts/setup.sh` creates relay + VM on a fresh Fly.io account | **PASS (code review)** | Script correctly: checks prerequisites (flyctl + auth), validates prefix, collects config + secrets, creates apps, creates volume, sets secrets via `fly secrets set`, deploys from GHCR with `--ha=false`, scales to 1 machine, polls health with timeout. Shell syntax verified via `bash -n`. Not tested against live Fly.io account. |
| Secrets are set via `fly secrets set` (encrypted at rest) | **PASS** | Setup script uses `fly secrets set` for all sensitive values on both relay and VM apps. No plain-text env vars. |
| Relay and VM communicate via Flycast (`CLAUDE_HOST` wiring works) | **PASS** | `CLAUDE_HOST=http://{prefix}-vm.flycast` (no port — correct per Flycast lesson). `RELAY_CALLBACK_URL=http://{prefix}-relay.flycast` (no port — fixed during code review, was originally `:3000`). Both use `.flycast` for auto-start. |
| User can send a WhatsApp message and get a response | **UNVERIFIED** | Requires live deployment + Twilio webhook configuration. Cannot test without infrastructure. |
| `scripts/teardown.sh` cleanly destroys both apps | **PASS (code review)** | Script validates input, requires `yes` confirmation, destroys VM first then relay, handles "not found" gracefully. Shell syntax verified. |
| Setup documentation is clear and complete | **PASS** | README self-hosting section covers: prerequisites table, quick start, Twilio webhook config, teardown, cost estimate, full configuration reference table with all secrets. |
| Whole flow tested end-to-end on a fresh Fly.io account | **UNVERIFIED** | Not tested. Requires live infrastructure. |

### Code Quality

**Correctness:**
- All institutional learnings applied: Flycast port 80 (no `:3001`/`:3000`), `--ha=false` + `fly scale count 1`, volume mounts, non-root user
- Template fly.toml files match production configs (only diff: `[build]` section correctly omitted since templates use `--image`)
- GHA workflow uses matrix strategy for DRY (relay + VM as parallel matrix jobs)
- P1 bug caught and fixed during code review: RELAY_CALLBACK_URL had `:3000`

**Future-phase risks:** None identified. CLI provisioning is strictly additive — no existing code modified. The wizard (deferred) can reuse the same Fly.io API calls.

**Edge cases handled:**
- Prefix validation (lowercase alphanumeric + hyphens)
- Empty input rejection for all required fields
- Health check timeout (2 min max, non-fatal)
- Optional GitHub token (gracefully skipped if empty)
- Teardown handles already-destroyed apps

### Issues Found

- **[P2] GHCR package visibility unverified** — images may default to private. Must set to public in GitHub Settings → Packages after first workflow run. Without this, `fly deploy --image` will 401 for other users.

### Tech Debt

- **Phase spec vs. plan mismatch** — The phase spec's "Done when" (phone-only wizard) is not met. The CLI approach satisfies the provisioning mechanics but not the full phase vision. The wizard is tracked in `docs/future-plans/deploy-wizard-cloudflare.md`.
- **No automated e2e test** — Setup script can only be validated manually against a live Fly.io account. Consider a dry-run mode or integration test for CI.

### Next Steps

Phase 8 provisioning mechanics are **code-complete**. Two manual verification items remain:
1. Set GHCR package visibility to public in GitHub Settings
2. Run `scripts/setup.sh` against a fresh Fly.io account to validate end-to-end

The phone-only deploy wizard (original phase spec vision) is deferred to a future plan. Next phase in the roadmap: Phase 9 (Onboarding) or the Cloudflare deploy wizard from `docs/future-plans/`.
