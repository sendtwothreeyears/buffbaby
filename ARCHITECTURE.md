# Architecture

## Three-Layer System

```
Phone (SMS) ←→ Twilio ←→ Relay Server ←→ Docker VM (Claude Code + Playwright)
```

### Layer 1: Relay Server (`server.js`)

Express server that bridges Twilio SMS/MMS with the backend VM.

- **Inbound:** Receives Twilio webhooks at `POST /sms`
- **Authentication:** Phone number allowlist — only configured numbers get through
- **Outbound:** Sends responses via Twilio API as SMS (text) and MMS (images)
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

- **Inbound:** Webhooks deliver SMS messages to the relay server
- **Outbound:** Twilio REST API sends SMS/MMS responses
- **MMS:** Images must be < 1MB, accessible via public URL (max 10 media per message)

## File Map

| File | Purpose |
|------|---------|
| `server.js` | Relay server — receives SMS, authenticates, proxies images, sends responses |
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
1. User sends SMS to Twilio number
2. Twilio POSTs webhook to relay server /sms
3. Relay checks phone number against allowlist
4. Relay POSTs command to Docker VM /command
5. VM runs Claude Code CLI with the prompt
6. VM returns { text, images: [], exitCode, durationMs }
7. Relay sends text response as SMS via Twilio
```

### Screenshot Pipeline (Phase 4)

```
1. User texts "show me the app"
2. Relay forwards to VM /command
3. Claude Code interprets intent, curls POST /screenshot on VM
4. VM captures with Playwright, saves JPEG to /tmp/images/<uuid>.jpeg
5. /command response includes images array with metadata
6. Relay constructs public proxy URLs (PUBLIC_URL + /images/filename)
7. Relay sends MMS via Twilio with mediaUrl
8. Twilio fetches image from relay proxy → relay proxies from VM
9. User receives screenshot on phone
```

## Design Decisions

- **Persistent VMs** (not ephemeral containers) — users need project state across commands
- **Webhooks** (not polling) — SMS requires low-latency delivery
- **Non-root Docker user** — Claude Code requires non-root for `--dangerously-skip-permissions`
- **Single-command concurrency** — prevents resource contention on the VM
- **Phone number allowlist** — simple but effective auth for alpha stage
- **Two separate servers** — relay and VM are independently deployable and testable
- **Relay as image proxy** — Twilio needs publicly accessible URLs; relay proxies from VM to avoid exposing VM directly
- **Per-request Playwright browser** — launch/close per screenshot avoids stale browser state; ~1-2s cold start acceptable
- **Iterative JPEG compression** — quality 80→30 until under 600KB threshold; ensures MMS delivery < 1MB
