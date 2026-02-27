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
