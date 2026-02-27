# Architecture

## Three-Layer System

```
Phone (WhatsApp) ←→ Twilio ←→ Relay Server ←→ Docker VM (Claude Code + Playwright)
```

### Layer 1: Relay Server (`server.js`)

Express server that bridges Twilio WhatsApp with the backend VM.

- **Inbound:** Receives Twilio webhooks at `POST /webhook`
- **Authentication:** Phone number allowlist — only configured numbers get through (`whatsapp:` prefix stripped for allowlist check)
- **Outbound:** Sends responses via Twilio API as WhatsApp messages (text + media)
- **Image proxy:** `GET /images/:filename` proxies image requests from Twilio to the VM
- **Queue:** Per-user message queue (max 5) with sequential processing

### Layer 2: Docker VM (`vm/`)

Always-on container running Claude Code headlessly via HTTP API.

**Endpoints:**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/command` | POST | Run a prompt through Claude Code CLI |
| `/screenshot` | POST | Capture a web page screenshot with Playwright |
| `/health` | GET | Health check |
| `/images/:filename` | GET | Serve generated images from `/tmp/images` |

**Container includes:** Node.js 22, Chromium, Playwright, Claude Code CLI, git.

**Security:** Non-root user (`appuser`), single-command concurrency lock, 10MB output buffer cap, process group management, path traversal protection on image serving.

### Layer 3: Twilio Transport

- **Inbound:** Webhooks deliver WhatsApp messages to the relay server at `POST /webhook`
- **Outbound:** Twilio REST API sends WhatsApp responses (text + media, 1 media per message)
- **WhatsApp:** Via Twilio Sandbox (dev) or Business number (prod). Users must send a join code to opt in to the Sandbox. 24-hour session window for replies.

## File Map

| File | Purpose |
|------|---------|
| `server.js` | Relay server — receives WhatsApp messages, authenticates, proxies images, sends responses |
| `vm/vm-server.js` | VM HTTP API — wraps Claude Code CLI, screenshot capture, image cleanup |
| `vm/CLAUDE.md` | Claude Code system prompt — documents `/screenshot` endpoint |
| `vm/Dockerfile` | Docker image — Node 22, Chromium, Claude Code, Playwright |
| `vm/test-app/index.html` | Static test page for screenshot pipeline testing |
| `docker-compose.yml` | VM orchestration — ports, memory limits, env |
| `.env.example` | Relay env vars template |
| `vm/.env.example` | VM env vars template |

## Data Flow

### Command Execution (Text Only)

```
1. User sends WhatsApp message to Twilio sandbox number
2. Twilio POSTs webhook to relay server /webhook
3. Relay checks phone number against allowlist
4. Relay POSTs command to Docker VM /command
5. VM runs Claude Code CLI with the prompt
6. VM returns { text, images: [], exitCode, durationMs }
7. Relay sends text response as WhatsApp message via Twilio
```

### Screenshot Pipeline (Phase 4)

```
1. User sends "show me the app"
2. Relay forwards to VM /command
3. Claude Code interprets intent, curls POST /screenshot on VM
4. VM captures with Playwright, saves JPEG to /tmp/images/<uuid>.jpeg
5. /command response includes images array with metadata
6. Relay constructs public proxy URLs (PUBLIC_URL + /images/filename)
7. Relay sends WhatsApp message via Twilio with mediaUrl (1 per message)
8. Twilio fetches image from relay proxy → relay proxies from VM
9. User receives screenshot on phone
```

## Design Decisions

- **Persistent VMs** (not ephemeral containers) — users need project state across commands
- **Webhooks** (not polling) — messaging requires low-latency delivery
- **Non-root Docker user** — Claude Code requires non-root for `--dangerously-skip-permissions`
- **Single-command concurrency** — prevents resource contention on the VM
- **Phone number allowlist** — simple but effective auth for alpha stage
- **Two separate servers** — relay and VM are independently deployable and testable
- **Relay as image proxy** — Twilio needs publicly accessible URLs; relay proxies from VM to avoid exposing VM directly
- **Per-request Playwright browser** — launch/close per screenshot avoids stale browser state; ~1-2s cold start acceptable
- **Iterative JPEG compression** — quality 80→30 until under 600KB threshold; ensures reliable media delivery
- **WhatsApp 1-media-per-message** — first image sent with text, additional images as separate messages
- **Transport-agnostic `forwardToVM()`** — the VM API is channel-independent; only the relay's `sendMessage()` is WhatsApp-specific

## Known Limitations

- **24-hour session window** — WhatsApp only allows replies within 24 hours of the user's last message. Proactive notifications (CI/CD alerts, stale session reminders) require Meta Business verification and approved template messages. This affects future Phases 14 and 15.
- **Sandbox join code** — Users must send a join code to the Twilio Sandbox number before first use. Production will use a WhatsApp Business number which doesn't require this.
- **In-memory message queue** — relay queue state is lost on restart; queued messages and busy flags reset.
