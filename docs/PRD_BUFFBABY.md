# PRD: BuffBaby

**Author:** sendtwothreeyears
**Date:** 2026-02-27
**Status:** Draft
**Last Updated:** 2026-02-27
**Model:** Open-source, self-hosted tool — developers deploy their own instance

---

## Problem Statement

_Agentic coding tools — Claude Code, Codex CLI, Gemini CLI — are locked to the terminal. You need a laptop open, a shell running, and your eyes on a screen to direct, review, and approve what your agent does. But the engineer's role in an agentic workflow is fundamentally about directing, reviewing, and approving — tasks that don't require a full desktop environment._

_Messaging apps are where developers already live. Discord servers for every project. Telegram groups for every team. WhatsApp for everything else. These apps are on your phone, always connected, designed for async communication. They support code blocks, media, buttons, threads. They're the perfect interface for "tell the agent what to do, get notified when it needs you."_

_BuffBaby turns any messaging app into a remote control for your agentic coding tools. Send a message, your agent executes it. Get diffs as images, previews as screenshots, approvals as button taps. The conversation thread is your project log. Your phone is your dev environment._

**Who** is affected:
Software engineers who use agentic coding tools (Claude Code, Codex, Gemini CLI) and want to work from their phone — on commutes, couches, coffee shops, or anywhere a laptop isn't open.

**What** they struggle with:
- Agentic coding tools are terminal-only. Can't direct agents from a phone.
- No way to review diffs, approve PRs, or check status without a laptop.
- Existing mobile terminal apps are painful — tiny text, no rich media, bad UX.
- Each messaging channel has its own bot ecosystem, but no unified tool bridges them to agentic coding CLIs.

**Why now** (urgency/opportunity):
- Agentic coding hit mainstream in 2025-2026. Claude Code, Codex CLI, Gemini CLI all support headless/non-interactive modes.
- The "engineer as director" paradigm means most interactions are short text commands and binary decisions (approve/reject) — perfect for messaging.
- Discord, Telegram, and WhatsApp all have mature bot APIs with rich features (buttons, embeds, threads, media).
- Competitive landscape is exploding (Clawdbot/Moltbot at 69k+ stars, Happy, OpenWork) — but most are single-channel or single-agent.

**Evidence** (data, quotes, research):
- Clawdbot/Moltbot reached 69k+ GitHub stars in early 2026 — massive demand signal for messaging-based agent control
- Multiple independent projects built Telegram and Discord bridges to Claude Code in Feb 2026 (claude-code-telegram, claude-code-discord-bridge, remote-agentic-coding-system)
- Happy.engineering launched a commercial Claude Code mobile client
- Discord has 200M+ monthly active users, Telegram has 900M+, WhatsApp has 2B+

---

## Core Differentiator

BuffBaby is the **multi-channel** messaging bridge for agentic coding. Multi-agent support (Codex, Gemini) is planned but MVP ships with Claude Code.

Most competitors are locked to one channel:

| | BuffBaby | Clawdbot/Moltbot | claude-code-discord | claude-code-telegram | Happy |
|---|---|---|---|---|---|
| **WhatsApp** | Yes | Yes | No | No | No |
| **Discord** | Yes | Yes | Yes | No | No |
| **Telegram** | Yes | Yes | No | Yes | No |
| **Claude Code** | Yes | Yes (primary) | Yes | Yes | Yes |
| **Codex CLI** | Planned | No | No | No | No |
| **Gemini CLI** | Planned | No | No | No | No |
| **Self-hosted** | Yes | Yes | Yes | Yes | No |
| **Channel-native UX** | Yes (adapters) | Yes | Discord only | Telegram only | Mobile app |
| **Open-source** | Yes | Yes | Yes | Yes | No |

**Strategic positioning:** BuffBaby doesn't pick a channel. Discord, Telegram, WhatsApp — your choice, your infrastructure. The adapter pattern means each channel feels native (Discord buttons, Telegram keyboards, WhatsApp text) instead of lowest-common-denominator. Multi-agent support is architecturally planned but deferred until the multi-channel foundation is solid.

---

## Goals & Success Metrics

| Goal | Metric | Target |
|------|--------|--------|
| Daily driver | Author uses BuffBaby for real dev work daily | 5+ sessions/week from phone |
| Multi-channel | All three channels working end-to-end | WhatsApp + Discord + Telegram functional |
| Reliability | Messages delivered and responses returned | Zero message loss over 1-week period |
| Latency | Command → first response | < 5 seconds for text, < 15 seconds for media |
| Setup simplicity | Time from clone to first message | < 30 minutes for a developer |

**Anti-goals** (what we are NOT optimizing for):
- Not a terminal replacement. BuffBaby is for directing and reviewing, not writing code directly.
- Not a hosted service. Self-hosted only — no accounts, no billing, no user management.
- Not a chat UI for LLMs. BuffBaby controls agentic coding tools, not raw model APIs.
- Not real-time streaming. Milestone messages, not terminal output. (Terminal view is a future enhancement, not core.)

---

## Target Users

**Primary user:**
- Description: A software engineer who uses agentic coding tools (Claude Code, Codex, Gemini CLI) and wants to direct them from their phone via a messaging app they already use.
- Key needs: Send commands, review diffs/screenshots, approve/reject PRs, check status — all from Discord, Telegram, or WhatsApp.
- Current workaround: Either don't work from phone, or use a clunky mobile terminal app (Termius, Blink, a]Shell) to SSH into their dev machine.

**Secondary user:**
- Description: Open-source contributor who wants to extend BuffBaby — add a new channel adapter, support a new agent CLI, or customize the relay behavior.
- Key needs: Clean adapter pattern, good docs, easy local development setup.

---

## Scope

### In Scope (Requirements)

**P0 — Must have (MVP):**
- [ ] Channel adapter for Discord (bot commands, message handling, media delivery)
- [ ] Channel adapter for Telegram (bot commands, message handling, media delivery)
- [ ] Channel adapter for WhatsApp (refactored from existing TextSlash code)
- [ ] Channel-agnostic relay core (routing, VM forwarding, state machine, image proxy)
- [ ] Claude Code agent support (headless CLI, progress streaming, approval flow)
- [ ] Screenshot pipeline (Playwright captures → messaging media delivery)
- [ ] Diff pipeline (syntax-highlighted diff images → messaging media delivery)
- [ ] Approve/reject flow (works per-channel: buttons on Discord/Telegram, text on WhatsApp)
- [ ] Self-hosted deployment (Docker Compose local, Fly.io production)
- [ ] Setup script for easy deployment

**P1 — Important (post-MVP polish):**
- [ ] Channel-native UX enhancements (Discord embeds/threads, Telegram inline keyboards)
- [ ] Codex CLI agent support
- [ ] Gemini CLI agent support
- [ ] Error recovery (VM health monitoring, thrashing detection, message queuing)
- [ ] Session management (status, stop, resume commands)
- [ ] `/help` command listing available actions

**P2 — Nice to have (future):**
- [ ] Web terminal escape hatch (xterm.js link for raw output)
- [ ] Telegram Mini App for rich diff/screenshot viewer
- [ ] CI/CD notifications (GitHub Actions → messaging)
- [ ] Composite diff images (grid layout for large changesets)
- [ ] Multi-agent orchestration status updates
- [ ] Voice commands via Discord voice channels

### Out of Scope (Non-Goals)
- Hosted/managed service — self-hosted only
- User accounts, databases, or billing — single-user per instance
- Payments or monetization
- iMessage, Slack, or other channels (architecture supports them, but not building adapters)
- Custom LLM/model integration (only agentic coding CLIs, not raw model APIs)
- Mobile app (the whole point is no app to install)

---

## User Flows

**Flow 1: First-time Setup**
1. Developer clones the BuffBaby repo
2. Runs `scripts/setup.sh` — prompted for: Fly.io token, Anthropic API key, channel choice (Discord/Telegram/WhatsApp), channel credentials (bot token, Twilio creds, etc.)
3. Script deploys relay + VM to Fly.io
4. Developer configures their bot (Discord: add to server, Telegram: start chat with bot, WhatsApp: send join code)
5. Sends first message: "hello"
6. Gets response: "BuffBaby is ready. Send any command to start."

**Flow 2: Basic Command (Discord)**
1. User types in Discord channel: `fix the login bug on the settings page`
2. Bot reacts with a spinner emoji (⏳)
3. Progress update posted: "Analyzing codebase..."
4. Progress update edited: "Found the issue in `src/auth/settings.ts`. Fixing..."
5. Progress update edited: "Fix applied. Running tests..."
6. Bot posts diff image (syntax-highlighted) + message: "3 files changed. Tests pass. Create PR?"
7. Bot shows buttons: [Approve] [Reject] [Show Diff]
8. User taps [Approve]
9. Bot posts: "PR #42 created: fix(auth): resolve settings page login bug"

**Flow 3: Screenshot Preview (Telegram)**
1. User sends: `show me the landing page`
2. Bot replies: "Capturing screenshot..."
3. Bot sends mobile viewport screenshot as photo
4. User sends: `now show desktop`
5. Bot sends desktop viewport screenshot as photo

**Flow 4: Multi-step with Approval (WhatsApp)**
1. User sends: `add dark mode to the app`
2. System replies: "Working on it..."
3. Progress: "Analyzing existing theme system..."
4. Progress: "Implementing dark mode toggle + CSS variables..."
5. Progress: "Done. 8 files changed. Tests pass."
6. System sends diff image
7. System sends: "Create PR? Reply 'approve' or 'reject'"
8. User replies: `approve`
9. System replies: "PR #43 created: feat(ui): add dark mode support"

**Flow 5: Status Check (any channel)**
1. User sends: `status`
2. Bot replies with current state: active session info, VM health, last command, git status

**Edge cases to handle:**
- Message sent while agent is working → queue it, reply "I'm working on your last request. I'll process this next. Reply 'cancel' to stop."
- Agent fails or errors → send error message with last known state, offer "retry" or "cancel"
- VM is unreachable → "Your VM appears to be down. Check Fly.io dashboard or reply 'restart'."
- Message exceeds channel limit → chunk into multiple messages with continuation markers
- Media fails to deliver → retry once, then send text fallback with description

---

## Technical Considerations

- **Performance:** Text responses within 5 seconds of agent completion. Media (screenshots, diffs) within 15 seconds including capture + upload + delivery.
- **Security:** All credentials stored as environment variables or Fly.io secrets. No database. Bot tokens and API keys never logged. WhatsApp messages are E2E encrypted by the platform. Discord and Telegram messages are not E2E encrypted — users should be aware.
- **Scalability:** Single-user per instance. No multi-tenancy. Scaling means more instances, not bigger instances.
- **Integrations:** Discord Bot API, Telegram Bot API, Twilio WhatsApp API, Claude Code CLI, Playwright, GitHub (via agent).
- **Reliability:** Relay should handle channel disconnections gracefully. VM health checks every 30 seconds. Message queuing during active work (don't drop messages).
- **WhatsApp-specific constraints:** 24-hour session window (can only reply within 24h of user's last message). 1600-char limit in Twilio Sandbox (4096 in production). 1 media attachment per message. 16MB media limit.
- **Discord-specific constraints:** 2000-char message limit (embeds bypass this). Rate limits on message edits (~30/min). Bot needs MESSAGE_CONTENT intent for reading messages.
- **Telegram-specific constraints:** 4096-char message limit. Rate limits on message edits (~20/min). Bot API is free with no per-message costs.

---

## Architecture Overview

```
                  Discord Bot API   ──┐
                  Telegram Bot API  ───┼──→  Relay Core  ──→  VM (Claude Code + Playwright)
                  Twilio (WhatsApp) ──┘     (adapter pattern)
```

### Components

**1. Channel Adapters (~50-100 lines each)**
Each adapter normalizes inbound messages into a common format (user ID, text, metadata) and formats outbound responses for the channel's native UX (text, media, buttons). Exact message schemas defined during planning.

**2. Relay Core (channel-agnostic)**
- Receives normalized `InboundMessage` from adapters
- Routes to VM via HTTP (`POST /command`, `POST /approve`, etc.)
- Manages per-user state machine: `idle` → `working` → `awaiting_approval` → `idle`
- Handles progress callbacks from VM
- Formats responses as `OutboundMessage`, passes to the originating adapter

**3. VM (unchanged from TextSlash)**
- Docker container with Claude Code CLI, Playwright, Chromium, Node.js, git
- Exposes HTTP API: `/command`, `/approve`, `/cancel`, `/screenshot`, `/health`, `/images/*`
- Single-tenant. One active process at a time.
- Sends progress callbacks to relay during long-running commands

**4. Image Pipeline (unchanged)**
- Screenshots: Playwright captures at mobile (390px) and desktop (1440px) viewports
- Diffs: Syntax-highlighted diff images rendered on VM
- Images served via relay's image proxy endpoint, delivered as channel media

### Local Development

```
Developer's Mac:
├── Relay (Node.js, bare metal) ← port 3000
│   ├── Discord adapter (bot token in .env)
│   ├── Telegram adapter (bot token in .env)
│   └── WhatsApp adapter (Twilio + ngrok)
└── VM (Docker) ← port 3001
    ├── Claude Code CLI
    ├── Playwright + Chromium
    └── vm-server.js
```

### Production (Fly.io)

```
Fly.io:
├── {prefix}-relay (always-on, 512MB)
│   ├── Discord adapter
│   ├── Telegram adapter
│   └── WhatsApp adapter
└── {prefix}-vm (auto-stop, 2GB, volume at /data)
    ├── Claude Code CLI
    ├── Playwright + Chromium
    └── vm-server.js
```

Same Docker image, different host. Config change, not a rewrite.

---

## Assumptions & Constraints

**Assumptions** (things we believe but haven't validated):
- Discord and Telegram bot APIs are stable enough for real-time use (rate limits won't be a bottleneck for single-user)
- Claude Code's headless output format is parseable enough for progress extraction (validated in TextSlash phases 1-8)
- Codex CLI and Gemini CLI will have similar enough headless modes to reuse the same VM server architecture (unvalidated — spike needed)
- A single relay process can handle all three channel connections simultaneously without issues

**Constraints** (hard limits):
- WhatsApp requires Twilio (paid) — Discord and Telegram are free
- WhatsApp 24-hour session window limits proactive notifications
- Discord requires MESSAGE_CONTENT privileged intent (must be enabled in developer portal)
- Self-hosted means the user is responsible for uptime, updates, and credential management

**Dependencies:**
- Discord Bot API (stable, well-documented)
- Telegram Bot API (stable, well-documented)
- Twilio WhatsApp API (stable, existing integration from TextSlash)
- Claude Code CLI headless mode (stable, validated)
- Playwright (stable, existing integration)
- Fly.io (for production deployment)

---

## Open Questions & Risks

| Question / Risk | Owner | Status | Resolution |
|-----------------|-------|--------|------------|
| Can a single relay process handle Discord + Telegram + WhatsApp simultaneously? | Engineering | Open | Likely yes (all are event-driven HTTP/WebSocket), but needs validation |
| How does Codex CLI's headless mode differ from Claude Code's? | Engineering | Open | Spike needed before adding Codex support |
| How does Gemini CLI's headless mode differ? | Engineering | Open | Spike needed before adding Gemini support |
| Should Discord use threads (one thread per command) or a dedicated channel? | Design | Open | Test both, decide based on UX |
| How to handle channel-specific features without bloating the core? | Architecture | Open | Adapter pattern should isolate this, but needs validation |

---

## Timeline & Milestones

### Phase A: Multi-Channel Foundation

| Milestone | Notes |
|-----------|-------|
| Refactor relay into adapter pattern | Extract channel-agnostic core from existing WhatsApp code |
| Discord adapter | Bot connects, receives messages, sends responses + media |
| Telegram adapter | Bot connects, receives messages, sends responses + media |
| WhatsApp adapter | Existing code wrapped in adapter interface |
| End-to-end test on all three channels | Same command, same response, three channels |

### Phase B: Channel-Native Polish

| Milestone | Notes |
|-----------|-------|
| Discord buttons + embeds | Approve/reject buttons, status embeds, thread support |
| Telegram inline keyboards | Approve/reject buttons, command menu |
| Error recovery | VM health monitoring, message queuing, thrashing detection |
| Session management | Status, stop, resume commands |

### Phase C: Multi-Agent

| Milestone | Notes |
|-----------|-------|
| Codex CLI agent adapter | Spike headless mode, build adapter |
| Gemini CLI agent adapter | Spike headless mode, build adapter |
| Agent selection command | User can switch between agents via message |

---

## Rollout Strategy

- **Phase A:** Author dogfoods daily across all three channels. Fix issues as they surface.
- **Phase B:** Polish based on dogfooding. Make setup docs good enough for others.
- **Phase C:** Add agent providers based on demand. Share repo publicly.
- **Graduation criteria:** Author has used BuffBaby for real development work for 2+ weeks across at least 2 channels.
- **Rollback plan:** Each channel adapter is independent. If one breaks, disable it and the others keep working.

---

## Cost Model

### Development Cost
| Component | Cost | Notes |
|-----------|------|-------|
| Discord Bot | Free | Discord Bot API is free |
| Telegram Bot | Free | Telegram Bot API is free |
| WhatsApp (Twilio) | ~$5-8/month | Per-conversation fees in Twilio Sandbox |
| Fly.io relay | ~$5/month | Always-on, 512MB shared-cpu |
| Fly.io VM | ~$15-30/month | 2GB, auto-stop when idle |
| Claude API | Variable | User's own key, usage-dependent |

### Total Monthly (Self-Hosted)
~$25-45/month for infrastructure. API costs are the user's own. Free and open-source — no tiers, no pricing.

---

## Learning & Growth

**New technology/skills being implemented:**
- Discord Bot API (discord.js)
- Telegram Bot API (node-telegram-bot-api or grammy)
- Adapter pattern for multi-channel messaging
- Multi-provider agent abstraction

**How this stretches beyond current abilities:**
- Designing a clean abstraction layer across three very different messaging APIs
- Making channel-native UX feel natural on each platform instead of lowest-common-denominator
- Building an open-source project meant for public consumption

**What excites me most:**
- The idea that your phone becomes your dev environment
- Three channels, three agent providers, one clean architecture
- Open-source — anyone can add a channel or agent

---

## Appendix

### Competitive Landscape
- [Clawdbot/Moltbot](https://www.contextstudios.ai/blog/clawdbot-the-complete-guide-to-the-viral-open-source-ai-assistant-2026) — 69k+ stars, multi-channel, self-hosted. The market leader.
- [claude-code-discord-bridge](https://github.com/ebibibi/claude-code-discord-bridge) — Discord frontend for Claude Code via threads
- [claude-code-discord](https://github.com/zebbern/claude-code-discord) — Discord bot for Claude Code with shell/git
- [claude-code-telegram](https://github.com/RichardAtCT/claude-code-telegram) — Telegram bot for Claude Code, session persistence
- [Remote Agentic Coding System](https://github.com/coleam00/remote-agentic-coding-system) — Multi-platform (Slack, Telegram, GitHub) with Claude Code or Codex
- [Happy](https://happy.engineering/) — Commercial Claude Code mobile client
- [OpenWork](https://github.com/different-ai/openwork) — Open-source Claude Cowork alternative with messaging connectors
- [Open-Claude-Cowork](https://github.com/ComposioHQ/open-claude-cowork) — Clawdbot-based with multi-channel adapters
- [OpenCode Telegram Bot](https://github.com/grinev/opencode-telegram-bot) — Telegram client for OpenCode CLI
- [Copilot Telegram Bot](https://dev.to/julianchun/copilot-telegram-bot-a-secure-mobile-first-agent-in-your-pocket-5ah6) — Bridges Telegram to GitHub Copilot CLI

### Predecessor
- [TextSlash (WhatsApp Agentic Development Cockpit)](docs/PRD_WHATSAPP_AGENTIC_COCKPIT.md) — The WhatsApp-only predecessor. Phases 1-8 validated the core architecture. BuffBaby extends it to multi-channel + multi-agent.

### Technical References
- [Discord Developer Portal](https://discord.com/developers/docs)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Twilio WhatsApp API](https://www.twilio.com/docs/whatsapp)
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)
- [Fly.io Machines API](https://fly.io/docs/machines/api/)
