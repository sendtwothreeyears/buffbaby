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
- **Callbacks:** `POST /callback/:phone` receives progress updates from VM during execution
- **State machine:** Per-user state (`idle` → `working` → `awaiting_approval` → `idle`) with approval/reject/cancel keyword routing
- **Queue:** Per-user message queue (max 5) with sequential processing

### Layer 2: Docker VM (`vm/`)

Always-on container running Claude Code headlessly via HTTP API.

**Endpoints:**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/command` | POST | Run a prompt through Claude Code CLI |
| `/approve` | POST | Create PR (approved) or revert changes (rejected) |
| `/cancel` | POST | Kill the active Claude Code process |
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

### Progress Streaming (Phase 6)

```
1. User sends command via WhatsApp
2. Relay sets state to "working", forwards to VM POST /command { text, callbackPhone }
3. VM spawns Claude Code, pipes prompt via stdin
4. Claude Code emits ::progress:: markers in stdout
5. VM parses markers, POSTs to relay: POST /callback/:phone { type: "progress", message }
6. Relay receives callback, sends progress message to WhatsApp
7. Claude Code finishes (may emit ::approval:: marker)
8. VM awaits pending callbacks, responds with { text, images, diffs, approvalRequired }
```

### Approval Flow (Phase 6)

```
1. VM response includes approvalRequired: true
2. Relay transitions to "awaiting_approval", sends diffs + prompt to user
3. User replies "approve" → Relay POSTs /approve { approved: true } to VM
4. VM creates commit + PR via Claude Code, responds with PR URL
5. Relay sends PR URL to WhatsApp, transitions to "idle"
   — OR —
3. User replies "reject" → Relay POSTs /approve { approved: false } to VM
4. VM runs git checkout . && git clean -fd, responds
5. Relay sends confirmation, transitions to "idle"
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

### State Machine

```
         ┌─────── user message ──────► WORKING
         │                              │  │
       IDLE ◄── normal completion ──────┘  │
         │                                 │ approvalRequired
         │    ┌── approve ─────────────────┤
         │    │   (→ working → PR → idle)  │
         │    │                            ▼
         │    └──────────── AWAITING_APPROVAL
         │                        │  │
         │    reject ─────────────┘  │
         │    (→ revert → idle)      │
         │                           │
         └── cancel / timeout ───────┘
```

| From | Trigger | To | Action |
|------|---------|-----|--------|
| `idle` | user message | `working` | Forward to VM |
| `working` | VM responds (no approval) | `idle` | Send response, process queue |
| `working` | VM responds (approvalRequired) | `awaiting_approval` | Send diffs + prompt, start 30-min timer |
| `working` | "cancel" | `idle` | Abort fetch, POST /cancel to VM, clear queue |
| `awaiting_approval` | "approve" | `working` → `idle` | POST /approve, send PR URL |
| `awaiting_approval` | "reject" | `idle` | POST /approve {approved:false}, revert |
| `awaiting_approval` | timeout (30 min) | `idle` | Changes preserved on disk |

## Known Limitations

- **24-hour session window** — WhatsApp only allows replies within 24 hours of the user's last message. Proactive notifications (CI/CD alerts, stale session reminders) require Meta Business verification and approved template messages. This affects future Phases 14 and 15.
- **Sandbox join code** — Users must send a join code to the Twilio Sandbox number before first use. Production will use a WhatsApp Business number which doesn't require this.
- **In-memory state** — relay state (queue, approval timers) is lost on restart; state resets to idle.
- **No callback auth** — VM-to-relay callbacks are unauthenticated (localhost only for alpha). Planned for Phase 7.
