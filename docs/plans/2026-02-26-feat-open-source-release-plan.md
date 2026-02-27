---
title: "feat: Open-Source Release Preparation"
type: feat
status: completed
date: 2026-02-26
brainstorm: docs/brainstorms/2026-02-26-open-source-release-brainstorm.md
---

# Open-Source Release Preparation

## Overview

Prepare textslash for public open-source release under MIT license. The project is a WhatsApp-based interface for agentic development workflows — send a WhatsApp message, control Claude Code on a cloud VM entirely via WhatsApp. Phases 1-4 are complete with working code across a relay server and Docker VM server.

This plan covers: security hardening, documentation for external audience, developer experience improvements, and minor code changes. It explicitly does **not** include implementing Phase 3 (wiring relay to VM) — the release is honest about the project's alpha state.

## Problem Statement

The repo is functional but internal-facing:
- README describes a completely different project ("Authentic's Agentic Engineering Techniques")
- No LICENSE, CONTRIBUTING.md, SECURITY.md, ARCHITECTURE.md, or CHANGELOG.md
- No `.dockerignore`
- `package.json` files marked `private: true` with no metadata
- Git remote `upstream` points to the previous project's repo
- Git history contains previous project identity in early commits
- No Channel abstraction — WhatsApp transport is hardcoded
- No `/setup` skill for AI-native onboarding

## Proposed Solution

Execute in four ordered phases: Security (blockers) → Documentation (core files) → Code Changes (abstractions + DX) → Polish (templates, tagging). Each phase is independently shippable.

## Technical Approach

### Phase 1: Security & Identity Cleanup

**Goal:** Remove all traces of the previous project identity and ensure no sensitive data is exposed.

#### 1a. Git History Decision

The git history contains the initial commit message "Initial commit: Authentic's agentic engineering techniques" and early commits referencing the old project. Two options:

**Option A: Keep history as-is (Recommended)**
- Pros: Simple, preserves commit provenance, no force-push
- Cons: Old project name visible in `git log`
- Mitigation: The README and project description make the current identity clear

**Option B: Squash to new initial commit**
- Pros: Clean history, no old references
- Cons: Loses commit-level provenance for Phases 1-2 work, requires force-push

**Recommendation:** Option A. The old references are cosmetic — no secrets, no sensitive data. The 20-commit history shows thoughtful development and is a feature for contributors.

#### 1b. Remove `upstream` Remote

```bash
git remote remove upstream
```

The `upstream` remote points to `https://github.com/AuthenticTechnology/Agentic-Engineering` — a completely different project. Must be removed before any contributor runs `git remote -v`.

#### 1c. Add `.dockerignore`

Create `/Users/Shared/Code/textslash/vm/.dockerignore`:

```dockerignore
.env
.env.*
!.env.example
node_modules/
.git/
.DS_Store
```

Also create `/Users/Shared/Code/textslash/.dockerignore` (root level, for if build context ever changes):

```dockerignore
.env
.env.*
!.env.example
node_modules/
.git/
notes/
archive/
docs/
.claude/
*.md
!README.md
```

#### 1d. Gitignore `.claude/settings.local.json`

This file contains WebFetch domain permissions accumulated during research. It is NOT currently tracked (confirmed), but should be explicitly gitignored to prevent accidental commits.

Add to `.gitignore`:
```
# Claude Code local settings (personal permissions)
.claude/settings.local.json
```

#### 1e. Rotate Credentials

Not automatable — requires manual action by the developer:
- [ ] Rotate Twilio Account SID and Auth Token at console.twilio.com
- [ ] Rotate Anthropic API key at console.anthropic.com
- [ ] Update local `.env` and `vm/.env` with new credentials
- [ ] Verify the system still works with new credentials

#### 1f. Verify No Secrets in Git History

Already confirmed by repo research: `.env` files were never committed. The `.gitignore` has covered them since the first commit. No `git filter-repo` needed.

**Files modified:** `.gitignore`, `vm/.dockerignore` (new), `.dockerignore` (new)

---

### Phase 2: Core Documentation

**Goal:** Create all documentation files needed for an open-source project. Every file a developer expects to find when landing on the repo.

#### 2a. README.md — Complete Rewrite

The current README (229 lines) describes "Authentic's Agentic Engineering Techniques" — a completely different project. It must be replaced entirely.

**Structure:**

```markdown
# textslash

> Control a cloud dev environment from any phone. No laptop required. Just WhatsApp.

[one-paragraph description of what textslash is]

## Why WhatsApp?

[3-4 bullet points: 2B+ users, rich formatting (monospace code blocks), 16MB media, reliable delivery]

## Architecture

Phone (WhatsApp) → Twilio → Relay Server → Docker VM (Claude Code)

[ASCII diagram of the three-layer system]

## Status

Alpha — Phases 1-4 complete. The relay server handles WhatsApp messages via Twilio. The Docker VM runs Claude Code headlessly via HTTP API.

[honest status table of what works and what doesn't]

## Quickstart

### Prerequisites
- Node.js 22+
- Docker
- A Twilio account with WhatsApp Sandbox (dev) or Business API (prod)
- An Anthropic API key
- ngrok (for local development)

### Option A: AI-Native Setup (Recommended)
git clone ... && cd textslash && claude
Then run /setup and follow the prompts.

### Option B: Manual Setup
[step-by-step: .env config, Docker build, relay start, ngrok, Twilio webhook config]

### Try It
1. WhatsApp relay: Send a WhatsApp message to the Twilio sandbox number, get a response
2. Claude Code VM: curl -X POST http://localhost:3001/command -d '{"prompt":"hello"}'

## How It Compares

[Brief, respectful positioning vs NanoClaw — focus on what's different, not what's better]

## Contributing

See CONTRIBUTING.md. TL;DR: bug fixes and simplifications welcome. New features go through the skills system.

## License

MIT
```

**Key principle:** Be honest about alpha state. Present the current state accurately and highlight what works and what's next.

#### 2b. LICENSE

Standard MIT license file at repo root. Use the developer's name from `git config user.name`.

#### 2c. ARCHITECTURE.md

```markdown
# Architecture

## Three-Layer System

Phone (WhatsApp) ←→ Twilio ←→ Relay Server ←→ Docker VM

### Layer 1: Relay Server (server.js — 64 LOC)
[Express server, Twilio webhooks, phone allowlist, WhatsApp media support]

### Layer 2: Docker VM (vm/vm-server.js — 157 LOC)
[HTTP API wrapping Claude Code CLI, single-command concurrency, image serving]
[Endpoints: POST /command, GET /health, GET /images/:filename]

### Layer 3: Twilio Transport
[Inbound: webhooks. Outbound: Twilio API. WhatsApp media for images]

## File Map

| File | Purpose | LOC |
|------|---------|-----|
| server.js | Relay server — receives WhatsApp messages, sends responses | 64 |
| vm/vm-server.js | VM HTTP API — wraps Claude Code CLI | 157 |
| vm/Dockerfile | Docker image — Node 22, Chromium, Claude Code | 51 |
| docker-compose.yml | VM orchestration | 13 |

## Data Flow

[Inbound WhatsApp flow diagram]
[Outbound response flow diagram]
[Image rendering pipeline (future)]

## Design Decisions

- Persistent VMs (not ephemeral containers) — users need project state
- Webhooks (not polling) — WhatsApp requires low-latency delivery
- Non-root Docker user — required by Claude Code for --dangerously-skip-permissions
- Single-command concurrency — prevents resource contention on the VM

## Channel Architecture

The relay server uses WhatsApp via Twilio as its transport channel. See the Channel interface design in CONTRIBUTING.md.
```

#### 2d. SECURITY.md

Honest security posture document. Acknowledge what IS secure and what ISN'T.

```markdown
# Security

## Threat Model

textslash runs Claude Code with --dangerously-skip-permissions on a Docker VM. This grants full system access within the container. The security model relies on:

1. Container isolation (Docker)
2. Network isolation (VM not exposed to public internet)
3. Phone number allowlist (relay server)
4. Twilio as trusted transport

## What's Implemented

- Phone number allowlist — only configured numbers can send commands
- Non-root container user — limits container escape impact
- Path traversal protection on image endpoint
- 10MB output buffer cap — prevents OOM attacks
- Process group killing — prevents orphan processes
- Env var validation — fail-fast on missing config

## Known Limitations (Intentional Debt)

- **No Twilio webhook signature validation** — anyone who discovers the webhook URL can spoof messages. Planned for Phase 3.
- **No authentication on VM /command endpoint** — the VM trusts all HTTP requests. The VM should only be accessible from the relay server (Docker network or localhost).
- **--dangerously-skip-permissions** — required for headless Claude Code operation. The container can execute any command.
- **No rate limiting** — a compromised phone number could flood the VM.
- **No encryption at rest** — project files on the VM are unencrypted.

## Responsible Disclosure

[Contact information for reporting security issues]

## For Self-Hosters

- Never expose the VM port (3001) to the public internet
- Use strong, unique credentials in .env files
- Rotate Twilio and Anthropic API keys regularly
- Review the phone number allowlist
- Consider running behind a VPN or private network
```

#### 2e. CONTRIBUTING.md

```markdown
# Contributing

## Philosophy

textslash follows a "skills-over-features" model (inspired by NanoClaw). The core stays minimal. New capabilities go through the Claude Code skills system.

**We accept:** Bug fixes, security improvements, documentation improvements, test coverage, performance optimizations, simplification of existing code.

**New features:** Open an issue first to discuss. Major features should be implemented as Claude Code skills, not core code changes.

## Getting Started

### Two-Install Setup
The project has two package.json files:
npm install          # Relay server deps
cd vm && npm install # VM server deps

### Running Locally
1. Copy .env.example to .env in both root and vm/
2. Fill in Twilio and Anthropic credentials
3. docker compose up      # Start VM
4. npm run dev             # Start relay
5. ngrok http 3000         # Tunnel for Twilio webhooks
6. Update Twilio webhook URL to ngrok URL

### Code Style
- Conventional commits (feat:, fix:, refactor:, docs:)
- Keep files under 200 LOC — if it's bigger, split it
- No unnecessary abstractions — three lines of repetition > premature DRY

## PR Process

1. Fork and create a branch (feat/..., fix/...)
2. Make your changes
3. Ensure no secrets in your diff
4. Open a PR with a clear description

## Channel Abstraction (Future)

The relay server will adopt a Channel interface for transport abstraction:

interface Channel {
  name: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendMessage(to: string, text: string, mediaUrl?: string): Promise<void>;
  isConnected(): boolean;
}

WhatsApp via Twilio is the current implementation.
```

#### 2f. CHANGELOG.md

```markdown
# Changelog

## [Unreleased]

### Added
- Open-source release preparation
- LICENSE (MIT), CONTRIBUTING.md, SECURITY.md, ARCHITECTURE.md
- .dockerignore files
- AI-native /setup skill

## [0.1.0-alpha] — 2026-02-26

### Phase 2: Docker VM Image
- Docker container with Claude Code CLI + Chromium + Playwright
- HTTP API wrapper (POST /command, GET /health, GET /images/:filename)
- Non-root container user
- Single-command concurrency with configurable timeout
- Path traversal protection on image serving
- 10MB output buffer cap
- Process group management for clean shutdown

### Phase 1: WhatsApp Echo Server
- Express relay server with Twilio webhook integration
- Phone number allowlist authentication
- WhatsApp media test response
- Environment variable validation at startup
- ngrok tunnel for local development
```

#### 2g. Update `CLAUDE.md` — Key-Files Routing Table

Add a key-files routing table near the top of CLAUDE.md (after Architecture section) for contributor/agent orientation:

```markdown
## Key Files

| File | What It Does | When to Read |
|------|-------------|--------------|
| `server.js` | Relay server — Twilio webhooks, phone allowlist, WhatsApp messaging | Changing relay behavior |
| `vm/vm-server.js` | VM API — Claude Code CLI wrapper, image serving | Changing VM behavior |
| `vm/Dockerfile` | Container image — Node 22, Chromium, Claude Code | Changing container setup |
| `docker-compose.yml` | VM orchestration — ports, memory, env | Changing local dev setup |
| `.env.example` | Relay env vars template | Adding new config |
| `vm/.env.example` | VM env vars template | Adding new VM config |
| `ARCHITECTURE.md` | System design and data flow | Understanding the system |
| `SECURITY.md` | Security posture and known limitations | Security-related changes |
```

Also update the "Context" section — change "Solo developer, early-stage project" to "Early-stage open-source project" and add contributor context.

---

### Phase 3: Code Changes

**Goal:** Minor code changes to improve DX and prepare for future extensibility.

#### 3a. Rename `NGROK_URL` → `PUBLIC_URL`

In `server.js` and `.env.example`, rename the environment variable from `NGROK_URL` to `PUBLIC_URL`. This decouples the config from the specific tunneling tool — in production (Fly.io), there's no ngrok.

**Files:** `server.js`, `.env.example`

#### 3b. Add Health Check to Relay Server

The VM server has `GET /health` but the relay server doesn't. Add a matching endpoint for production readiness:

```javascript
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'textslash-relay' });
});
```

**File:** `server.js`

#### 3c. Update `package.json` Files

Both `package.json` files need metadata updates:

```json
{
  "private": false,
  "author": "<git config user.name>",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/<owner>/textslash.git"
  },
  "homepage": "https://github.com/<owner>/textslash",
  "bugs": {
    "url": "https://github.com/<owner>/textslash/issues"
  },
  "keywords": ["whatsapp", "claude", "ai", "development", "twilio"],
  "engines": {
    "node": ">=22.0.0"
  }
}
```

**Files:** `package.json`, `vm/package.json`

#### 3d. Commit `package-lock.json`

Run `npm install` in both root and `vm/` to generate lockfiles, then commit them. Deterministic builds are essential for contributors.

**Files:** `package-lock.json` (new), `vm/package-lock.json` (new)

#### 3e. Move Internal Documents

Decide placement of root-level internal documents:

| Document | Recommendation | Rationale |
|----------|---------------|-----------|
| `PRD_WHATSAPP_AGENTIC_COCKPIT.md` | Move to `docs/` | Contains internal author name and business strategy — valuable for transparency but shouldn't clutter root |
| `COMPETITIVE_ANALYSIS_WHATSAPP_AGENTIC.md` | Move to `docs/` | Names competitors extensively — useful context but not a root-level file |
| `PHASE_PLAN_SMS_AGENTIC_COCKPIT.md` | Deleted (superseded by `docs/plans/phases/00-overview.md`) | Individual phase plans in `docs/plans/phases/` are authoritative |

Root directory after cleanup should contain only: `README.md`, `LICENSE`, `ARCHITECTURE.md`, `SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `CLAUDE.md`, `package.json`, `package-lock.json`, `server.js`, `docker-compose.yml`, `.env.example`, `.gitignore`, `.dockerignore`

#### 3f. Remove Empty Directories from Tracking Context

Clean up empty or vestigial directories that could confuse contributors:
- `utilities:call-sub/` — empty skill directory, remove
- `scripts/sync-commands-to-codex.sh` — personal maintainer tool, add to `.gitignore` or move to user dotfiles

---

### Phase 4: Developer Experience & Polish

**Goal:** AI-native onboarding, templates, and release tagging.

#### 4a. Build `/setup` Skill

Create `.claude/skills/setup/SKILL.md` — an AI-native installer that walks developers through the entire setup process.

**The skill should:**

1. **Detect OS** — Mac, Linux, Windows (warn on Windows: untested)
2. **Check prerequisites:**
   - Node.js ≥ 22 (`node --version`)
   - Docker (`docker --version`)
   - ngrok (`ngrok --version`) — suggest alternatives (Cloudflare Tunnel) if missing
   - Twilio CLI (`twilio --version`) — optional, can use web console instead
3. **Guide `.env` creation:**
   - Copy `.env.example` → `.env` in both root and `vm/`
   - Prompt for Twilio Account SID, Auth Token, Phone Number
   - Prompt for Anthropic API Key
   - Prompt for allowed phone numbers
   - Validate format of each credential
4. **Build Docker image:**
   - `docker compose build`
   - Verify build succeeds
   - Warn about ~2GB image size (Chromium)
5. **Start services:**
   - `docker compose up -d`
   - Verify VM health: `curl http://localhost:3001/health`
   - Start relay: `npm run dev` (in background or separate terminal guidance)
6. **Setup ngrok tunnel:**
   - `ngrok http 3000`
   - Extract public URL
   - Update `PUBLIC_URL` in `.env`
7. **Configure Twilio webhook:**
   - Guide to Twilio console → Phone Number → Messaging → Webhook URL
   - Or configure WhatsApp Sandbox webhook URL in Twilio Console to point to `<ngrok-url>/sms`
8. **Verify end-to-end:**
   - "Send a WhatsApp message to the Twilio sandbox number now"
   - Check relay logs for inbound message
   - Confirm echo response received

**Important warnings to include:**
- **WhatsApp Sandbox:** Users must send a join code to the sandbox number before first use. The `/setup` skill should guide this step.
- **Twilio trial limitations:** Trial accounts can only send to verified numbers. The skill should detect trial mode and explain the limitation.

#### 4b. Add `.github/` Templates

Create `.github/ISSUE_TEMPLATE.md`:
```markdown
## Description
[What is the issue?]

## Steps to Reproduce (bugs)
1.
2.
3.

## Expected Behavior

## Actual Behavior

## Environment
- OS:
- Node.js version:
- Docker version:
```

Create `.github/PULL_REQUEST_TEMPLATE.md`:
```markdown
## What
[Brief description of changes]

## Why
[Motivation / issue reference]

## Testing
- [ ] Tested locally
- [ ] No secrets in diff

## Type
- [ ] Bug fix
- [ ] Feature (via skill)
- [ ] Documentation
- [ ] Refactor
```

#### 4c. Tag Release

After all changes are merged to `main`:

```bash
git tag -a v0.1.0-alpha -m "Initial open-source release — Phases 1-2 complete"
git push origin v0.1.0-alpha
```

---

## Acceptance Criteria

### Functional Requirements

- [ ] README accurately describes textslash with quickstart instructions
- [ ] MIT LICENSE file exists at repo root
- [ ] ARCHITECTURE.md documents the three-layer system with file map
- [ ] SECURITY.md honestly documents security posture and known limitations
- [ ] CONTRIBUTING.md explains PR process and skills-over-features model
- [ ] CHANGELOG.md documents Phases 1-2
- [ ] `/setup` skill successfully walks a new developer through complete setup
- [ ] `.dockerignore` files prevent secrets and unnecessary files from entering Docker builds
- [ ] Both `package.json` files have correct metadata (author, license, repository, etc.)
- [ ] `package-lock.json` committed for both projects
- [ ] `CLAUDE.md` has key-files routing table
- [ ] Git remote `upstream` removed
- [ ] `PUBLIC_URL` replaces `NGROK_URL` in server.js and .env.example
- [ ] Relay server has `/health` endpoint
- [ ] Internal docs (PRD, competitive analysis, old phase plan) moved to `docs/`

### Non-Functional Requirements

- [ ] No real secrets anywhere in git history (already confirmed)
- [ ] `.claude/settings.local.json` explicitly gitignored
- [ ] Root directory contains only essential project files
- [ ] All documentation is honest about alpha state and what works vs. what doesn't

### Quality Gates

- [ ] A fresh `git clone` → read README → understand what the project is (< 60 seconds)
- [ ] A fresh `git clone` → `claude` → `/setup` → working system (< 15 minutes)
- [ ] No references to "Authentic" or the previous project in any tracked file

---

## Dependencies & Prerequisites

- Developer must manually rotate Twilio and Anthropic credentials (Phase 1e)
- GitHub repo name/URL decision needed for package.json metadata (Phase 3c)
- Decision on git history strategy — keep or squash (Phase 1a)

## Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| WhatsApp Sandbox join-code friction for new contributors | Medium | Low | Document prominently in setup guide, include step-by-step |
| `/setup` skill fails on untested OS/configs | Medium | Medium | Start with Mac + Linux, document Windows as unsupported |
| Competitive backlash from NanoClaw community | Low | Low | Position as complementary (WhatsApp-native dev tool), not competitive |

## Implementation Order

```
Phase 1 (Security) ─── can ship alone as a prep commit
    ↓
Phase 2 (Documentation) ─── can ship alone, makes repo presentable
    ↓
Phase 3 (Code Changes) ─── requires Phase 2 for context
    ↓
Phase 4 (DX & Polish) ─── requires Phases 2-3 complete
    ↓
Make repo public + tag v0.1.0-alpha
```

**Estimated scope:** ~10-15 new files, ~5-8 modified files, 0 LOC of application logic (except health endpoint and env var rename).

## Not In Scope (Explicitly Deferred)

- **Phase 3 relay-to-VM wiring** — separate phase plan, not part of OSS release
- **Channel abstraction implementation** — interface documented in CONTRIBUTING.md for future extensibility
- **Test suite** — listed as nice-to-have in brainstorm, deferred to post-release
- **CI/CD pipeline** — no GitHub Actions until there are tests to run
- **WhatsApp Business API (production)** — future phase, currently using Sandbox for dev

## References

### Internal

- Brainstorm: `docs/brainstorms/2026-02-26-open-source-release-brainstorm.md`
- Docker lessons: `docs/solutions/developer-experience/docker-vm-claude-code-headless-setup-20260225.md`
- Twilio lessons: `docs/solutions/developer-experience/whatsapp-echo-server-twilio-ngrok-setup-20250225.md`
- Phase plans: `docs/plans/phases/`

### External

- [NanoClaw GitHub](https://github.com/qwibitai/nanoclaw) — AI-native setup pattern, skills-over-features model
- [Twilio WhatsApp API](https://www.twilio.com/docs/whatsapp) — WhatsApp Sandbox and Business API
