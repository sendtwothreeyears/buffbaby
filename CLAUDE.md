# WhatsApp Agentic Development Cockpit

## About This Project

A WhatsApp-based interface for agentic development workflows. Engineers send a WhatsApp message and control Claude Code (running on a cloud VM) entirely via WhatsApp — no additional app to download, no laptop required.

**Core thesis:** WhatsApp is the world's most popular messaging app — 2B+ users, rich formatting (monospace code blocks), reliable delivery (in-order, read receipts). Diffs as monospace text, previews as screenshots, approvals as text replies. The conversation thread is the project log.

**PRD:** `docs/PRD_WHATSAPP_AGENTIC_COCKPIT.md` — the full product specification. Read this first for product context.

## Architecture

```
Phone (WhatsApp) → Twilio → Relay Server → Cloud VM (Claude Code + Playwright)
```

Three components:
1. **Relay Server** (`server.js`) — Express server. Receives Twilio webhooks, authenticates by phone number, sends responses as WhatsApp messages.
2. **Cloud VM** (`vm/`) — always-on Docker container per user. Contains Claude Code CLI, Playwright, Node.js, git, Chromium. Runs identically local and in production.
3. **Twilio** — WhatsApp transport. Webhooks inbound, API outbound. WhatsApp via Twilio Sandbox (dev) or Business number (prod).

**Phase plan:** `docs/plans/phases/00-overview.md` — sequenced development phases.

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

## Context

Early-stage open-source project. Prioritize simplicity — avoid over-engineering. Ship working software efficiently. Container-first development: if it works in Docker locally, it works in production.

### Developer Identity

The current developer's name is derived from `git config user.name`.

**Push back like a senior engineer.** If a request could cause bugs, side effects, technical debt, or architectural problems — say so directly. Don't just execute questionable instructions; flag concerns and propose better alternatives.

## Documentation

### Three-Tier Hierarchy

1. **Docs** (`docs/`): Persistent documentation — plans, brainstorms, solutions, PRD, phase plan, competitive analysis. Kept accurate over time.
2. **Notes** (`notes/`): Temporary work-in-progress material. Gitignored. Promote to docs when stable.

### Key Directories

| Path | Purpose |
|------|---------|
| `docs/plans/` | Plan files created by `/workflow:plan` |
| `docs/brainstorms/` | Brainstorm documents from `/workflow:brainstorm` |
| `docs/solutions/` | Solved problems documented by `/workflow:compound` |
| `notes/` | Temporary notes, review artifacts (gitignored) |
| `.claude/skills/` | All skills in flat structure (prefixed by category, e.g., `workflow:brainstorm`, `utilities:compushar`, `code-review`) |
| `.claude/subagents/` | Shared subagent definitions used by workflow skills |

## Workflow

### The Loop

The core development loop. Each phase of the project cycles through steps 2–6:

```
1. /workflow:phase-prd ──── Split PRD into sequenced phases (once, at project start)
       │
       ▼
2. /workflow:brainstorm ─── Explore what to build for this phase
       │                    ↕ /workflow:document-review (optional refinement)
       ▼
3. /workflow:plan ───────── Structure how to build it → docs/plans/
       │                    ↕ /workflow:document-review (optional refinement)
       ▼
4. /workflow:ship ───────── Implement + code review + PR
       │                    Uses: code-review, code-review-critical
       │                    Uses: subagents (learnings-researcher, code-simplicity-reviewer)
       ▼
5. /workflow:phase-review ── Validate the phase is done (PASS/FAIL)
       │                     Uses: subagent (learnings-researcher)
       ▼
6. /workflow:compound ───── Document what you learned → docs/solutions/
       │
       └──► Next phase → back to step 2
```

### Review Criteria (used internally by workflow skills)

- `code-review` — standard review (architectural, tactical, stakeholder perspectives)
- `code-review-critical` — adversarial review (failure modes, edge cases, security)

### Subagents (shared research agents in `.claude/subagents/`)

| Subagent | Purpose | Used by |
|----------|---------|---------|
| `learnings-researcher` | Search `docs/solutions/` for past learnings | brainstorm, plan, ship, phase-review |
| `repo-research-analyst` | Analyze repo structure and patterns | brainstorm, plan |
| `best-practices-researcher` | Research external best practices | plan |
| `framework-docs-researcher` | Research framework documentation | plan |
| `spec-flow-analyzer` | Analyze feature specs for gaps | plan |
| `code-simplicity-reviewer` | YAGNI and simplification review | ship |

### Utilities (standalone tools)

- `utilities:compushar` — quick commit → push → PR
- `utilities:fix-the-things` — automated environment repair
- `utilities:investigate` — multi-agent bug investigation (Claude + Codex + Gemini)
- `utilities:wrap-it-up` — quad-agent code review, fix, commit, PR, sanity check
- `utilities:meta-learn` — extract and document learnings
- `utilities:capture-skill` — save workflows as reusable skills

## Communication Style

When providing feedback with multiple items, use a **numbered list**. This allows quick responses like "do 1, 3, and 4" or "skip 2".

### Recognizing Thrashing

If you notice repeated failed attempts at the same problem (3+ tries), circular debugging, or user frustration, pause and acknowledge it directly:

> "This isn't going as intended. We may be thrashing."

Then generate a **handoff prompt** for a fresh agent session containing:
1. **Actions taken**: What we tried and why it didn't work
2. **Current state**: Relevant file states, error messages, test output
3. **Observed behavior**: What's actually happening vs. expected
4. **Possible directions**: A few hypotheses, framed openly

## Git Workflow

- Branch naming: `feat/<description>`, `fix/<description>`, or phase-based names
- Default branch detected dynamically — no hardcoded assumptions
- Commit format: conventional commits (`feat(scope): description`)

## Testing

**Unit test fixes:** When asked to fix failing tests, first understand *why* they failed. Treat failures as signals of incorrect logic, not just brittle tests. If the root cause is business logic, stop and flag it before changing tests.

**Test runs:** Always report the number of failing tests in your output.

## Safety Rules

**NEVER execute these commands without explicit user approval:**

```bash
# File deletion
rm -rf, rm -f, find . -delete

# Git destructive operations
git push --force, git reset --hard

# Package management
npm ci --force, npm cache clean --force

# Database destructive commands
DROP TABLE, DELETE FROM (without WHERE), migrations that destroy data
```

**How to get approval:** Before running any destructive command, STOP and ask: "This command will [describe impact]. Do you want me to proceed?" Wait for a clear "yes" before executing.

## Project-Specific Conventions

### WhatsApp Constraints

- 24-hour session window — system can only reply within 24h of user's last message
- Sandbox requires join code before first use
- 1 media attachment per message (multiple images = multiple messages)
- 4096-char message limit
- Monospace code blocks supported (triple backtick)
- 16MB media limit

### Docker-First Development

- The Docker image must run identically on a Mac (local) and Fly.io (production)
- Local development: relay + Docker container on Mac, ngrok for Twilio webhooks
- Production: same Docker image on Fly.io, same relay server on Railway/Fly.io
- Environment differences between local and production should be config-only (`.env`)

### Key Integrations

| Service | Purpose |
|---------|---------|
| **Twilio** | WhatsApp transport — webhooks inbound, API outbound. Sandbox (dev) or Business number (prod). |
| **Claude Code CLI** | Headless agent execution on the VM |
| **Playwright** | Screenshot capture, page navigation, app interaction |
| **GitHub** | Repos, PRs, OAuth for user onboarding |
| **Fly.io** | Always-on cloud VMs (one per user) |

## Self-Improvement

This project is designed to get smarter over time. **Updating CLAUDE.md with lessons learned is part of your job.**

### When to add a lesson

- Spent significant time debugging something non-obvious
- Discovered a pattern or constraint that isn't documented
- Hit a gotcha that would trip up the next agent session
- Found existing documentation is wrong or misleading

### Format

Keep entries concise. One line per lesson:

```markdown
## Lessons Learned

- **Twilio**: Webhook signature validation fails if ngrok URL changes — update .env
- **Docker**: Playwright needs `--no-sandbox` flag in Docker containers
- **WhatsApp**: 24-hour session window — can only reply within 24h of user's last message
```

## Lessons Learned

- **Flycast**: Use port 80 (default), NOT the internal_port. `http://app.flycast/health` works; `http://app.flycast:3001/health` returns ECONNRESET. Fly Proxy maps port 80 → internal_port automatically.
- **Flycast**: `.flycast` routes through Fly Proxy (enables auto-start). `.internal` goes direct to the Machine (no auto-start for stopped VMs).
- **Twilio WhatsApp Sandbox**: 1600-char message limit (stricter than WhatsApp's 4096). Long responses must be chunked.
- **Fly.io Volumes**: Mounting a Volume at `/data` overlays the container filesystem — directories created in the Dockerfile under `/data` are wiped. Always `mkdirSync` on startup for subdirs like `/data/images`.
- **Fly.io deploy**: Creates 2 machines by default for HA. `min_machines_running = 1` only controls auto-stop minimum, NOT total count. For stateful single-machine apps, run `fly scale count 1` after first deploy.
- **Flycast cold-start**: For fast-booting containers (~1-2s), Fly Proxy holds the connection and routes transparently — the relay never sees ECONNREFUSED. The retry loop is a fallback for slower starts (10s+).
