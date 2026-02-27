---
title: "Self-Hosted Provisioning (Phase 8)"
type: feat
status: active
date: 2026-02-27
---

# Self-Hosted Provisioning (Phase 8)

## Overview

Enable anyone to deploy their own textslash stack (relay + VM) to their own Fly.io account using a setup script and published Docker images. The user clones the repo, runs a script, and has a working deployment.

```
User's Laptop
    │
    │  git clone → scripts/setup.sh
    │  Script uses flyctl to create apps, set secrets, deploy from GHCR images:
    │
    ▼
User's Fly.io Account
    ├── {prefix}-relay  (receives WhatsApp messages, always-on)
    └── {prefix}-vm     (Claude Code + Playwright + Volume, auto-stop)
```

**Done when:** A user clones the repo, runs the setup script, enters their credentials, and gets a working relay + VM on their own Fly.io account — then opens WhatsApp and sends their first command.

**Deferred:** Phone-only deploy wizard (Cloudflare Pages) — see `docs/future-plans/deploy-wizard-cloudflare.md`. Ships after the provisioning mechanics are proven via CLI.

## Problem Statement / Motivation

Phase 7 deployed textslash to Fly.io, but only for us. To make this an open-source tool anyone can use, users need a way to deploy their own instance. A setup script + published Docker images is the simplest path — no new infrastructure, no proxy, no web UI. The phone-only wizard builds on top of this later.

## Proposed Solution

Three deliverables:

1. **Docker images on GHCR** — public images anyone's Fly.io account can pull
2. **Setup script** (`scripts/setup.sh`) — interactive script that creates apps, sets secrets, deploys machines via `flyctl`
3. **Setup documentation** — step-by-step guide in README for manual setup or script usage

### Key Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Docker registry | **GHCR** (`ghcr.io/sendtwothreeyears/textslash-relay`, `ghcr.io/sendtwothreeyears/textslash-vm`) | Public, no auth needed for pulls, aligns with GitHub workflow |
| Provisioning method | `flyctl` CLI via setup script | Users already need a Fly.io account; flyctl is the standard tool. Uses `fly secrets set` (encrypted at rest) instead of plain env vars. |
| App naming | User-chosen prefix → `{prefix}-relay`, `{prefix}-vm` | Simple, memorable, globally unique |
| Secrets | `fly secrets set` (encrypted at rest) | Proper encrypted storage — better than Machines API env vars |
| Teardown | `scripts/teardown.sh` | Simple script: `fly apps destroy {prefix}-relay` + `fly apps destroy {prefix}-vm` |

### Why CLI-First (Not Wizard-First)

1. **Simpler** — no proxy server, no credential forwarding, no web UI, no Cloudflare setup
2. **More secure** — credentials stay on user's machine, `fly secrets set` encrypts at rest
3. **Proves the mechanics** — if the setup script works, the wizard is just a UI layer on the same Fly.io API endpoints

## Technical Approach

### Step 1: Publish Docker Images to GHCR

**New file:** `.github/workflows/publish-images.yml`

GitHub Actions workflow:
1. Trigger: push to `main` (or manual `workflow_dispatch`)
2. Build relay image from `./Dockerfile`
3. Build VM image from `./vm/Dockerfile`
4. Push to GHCR:
   - `ghcr.io/sendtwothreeyears/textslash-relay:latest` + SHA tag
   - `ghcr.io/sendtwothreeyears/textslash-vm:latest` + SHA tag
5. Set package visibility to public (GitHub repo Settings → Packages)

```yaml
# .github/workflows/publish-images.yml
name: Publish Docker Images
on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            ghcr.io/${{ github.repository_owner }}/textslash-relay:latest
            ghcr.io/${{ github.repository_owner }}/textslash-relay:${{ github.sha }}
      - uses: docker/build-push-action@v5
        with:
          context: ./vm
          push: true
          tags: |
            ghcr.io/${{ github.repository_owner }}/textslash-vm:latest
            ghcr.io/${{ github.repository_owner }}/textslash-vm:${{ github.sha }}
```

### Step 2: Setup Script

**New file:** `scripts/setup.sh`

Interactive Bash script that:
1. Checks prerequisites (`flyctl` installed, user logged in)
2. Prompts for credentials and configuration
3. Creates Fly.io apps, volumes, and machines
4. Sets secrets (encrypted at rest via `fly secrets set`)
5. Deploys from GHCR images
6. Polls health endpoints
7. Prints success message with next steps

**Script flow:**

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "=== textslash setup ==="
echo ""

# 1. Check prerequisites
command -v flyctl >/dev/null 2>&1 || { echo "Error: flyctl not installed. Visit https://fly.io/docs/flyctl/install/"; exit 1; }
fly auth whoami >/dev/null 2>&1 || { echo "Error: Not logged in. Run: fly auth login"; exit 1; }

# 2. Collect configuration
read -p "App name prefix (e.g., 'myname'): " PREFIX
read -p "Fly.io org slug [personal]: " ORG_SLUG
ORG_SLUG=${ORG_SLUG:-personal}
read -p "Region [ord]: " REGION
REGION=${REGION:-ord}

# 3. Collect secrets
read -p "Anthropic API key: " ANTHROPIC_API_KEY
read -p "Twilio Account SID: " TWILIO_ACCOUNT_SID
read -p "Twilio Auth Token: " TWILIO_AUTH_TOKEN
read -p "Twilio WhatsApp number (e.g., +14155238886): " TWILIO_WHATSAPP_NUMBER
read -p "Your phone number (e.g., +1XXXXXXXXXX): " ALLOWED_PHONE_NUMBERS
read -p "GitHub token (optional, press Enter to skip): " GITHUB_TOKEN

# 4. Create apps
echo "Creating ${PREFIX}-relay..."
fly apps create "${PREFIX}-relay" --org "$ORG_SLUG"

echo "Creating ${PREFIX}-vm..."
fly apps create "${PREFIX}-vm" --org "$ORG_SLUG"

# 5. Create VM volume
echo "Creating volume for VM..."
fly volumes create vm_data --app "${PREFIX}-vm" --region "$REGION" --size 3 --yes

# 6. Set secrets (encrypted at rest)
echo "Setting relay secrets..."
fly secrets set \
  TWILIO_ACCOUNT_SID="$TWILIO_ACCOUNT_SID" \
  TWILIO_AUTH_TOKEN="$TWILIO_AUTH_TOKEN" \
  TWILIO_WHATSAPP_NUMBER="$TWILIO_WHATSAPP_NUMBER" \
  ALLOWED_PHONE_NUMBERS="$ALLOWED_PHONE_NUMBERS" \
  CLAUDE_HOST="http://${PREFIX}-vm.flycast" \
  PUBLIC_URL="https://${PREFIX}-relay.fly.dev" \
  --app "${PREFIX}-relay"

echo "Setting VM secrets..."
fly secrets set \
  ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  RELAY_CALLBACK_URL="http://${PREFIX}-relay.flycast:3000" \
  ${GITHUB_TOKEN:+GITHUB_TOKEN="$GITHUB_TOKEN"} \
  --app "${PREFIX}-vm"

# 7. Deploy from GHCR images using template fly.toml configs
#    --app overrides the app name in fly.toml, so no sed substitution needed
#    --config points to the template that defines services, checks, guest specs, volumes
echo "Deploying relay..."
fly deploy --app "${PREFIX}-relay" \
  --config deploy/relay.fly.toml \
  --image ghcr.io/sendtwothreeyears/textslash-relay:latest \
  --region "$REGION" --ha=false

echo "Deploying VM..."
fly deploy --app "${PREFIX}-vm" \
  --config deploy/vm.fly.toml \
  --image ghcr.io/sendtwothreeyears/textslash-vm:latest \
  --region "$REGION" --ha=false

# 8. Scale to 1 machine each (fly deploy creates 2 by default)
fly scale count 1 --app "${PREFIX}-relay" --yes
fly scale count 1 --app "${PREFIX}-vm" --yes

# 9. Wait for health
echo "Waiting for relay to be healthy..."
until curl -sf "https://${PREFIX}-relay.fly.dev/health" > /dev/null 2>&1; do
  sleep 5
  echo "  waiting..."
done
echo "Relay is healthy!"

echo ""
echo "=== Setup complete! ==="
echo ""
echo "Relay URL: https://${PREFIX}-relay.fly.dev"
echo ""
echo "Next steps:"
echo "1. Configure your Twilio webhook URL to: https://${PREFIX}-relay.fly.dev/webhook"
echo "2. If using Twilio Sandbox, send 'join <your-sandbox-code>' to the sandbox number"
echo "3. Send a WhatsApp message to start using textslash!"
```

**Key details:**
- Uses `fly deploy --image` to deploy from GHCR (no local Docker build needed)
- Uses `fly secrets set` for all sensitive values (encrypted at rest, unlike Machines API env vars)
- Uses `--ha=false` to prevent the 2-machine default (lesson from Phase 7)
- Falls back to `fly scale count 1` as belt-and-suspenders for the HA default

**Template fly.toml files:**

The script uses `fly deploy --config` to point at template fly.toml files that define services, health checks, guest specs, auto-stop, and volume mounts. The `--app` flag overrides the app name in the template, so no substitution is needed.

**New files:**
- `deploy/relay.fly.toml` — based on current `fly.toml` (services on port 3000, always-on, health check)
- `deploy/vm.fly.toml` — based on current `vm/fly.toml` (services on port 3001, auto-stop, volume mount at `/data`, 2GB RAM)

### Step 3: Teardown Script

**New file:** `scripts/teardown.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

read -p "App name prefix to destroy: " PREFIX

echo "This will destroy ${PREFIX}-relay and ${PREFIX}-vm (including all data)."
read -p "Are you sure? (yes/no): " CONFIRM
[ "$CONFIRM" = "yes" ] || { echo "Aborted."; exit 1; }

echo "Destroying ${PREFIX}-vm..."
fly apps destroy "${PREFIX}-vm" --yes 2>/dev/null || echo "  (not found or already destroyed)"

echo "Destroying ${PREFIX}-relay..."
fly apps destroy "${PREFIX}-relay" --yes 2>/dev/null || echo "  (not found or already destroyed)"

echo "Done. Both apps destroyed."
```

### Step 4: Setup Documentation

Add a **Self-Hosting** section to the README:

1. Prerequisites: Fly.io account, `flyctl`, Anthropic API key, Twilio account
2. Quick start: `git clone` → `./scripts/setup.sh`
3. Teardown: `./scripts/teardown.sh`
4. Cost estimate: ~$15-20/month
5. Configuration reference: env vars table (can point to `.env.example` files)

## Acceptance Criteria

- [x] Docker images published to GHCR on push to `main` (GitHub Actions workflow works)
- [ ] Images are publicly pullable (no auth required)
- [x] `scripts/setup.sh` creates relay + VM on a fresh Fly.io account
- [x] Secrets are set via `fly secrets set` (encrypted at rest)
- [x] Relay and VM communicate via Flycast (`CLAUDE_HOST` wiring works)
- [ ] User can send a WhatsApp message and get a response from their deployment
- [x] `scripts/teardown.sh` cleanly destroys both apps
- [x] Setup documentation is clear and complete
- [ ] Whole flow tested end-to-end on a fresh Fly.io account

## MVP File Changes

| File | Change |
|------|--------|
| `.github/workflows/publish-images.yml` | **New** — build + push Docker images to GHCR |
| `scripts/setup.sh` | **New** — interactive setup script |
| `scripts/teardown.sh` | **New** — teardown script |
| `deploy/relay.fly.toml` | **New** — template fly.toml for relay |
| `deploy/vm.fly.toml` | **New** — template fly.toml for VM |
| `README.md` or `docs/self-hosting.md` | Add self-hosting guide |

**No changes to:** `server.js`, `vm/vm-server.js`, `Dockerfile`, `vm/Dockerfile`, `package.json`

### Implementation Order

```
1. Publish Docker images to GHCR         (GitHub Actions workflow)
2. Template fly.toml files               (relay + VM)
3. Setup script                          (core provisioning)
4. Teardown script                       (cleanup)
5. Setup documentation                   (README/docs)
6. End-to-end test on fresh Fly.io account
```

## Inter-App Communication Wiring

Same as our Phase 7 deployment, but parameterized by prefix:

| Env Var | Set On | Value | Purpose |
|---------|--------|-------|---------|
| `CLAUDE_HOST` | Relay | `http://{prefix}-vm.flycast` | Relay → VM (port 80, Fly Proxy maps to 3001). Uses `.flycast` for auto-start. |
| `RELAY_CALLBACK_URL` | VM | `http://{prefix}-relay.flycast` | VM → Relay callbacks (port 80, Fly Proxy maps to 3000) |
| `PUBLIC_URL` | Relay | `https://{prefix}-relay.fly.dev` | Public URL for Twilio image proxy |

## Risk Analysis

| Risk | Impact | Mitigation |
|------|--------|-----------|
| `fly deploy --image` doesn't pick up fly.toml config | Machines created without correct services/checks | Test with template fly.toml. Fallback: use Machines API directly via `curl` in the script. |
| `flyctl` version differences | Script breaks on older versions | Document minimum `flyctl` version. Add version check to script. |
| GHCR images not publicly accessible | User's `fly deploy` gets 401 pulling image | Set package visibility to public in GitHub settings. Test with a fresh account. |
| User doesn't configure Twilio webhook | Relay deployed but never receives messages | Print clear instructions post-setup. Future: automate via Twilio API in the script. |
| `fly deploy` creates 2 machines by default | User pays double | Use `--ha=false` flag + `fly scale count 1` as fallback. |

## References

### Internal
- Brainstorm: `docs/brainstorms/2026-02-27-phase-8-provisioning-brainstorm.md`
- Phase spec: `docs/phases/08-phase-provisioning.md`
- Future wizard: `docs/future-plans/deploy-wizard-cloudflare.md`
- Phase 7 plan: `docs/plans/2026-02-27-feat-deploy-to-fly-io-plan.md`
- Current relay fly.toml: `fly.toml`
- Current VM fly.toml: `vm/fly.toml`

### External
- [Fly.io flyctl install](https://fly.io/docs/flyctl/install/)
- [Fly.io deploy with --image](https://fly.io/docs/flyctl/deploy/)
- [Fly.io secrets](https://fly.io/docs/flyctl/secrets/)
- [GHCR publishing](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)

### Institutional Learnings Applied
- **Flycast port 80**: Use `http://{prefix}-vm.flycast` (NOT `:3001`). Fly Proxy maps 80 → internal_port. (from `docs/solutions/integration-issues/stateful-relay-multi-machine-deploy-20260227.md`)
- **Fly.io creates 2 machines by default**: `fly deploy` creates 2 for HA. Use `--ha=false` or `fly scale count 1`. (from same solution)
- **Volume mount overlays filesystem**: VM creates `/data/images` at startup via `mkdirSync`, not in Dockerfile. Already handled. (from `docs/solutions/runtime-errors/volume-mount-enoent-relay-20260227.md`)
- **Non-root user required**: Claude Code CLI rejects `--dangerously-skip-permissions` as root. VM Dockerfile already creates `appuser`. (from `docs/solutions/developer-experience/docker-vm-claude-code-headless-setup-20260225.md`)
