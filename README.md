# TextSlash

> Text your cloud VM from WhatsApp. The conversation thread is your project log.

TextSlash gives engineers their own always-on Claude Code instance in the cloud, accessible entirely via WhatsApp. No laptop, no terminal, no new app to download. Send a WhatsApp message, get code diffs as images, app previews as screenshots, PR approvals as text replies.

```
Phone (WhatsApp) --> Twilio --> Relay Server --> Cloud VM (Claude Code + Playwright)
```

---

## How It's Different

| | TextSlash | Claude Code Remote Control | Claude Code on the Web | NanoClaw / OpenClaw |
|---|---|---|---|---|
| **Hardware needed** | Phone + internet. Nothing else. | Laptop running a terminal | Phone + internet | Self-hosted server (24/7) |
| **New app download?** | No (WhatsApp already installed) | Yes (Claude app) | Yes (Claude app) or browser | Server software |
| **Subscription** | $29/mo + BYOK API keys | Claude Max ($100-200/mo) | Claude Pro+ ($20-200/mo) | Free, but you host it |
| **Models** | Claude + Codex + Gemini (any combo) | Anthropic only | Anthropic only | Claude only |
| **Always-on?** | Yes (cloud VM) | No (terminal must stay open) | Yes | Only if your server stays on |
| **Persistence** | WhatsApp thread = permanent log | Ephemeral (session dies) | Session-scoped | Per-conversation memory |

**The one-liner:** Remote Control lets you check on your laptop from your phone. Claude Code on the Web lets you delegate tasks from a browser. NanoClaw and OpenClaw require you to run a server. **TextSlash replaces the laptop.**

**Full competitive analysis:** [docs/competitive-analysis.md](docs/competitive-analysis.md)

---

## What the User Provides

| What | Why | Notes |
|------|-----|-------|
| **WhatsApp account** | The interface. Send messages, receive diffs, approve PRs. | Already on 2B+ devices. No new download. |
| **LLM API keys** | BYOK. Claude, Codex, Gemini — any combination. | Wholesale API rates, no subscription markup. |
| **GitHub account** | OAuth for repo access. Clone, commit, push, create PRs. | Connected during onboarding. |
| **Fly.io API token** *(optional)* | For deploying their own apps from the VM. | TextSlash manages the dev VM. User's apps deploy to their own Fly.io account. |

### What the User Does NOT Need

- A laptop or desktop computer
- A Claude Max, Pro, or any Anthropic subscription
- A Twilio account (TextSlash owns the WhatsApp Business number)
- A Fly.io account for the dev VM (TextSlash manages dev VMs)
- Docker, Node.js, or any dev tooling installed anywhere
- To download any app

---

## What TextSlash Provides

| What | Details |
|------|---------|
| **WhatsApp Business number** | One number. Every user messages the same number. Relay routes by phone number to their VM. |
| **Always-on cloud VM per user** | Fly.io Machine running Claude Code, Playwright, Node.js, git, Chromium. No cold starts. |
| **Relay server** | ~300 lines of Node.js. Receives webhooks, forwards to user's VM, sends responses back via WhatsApp. |
| **WhatsApp transport** | Twilio (current) or Meta WhatsApp Cloud API (future). Platform owns this — users never see it. |
| **Onboarding website** | Sign up, enter phone number, connect GitHub, enter API keys. VM provisioned automatically. |
| **Base VM image** | Docker container with everything pre-installed. |
| **Base skills** | Pre-installed `.claude/skills/` on every VM for common operations. |

---

## Architecture

```
                  User's Phone (WhatsApp)
                          |
                          v
                  WhatsApp Business API
                   (Twilio or Meta)
                          |
                          v
           +-----------------------------+
           |       Relay Server          |
           |  (TextSlash's Fly.io)       |
           |  - Webhook handler          |
           |  - Phone -> VM routing      |
           |  - Image proxy              |
           |  - Message chunking         |
           +-----------------------------+
                          |
             +------------+------------+
             |            |            |
             v            v            v
        User A's VM  User B's VM  User C's VM
        (Fly.io)     (Fly.io)     (Fly.io)
        +----------+ +----------+ +----------+
        |Claude Code| |Claude Code| |Claude Code|
        |Playwright | |Playwright | |Playwright |
        |Chromium   | |Chromium   | |Chromium   |
        |Git        | |Git        | |Git        |
        +----------+ +----------+ +----------+
             |
             | (user's own Fly.io token)
             v
        User A's Fly.io Org
        +-------------------+
        | my-frontend       |
        | my-api            |
        +-------------------+
```

**Separation of concerns:**
- TextSlash manages dev VMs (TextSlash's Fly.io account)
- User's deployed apps live in the user's own Fly.io account
- User's code lives in the user's GitHub account

---

## Base VM Skills

Every new VM comes pre-installed with base `.claude/skills/` for common operations. Users can add their own on top.

### Bootstrap Skills

| Skill | Command | What it does |
|-------|---------|-------------|
| **clone** | `/clone <repo> [branch]` | Clone a GitHub repo. Install deps, start dev server if applicable. |
| **auth-gh** | `/auth-gh` | Authenticate with GitHub using the user's OAuth token. |
| **status** | `/status` | Show VM state: active project, branch, dev server health, recent PRs. |
| **session** | `/session start <repo> [branch]` | Start a working session. Clone if needed, checkout branch, start dev server. |
| | `/session stop` | Stop the current session. Commit uncommitted work, stop dev server. |
| | `/session resume` | Resume the last session. |

### Development Skills

| Skill | Command | What it does |
|-------|---------|-------------|
| **preview** | `/preview [page]` | Capture and send app screenshots (mobile + desktop viewports). |
| **diff** | `/diff` | Show current changes as syntax-highlighted diff images. |
| **ship** | `/ship <description>` | End-to-end: implement, review, fix, commit, push, create PR. |
| **deploy** | `/deploy [target]` | Deploy to user's Fly.io/Vercel/Railway using their credentials. |

### Utility Skills

| Skill | Command | What it does |
|-------|---------|-------------|
| **help** | `/help` | List available commands and skills. |
| **keys** | `/keys set <service> <key>` | Securely update API keys. |
| **logs** | `/logs [lines]` | Show recent Claude Code output for debugging. |

### User-Provided Skills

Users bring their own `.claude/skills/` by:
1. Including a `.claude/` directory in their cloned repo
2. Sending: "install my skills from github.com/user/my-claude-config"
3. VM merges platform base skills with user skills (user skills take precedence)

---

## VM Bootstrap Script

When a new user signs up, the onboarding backend runs a bootstrap sequence:

```
1. Provision Fly.io Machine (Docker base image)
2. Inject encrypted credentials (API keys, GitHub OAuth token)
3. Run bootstrap script:
   a. Configure git identity (from GitHub profile)
   b. Configure GitHub authentication (OAuth token)
   c. Install base .claude/skills/
   d. Write base CLAUDE.md with VM-specific instructions
   e. Verify Claude Code CLI works (health check)
   f. Verify Playwright/Chromium works (test screenshot)
4. Send welcome WhatsApp message: "You're set up. Send me anything to start."
```

---

## Onboarding Flow

```
1. Visit textslash.dev/signup
2. Enter phone number
3. Connect GitHub (OAuth)
4. Enter API keys:
   - Claude API key (required)
   - Codex API key (optional)
   - Gemini API key (optional)
   - Fly.io API token (optional — for deploying their own apps)
5. Submit -> VM provisioned automatically (~30 seconds)
6. Receive WhatsApp message: "You're set up. Send me anything to start."
7. Start working. Never leave WhatsApp.
```

---

## WhatsApp Transport: Twilio vs Meta Cloud API

TextSlash owns the WhatsApp transport. Users never see it.

| | **Twilio** (current) | **Meta WhatsApp Cloud API** (future option) |
|---|---|---|
| **Cost** | ~$0.005-0.01/msg + Twilio markup | Free to receive. ~$0.005-0.08/conversation |
| **Dev sandbox** | Yes (free, immediate) | Yes (free, up to 5 test numbers) |
| **Setup** | Twilio account + sandbox | Meta Business account |
| **Swap effort** | N/A | ~50 lines of transport code |

Both require a phone number for the business side (virtual numbers work — no physical SIM needed). WhatsApp's architecture is phone-number-based by design. The phone number IS the identity — which is actually a strength: no username/password, no account creation needed.

---

## Cost Breakdown

### What the user pays

| Item | Cost |
|------|------|
| TextSlash subscription | $29/mo |
| LLM API usage (BYOK) | Variable — wholesale rates direct to providers |
| Fly.io for their apps (optional) | Variable — their account, their bill |

### What TextSlash pays per user

| Item | Cost |
|------|------|
| Fly.io VM (shared-cpu-2x, 2GB) | ~$5/mo |
| WhatsApp messaging (Twilio) | ~$3-8/mo |
| Relay server (amortized) | ~$1/mo |
| **Total COGS** | **~$9-14/mo** |
| **Margin** | **~$15-20/mo per user** |

---

## Local Development

```bash
# 1. Clone the repo
git clone https://github.com/sendtwothreeyears/ts.git textslash
cd textslash

# 2. Copy env files
cp .env.example .env
cp vm/.env.example vm/.env
# Fill in your API keys, Twilio credentials, phone number

# 3. Start the VM container
docker compose up -d

# 4. Start the relay server
npm install && npm run dev

# 5. Start ngrok (expose relay to Twilio webhooks)
ngrok http 3000

# 6. Update Twilio webhook URL to ngrok URL
# Twilio Console -> WhatsApp Sandbox -> Webhook URL

# 7. Send a WhatsApp message to the Twilio Sandbox number
```

Or use the AI-native setup: `claude` then `/setup`.

---

## Project Structure

```
textslash/
├── server.js              # Relay server (~450 LOC)
├── Dockerfile             # Relay container
├── fly.toml               # Relay Fly.io config
├── docker-compose.yml     # Local dev orchestration
├── .env.example           # Relay env template
├── CLAUDE.md              # Project instructions for Claude Code
├── ARCHITECTURE.md        # System design and data flow
├── SECURITY.md            # Security posture
│
├── vm/
│   ├── vm-server.js       # VM HTTP API (~450 LOC)
│   ├── Dockerfile         # VM container (Claude Code + Playwright + Chromium)
│   ├── fly.toml           # VM Fly.io config
│   ├── CLAUDE.md          # VM-specific instructions
│   └── .env.example       # VM env template
│
├── deploy/
│   ├── relay.fly.toml     # Template fly.toml for self-hosted relay
│   └── vm.fly.toml        # Template fly.toml for self-hosted VM
│
├── scripts/
│   ├── setup.sh           # Self-hosted provisioning script
│   └── teardown.sh        # Destroy a self-hosted deployment
│
├── .github/
│   └── workflows/
│       └── publish-images.yml  # Build + push Docker images to GHCR
│
├── docs/
│   ├── PRD_WHATSAPP_AGENTIC_COCKPIT.md   # Full product spec
│   ├── competitive-analysis.md            # vs the field
│   └── plans/                             # Implementation plans
│
└── .claude/
    ├── skills/            # Claude Code skills (20 skills)
    └── subagents/         # Shared research agents
```

---

## Self-Hosting

Deploy your own textslash instance to your Fly.io account. You'll get your own relay server and VM, fully independent.

### Prerequisites

| Requirement | How to Get It |
|-------------|---------------|
| **Fly.io account** | [Sign up](https://fly.io) (free tier available) |
| **flyctl CLI** | [Install](https://fly.io/docs/flyctl/install/) and `fly auth login` |
| **Anthropic API key** | [console.anthropic.com](https://console.anthropic.com) |
| **Twilio account** | [twilio.com](https://www.twilio.com) — WhatsApp Sandbox works for dev |
| **Git + this repo cloned** | `git clone https://github.com/sendtwothreeyears/ts.git textslash` |

### Quick Start

```bash
cd textslash
./scripts/setup.sh
```

The script will:
1. Check that `flyctl` is installed and you're logged in
2. Ask for your app name prefix (e.g., `myname` → `myname-relay`, `myname-vm`)
3. Ask for your Fly.io org, region, and credentials
4. Create both Fly.io apps, set encrypted secrets, and deploy from pre-built Docker images
5. Wait for the relay to become healthy
6. Print next steps (configure Twilio webhook URL)

**Estimated cost:** ~$15-20/month on Fly.io (shared-cpu VMs + 3GB volume).

### Configure Twilio

After setup completes, point your Twilio webhook to your relay:

1. Go to [Twilio Console → WhatsApp Sandbox](https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn) (or your WhatsApp Business number settings)
2. Set the webhook URL to: `https://{prefix}-relay.fly.dev/webhook`
3. If using the Sandbox, send the join code to the sandbox number first

### Teardown

```bash
./scripts/teardown.sh
```

Destroys both apps and all associated data. This is irreversible.

### Configuration Reference

Secrets are set via `fly secrets set` (encrypted at rest). See `.env.example` and `vm/.env.example` for the full list of environment variables.

| Secret | Set On | Purpose |
|--------|--------|---------|
| `TWILIO_ACCOUNT_SID` | Relay | Twilio authentication |
| `TWILIO_AUTH_TOKEN` | Relay | Twilio authentication |
| `TWILIO_WHATSAPP_NUMBER` | Relay | Your Twilio WhatsApp number |
| `ALLOWED_PHONE_NUMBERS` | Relay | Comma-separated phone numbers allowed to use the system |
| `CLAUDE_HOST` | Relay | Internal URL to VM (`http://{prefix}-vm.flycast`) |
| `PUBLIC_URL` | Relay | Public relay URL for image proxying |
| `ANTHROPIC_API_KEY` | VM | Claude API key |
| `RELAY_CALLBACK_URL` | VM | Internal URL to relay for callbacks |
| `GITHUB_TOKEN` | VM | (Optional) GitHub access token |

---

## Key Links

- **PRD:** [docs/PRD_WHATSAPP_AGENTIC_COCKPIT.md](docs/PRD_WHATSAPP_AGENTIC_COCKPIT.md)
- **Competitive Analysis:** [docs/competitive-analysis.md](docs/competitive-analysis.md)
- **Architecture:** [ARCHITECTURE.md](ARCHITECTURE.md)
- **Security:** [SECURITY.md](SECURITY.md)

## License

[MIT](LICENSE)
