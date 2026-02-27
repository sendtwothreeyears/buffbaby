# Open-Source Release: textslash

**Date:** 2026-02-26
**Status:** Brainstorm complete
**Phase:** Pre-release preparation

## What We're Building

Preparing the textslash project for open-source release. textslash is a WhatsApp-based interface for agentic development workflows — send a WhatsApp message, control Claude Code on a cloud VM entirely via WhatsApp.

**Scope:** WhatsApp only. No other platforms. WhatsApp covers 2B+ users worldwide with rich formatting (monospace code blocks), 16MB media, and reliable in-order delivery.

**Audience:** Developers first (self-host with their own Twilio + Fly.io accounts). Non-technical users later as a hosted service.

**License:** MIT

## Why This Approach

### Positioning vs. NanoClaw

NanoClaw (15k stars, 26 days old) supports WhatsApp, Telegram, Discord, Slack, and Signal. It has momentum and mindshare. textslash is NOT competing with NanoClaw — it fills a different gap:

| textslash | NanoClaw |
|-----------|----------|
| WhatsApp-native (deep integration, rich formatting) | 6 platforms via skills system (shallow per-platform) |
| Twilio webhooks (instant delivery) | Polling loop (2s interval) |
| Persistent VM per user (Fly.io) | Ephemeral containers per conversation |
| Full Claude Code CLI with user's skills/workflows | Claude Agent SDK (limited) |
| Managed service path (hosted VMs) | Self-host only |
| Official Twilio WhatsApp API (no ban risk) | Baileys (unofficial, violates WhatsApp ToS) |

**The pitch:** "What if you could control a cloud dev environment from any phone — no laptop required, just WhatsApp?"

### Why Not Fork NanoClaw or Contribute to It

- NanoClaw has no HTTP server, no webhook handling, no Twilio integration. A WhatsApp-native experience isn't a "skill" you bolt on — it requires a fundamentally different transport layer.
- NanoClaw's architecture (filesystem IPC, polling loop, ephemeral containers) doesn't match the webhook model (instant delivery, persistent VMs, rich media rendering).
- Our relay + Docker VM architecture is already built and working (Phases 1-4 complete).

### Why Not Start a New Repo

- Phases 1-2 are already complete with working code.
- The workflow skills (brainstorm, plan, ship, phase-review) demonstrate a thoughtfully built project.
- Phase plans in `docs/plans/phases/` document the roadmap. This is a feature for contributors, not baggage.
- A clean-room release throws away useful context for zero architectural benefit.

## Key Decisions

### 1. Keep Current Repo, Make It Public-Ready

The current repo has good architecture, clean code (~220 LOC across relay + VM server), and structured documentation. The work is additive:

- Scrub secrets from git history
- Rewrite README for external audience
- Add open-source essentials (LICENSE, CONTRIBUTING.md, .dockerignore)
- Add `/setup` skill for AI-native onboarding
- Add Channel abstraction for future extensibility

### 2. AI-Native Setup (Borrowed from NanoClaw)

NanoClaw's best innovation: `clone → run claude → /setup`. The agent IS the installer. textslash will adopt this pattern:

- A `/setup` skill walks devs through Twilio account creation, `.env` configuration, Docker build, and ngrok tunnel setup
- Claude Code handles prerequisite checking, error recovery, and service startup
- The human only intervenes for auth decisions (Twilio credentials, Anthropic API key)

### 3. Channel Abstraction for Extensibility

Architect with a clean Channel interface for future extensibility. Adopt a simplified version of NanoClaw's Channel interface:

```typescript
interface Channel {
  name: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendMessage(to: string, text: string, mediaUrl?: string): Promise<void>;
  isConnected(): boolean;
}
```

WhatsApp implements this via Twilio webhooks (inbound) + Twilio API (outbound).

### 4. Patterns Adopted from NanoClaw

| Pattern | How We'll Use It |
|---------|-----------------|
| **AI-native `/setup` skill** | Clone → claude → /setup for zero-friction onboarding |
| **Secrets via stdin** | Pass ANTHROPIC_API_KEY to Docker container via stdin, not env vars or mounted files |
| **Honest security docs** | SECURITY.md that acknowledges limitations (e.g., Twilio webhook validation) |
| **Key-files routing in CLAUDE.md** | Concise file map so agents/contributors orient instantly |
| **Skills-over-features contribution model** | Core stays minimal; optional integrations go through skills |
| **Non-root container user** | Already implemented — Claude Code requires this for --dangerously-skip-permissions |

### 5. Patterns Deliberately Different from NanoClaw

| NanoClaw Pattern | textslash Approach | Why |
|------------------|--------------------|-----|
| Polling-based message loop (2s) | Twilio webhooks (instant) | WhatsApp requires low-latency delivery |
| Ephemeral containers per conversation | Persistent VM per user on Fly.io | Users need persistent project state |
| No HTTP server | Express relay + VM HTTP API | Webhooks require HTTP endpoints |
| "Every user forks" model | Single canonical codebase | Hosted service needs consistency |
| 6-platform support via skills | WhatsApp only, deeply integrated | Focused product > feature sprawl |

### 6. WhatsApp Only — No Other Platforms

This is a deliberate constraint, not a limitation. WhatsApp covers 2B+ monthly active users worldwide with rich formatting (monospace code blocks, bold, italic), 16MB media, reliable in-order delivery, and no carrier filtering.

Adding Discord, Telegram, or Slack would dilute the product thesis and put us in direct competition with NanoClaw. One deeply integrated channel is the whole product.

### 7. Open-Source Release Checklist

**Security (BLOCKING):**
- [ ] Scrub `.env` and `vm/.env` from git history (`git filter-repo`)
- [ ] Rotate all exposed credentials (Twilio SID/token, Anthropic API key)
- [ ] Verify `.env.example` files have only placeholders
- [ ] Add `.dockerignore` (exclude .env, .git, node_modules, notes/, archive/)

**Documentation (HIGH):**
- [ ] Rewrite `README.md` — project intro, pitch, architecture diagram, quickstart
- [ ] Add `ARCHITECTURE.md` — three-layer system (WhatsApp → Relay → Docker VM)
- [ ] Add `SECURITY.md` — honest security posture, known limitations
- [ ] Add `CONTRIBUTING.md` — PR process, skills-over-features model, code review expectations
- [ ] Add `LICENSE` (MIT)
- [ ] Update both `package.json` with metadata (author, homepage, repository, bugs)
- [ ] Update `CLAUDE.md` with key-files routing table for contributors

**Developer Experience (HIGH):**
- [ ] Build `/setup` skill — AI-native installer for Twilio + Docker + ngrok
- [ ] Add Channel interface abstraction for future extensibility
- [ ] Add `CHANGELOG.md` documenting Phases 1-2

**Nice-to-Have:**
- [ ] Add `.github/ISSUE_TEMPLATE.md` and `PULL_REQUEST_TEMPLATE.md`
- [ ] Add basic test suite (Vitest) for relay + VM servers
- [ ] Tag release as `v0.1.0-alpha`

## Open Questions

_None — all questions resolved during brainstorm._

## Research Sources

- [NanoClaw GitHub](https://github.com/qwibitai/nanoclaw) — 15k stars, 2.3k forks, MIT license, AI-native setup, skills-over-features model
- [NanoClaw CLAUDE.md](https://github.com/qwibitai/nanoclaw/blob/main/CLAUDE.md) — concise key-files routing pattern
- [NanoClaw CONTRIBUTING.md](https://github.com/qwibitai/nanoclaw/blob/main/CONTRIBUTING.md) — "bug fixes and simplifications accepted, features go through skills"
- [VentureBeat: NanoClaw security](https://venturebeat.com/orchestration/nanoclaw-solves-one-of-openclaws-biggest-security-issues-and-its-already)
- [Countries where WhatsApp is banned](https://www.cloudwards.net/countries-where-whatsapp-is-banned/) — only 4-5 countries fully ban WhatsApp
- [VPN restrictions by country](https://www.comparitech.com/vpn/where-are-vpns-legal-banned/) — devs in restricted countries typically already use VPNs
