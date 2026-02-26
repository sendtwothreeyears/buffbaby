# Architecture

## Three-Layer System

```
Phone (SMS) ←→ Twilio ←→ Relay Server ←→ Docker VM (Claude Code)
```

### Layer 1: Relay Server (`server.js` — 68 LOC)

Express server that bridges Twilio SMS/MMS with the backend VM.

- **Inbound:** Receives Twilio webhooks at `POST /sms`
- **Authentication:** Phone number allowlist — only configured numbers get through
- **Outbound:** Sends responses via Twilio API as SMS (text) and MMS (images)
- **Current state:** Echo server. Phase 3 adds VM forwarding.

### Layer 2: Docker VM (`vm/` — 157 LOC server + 51 LOC Dockerfile)

Always-on container running Claude Code headlessly via HTTP API.

**Endpoints:**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/command` | POST | Run a prompt through Claude Code CLI |
| `/health` | GET | Health check |
| `/images/:filename` | GET | Serve generated images from `/tmp/images` |

**Container includes:** Node.js 22, Chromium, Playwright, Claude Code CLI, git.

**Security:** Non-root user (`appuser`), single-command concurrency lock, 10MB output buffer cap, process group management, path traversal protection on image serving.

### Layer 3: Twilio Transport

- **Inbound:** Webhooks deliver SMS messages to the relay server
- **Outbound:** Twilio REST API sends SMS/MMS responses
- **MMS:** Images must be < 1MB, accessible via public URL

## File Map

| File | Purpose | LOC |
|------|---------|-----|
| `server.js` | Relay server — receives SMS, authenticates, sends responses | 68 |
| `vm/vm-server.js` | VM HTTP API — wraps Claude Code CLI | 157 |
| `vm/Dockerfile` | Docker image — Node 22, Chromium, Claude Code, Playwright | 51 |
| `docker-compose.yml` | VM orchestration — ports, memory limits, env | 12 |
| `.env.example` | Relay env vars template | — |
| `vm/.env.example` | VM env vars template | — |

## Data Flow

### Inbound SMS (Current — Echo)

```
1. User sends SMS to Twilio number
2. Twilio POSTs webhook to relay server /sms
3. Relay checks phone number against allowlist
4. Relay echoes the message back via Twilio API with MMS test image
```

### Inbound SMS (Phase 3 — VM Integration)

```
1. User sends SMS to Twilio number
2. Twilio POSTs webhook to relay server /sms
3. Relay checks phone number against allowlist
4. Relay POSTs command to Docker VM /command
5. VM runs Claude Code CLI with the prompt
6. VM returns text output + generated images
7. Relay sends response as SMS (text) + MMS (images) via Twilio
```

## Design Decisions

- **Persistent VMs** (not ephemeral containers) — users need project state across commands
- **Webhooks** (not polling) — SMS requires low-latency delivery
- **Non-root Docker user** — Claude Code requires non-root for `--dangerously-skip-permissions`
- **Single-command concurrency** — prevents resource contention on the VM
- **Phone number allowlist** — simple but effective auth for alpha stage
- **Two separate servers** — relay and VM are independently deployable and testable
