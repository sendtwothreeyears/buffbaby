#!/usr/bin/env bash
set -euo pipefail

# textslash self-hosted setup script
# Deploys a relay + VM to your own Fly.io account from pre-built GHCR images.

GHCR_ORG="sendtwothreeyears"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== textslash setup ==="
echo ""
echo "This script will deploy a textslash relay + VM to your Fly.io account."
echo "You'll need: flyctl installed, a Fly.io account, Anthropic API key, and Twilio credentials."
echo ""

# ─── 1. Check prerequisites ──────────────────────────────────────────────────

if ! command -v fly >/dev/null 2>&1; then
  echo "Error: flyctl is not installed."
  echo "Install it: https://fly.io/docs/flyctl/install/"
  exit 1
fi

if ! fly auth whoami >/dev/null 2>&1; then
  echo "Error: Not logged in to Fly.io."
  echo "Run: fly auth login"
  exit 1
fi

echo "Logged in as: $(fly auth whoami)"
echo ""

# ─── 2. Collect configuration ────────────────────────────────────────────────

read -rp "App name prefix (e.g., 'myname' → myname-relay, myname-vm): " PREFIX

if [ -z "$PREFIX" ]; then
  echo "Error: prefix cannot be empty."
  exit 1
fi

# Validate prefix: lowercase alphanumeric and hyphens only
if [[ ! "$PREFIX" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?$ ]]; then
  echo "Error: prefix must be lowercase alphanumeric (hyphens allowed, not at start/end)."
  exit 1
fi

read -rp "Fly.io org slug [personal]: " ORG_SLUG
ORG_SLUG=${ORG_SLUG:-personal}

read -rp "Region (see https://fly.io/docs/reference/regions/) [ord]: " REGION
REGION=${REGION:-ord}

echo ""

# ─── 3. Collect secrets ──────────────────────────────────────────────────────

echo "Enter your credentials. These are stored encrypted on Fly.io (fly secrets set)."
echo ""

read -rp "Anthropic API key: " ANTHROPIC_API_KEY
if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "Error: Anthropic API key is required."
  exit 1
fi

read -rp "Twilio Account SID: " TWILIO_ACCOUNT_SID
if [ -z "$TWILIO_ACCOUNT_SID" ]; then
  echo "Error: Twilio Account SID is required."
  exit 1
fi

read -rp "Twilio Auth Token: " TWILIO_AUTH_TOKEN
if [ -z "$TWILIO_AUTH_TOKEN" ]; then
  echo "Error: Twilio Auth Token is required."
  exit 1
fi

read -rp "Twilio WhatsApp number (e.g., +14155238886): " TWILIO_WHATSAPP_NUMBER
if [ -z "$TWILIO_WHATSAPP_NUMBER" ]; then
  echo "Error: Twilio WhatsApp number is required."
  exit 1
fi

read -rp "Your phone number (e.g., +1XXXXXXXXXX): " ALLOWED_PHONE_NUMBERS
if [ -z "$ALLOWED_PHONE_NUMBERS" ]; then
  echo "Error: Phone number is required."
  exit 1
fi

read -rp "GitHub token (optional, press Enter to skip): " GITHUB_TOKEN

echo ""
echo "─── Configuration ───"
echo "  Prefix:  ${PREFIX}"
echo "  Relay:   ${PREFIX}-relay"
echo "  VM:      ${PREFIX}-vm"
echo "  Org:     ${ORG_SLUG}"
echo "  Region:  ${REGION}"
echo ""
read -rp "Proceed? (y/n): " PROCEED
if [ "$PROCEED" != "y" ]; then
  echo "Aborted."
  exit 1
fi

echo ""

# ─── 4. Create apps ──────────────────────────────────────────────────────────

echo "Creating ${PREFIX}-relay..."
fly apps create "${PREFIX}-relay" --org "$ORG_SLUG"

echo "Creating ${PREFIX}-vm..."
fly apps create "${PREFIX}-vm" --org "$ORG_SLUG"

# ─── 5. Create VM volume ─────────────────────────────────────────────────────

echo "Creating volume for VM..."
fly volumes create vm_data --app "${PREFIX}-vm" --region "$REGION" --size 3 --yes

# ─── 6. Set secrets (encrypted at rest) ──────────────────────────────────────

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
VM_SECRETS=(
  "ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY"
  "RELAY_CALLBACK_URL=http://${PREFIX}-relay.flycast:3000"
)
if [ -n "$GITHUB_TOKEN" ]; then
  VM_SECRETS+=("GITHUB_TOKEN=$GITHUB_TOKEN")
fi
fly secrets set "${VM_SECRETS[@]}" --app "${PREFIX}-vm"

# ─── 7. Deploy from GHCR images ──────────────────────────────────────────────

echo "Deploying relay..."
fly deploy --app "${PREFIX}-relay" \
  --config "${REPO_DIR}/deploy/relay.fly.toml" \
  --image "ghcr.io/${GHCR_ORG}/textslash-relay:latest" \
  --region "$REGION" --ha=false

echo "Deploying VM..."
fly deploy --app "${PREFIX}-vm" \
  --config "${REPO_DIR}/deploy/vm.fly.toml" \
  --image "ghcr.io/${GHCR_ORG}/textslash-vm:latest" \
  --region "$REGION" --ha=false

# ─── 8. Scale to 1 machine (belt-and-suspenders for HA default) ──────────────

fly scale count 1 --app "${PREFIX}-relay" --yes
fly scale count 1 --app "${PREFIX}-vm" --yes

# ─── 9. Wait for relay health ────────────────────────────────────────────────

echo ""
echo "Waiting for relay to be healthy..."
ATTEMPTS=0
MAX_ATTEMPTS=24  # 2 minutes at 5s intervals
until curl -sf "https://${PREFIX}-relay.fly.dev/health" > /dev/null 2>&1; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if [ "$ATTEMPTS" -ge "$MAX_ATTEMPTS" ]; then
    echo "Warning: relay health check timed out after 2 minutes."
    echo "Check status with: fly status --app ${PREFIX}-relay"
    break
  fi
  sleep 5
  echo "  waiting... (${ATTEMPTS}/${MAX_ATTEMPTS})"
done

if [ "$ATTEMPTS" -lt "$MAX_ATTEMPTS" ]; then
  echo "Relay is healthy!"
fi

# ─── 10. Done ─────────────────────────────────────────────────────────────────

echo ""
echo "=== Setup complete! ==="
echo ""
echo "  Relay URL:  https://${PREFIX}-relay.fly.dev"
echo "  Relay app:  ${PREFIX}-relay"
echo "  VM app:     ${PREFIX}-vm"
echo ""
echo "Next steps:"
echo "  1. Set your Twilio webhook URL to: https://${PREFIX}-relay.fly.dev/webhook"
echo "  2. If using Twilio Sandbox, text 'join <your-sandbox-code>' to the sandbox number first"
echo "  3. Send a WhatsApp message to start using textslash!"
echo ""
echo "Useful commands:"
echo "  fly status --app ${PREFIX}-relay    # Check relay status"
echo "  fly status --app ${PREFIX}-vm       # Check VM status"
echo "  fly logs --app ${PREFIX}-relay      # View relay logs"
echo "  fly logs --app ${PREFIX}-vm         # View VM logs"
echo "  ./scripts/teardown.sh               # Destroy both apps"
