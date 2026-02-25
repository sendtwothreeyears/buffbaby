# SMS Agentic Development Cockpit

## About This Project

An SMS-based interface for agentic development workflows. Engineers text a phone number and control Claude Code (running on a cloud VM) entirely via SMS/MMS — no app to download, no laptop required.

**Core thesis:** SMS is the one universal interface on every phone. Diffs are images. Previews are screenshots. Approvals are text replies. The conversation thread is the project log.

**PRD:** `PRD_SMS_AGENTIC_COCKPIT.md` — the full product specification. Read this first for product context.

## Architecture

```
Phone (SMS) → Twilio → Relay Server → Cloud VM (Claude Code + Playwright MCP)
```

Three components:
1. **Relay Server** — thin Node.js server (~200-300 LOC). Receives Twilio webhooks, authenticates by phone number, forwards commands to Claude Code on the user's VM, sends responses back as SMS/MMS.
2. **Cloud VM** — always-on Docker container per user (Fly.io). Contains Claude Code CLI, Playwright MCP, Node.js, git, Chromium. Runs identically local and in production.
3. **Twilio** — SMS/MMS transport. Webhooks inbound, API outbound.

**Phase plan:** `PHASE_PLAN_SMS_AGENTIC_COCKPIT.md` — sequenced development phases.

## Context

Solo developer, early-stage project. Prioritize simplicity — avoid over-engineering. Ship working software efficiently. Container-first development: if it works in Docker locally, it works in production.

### Developer Identity

The current developer's name is derived from `git config user.name`.

**Push back like a senior engineer.** If a request could cause bugs, side effects, technical debt, or architectural problems — say so directly. Don't just execute questionable instructions; flag concerns and propose better alternatives.

## Documentation

### Three-Tier Hierarchy

1. **Docs** (`docs/`): Persistent documentation — plans, brainstorms, solutions. Kept accurate over time.
2. **Notes** (`notes/`): Temporary work-in-progress material. Gitignored. Promote to docs when stable.
3. **Root-level docs**: PRD, phase plan, competitive analysis — project-level reference material.

### Key Directories

| Path | Purpose |
|------|---------|
| `docs/plans/` | Plan files created by `/workflow:plan` |
| `docs/brainstorms/` | Brainstorm documents from `/workflow:brainstorm` |
| `docs/solutions/` | Solved problems documented by `/workflow:compound` |
| `notes/` | Temporary notes, review artifacts (gitignored) |
| `.claude/commands/` | Slash commands organized by folder |
| `.claude/skills/` | Skills loaded by commands |
| `.claude/subagents/` | Subagent definitions for research tasks |

## Workflow

The core development loop uses skills in `.claude/commands/workflow/`:

1. `/workflow:phase-prd` — split PRD into sequenced phases
2. `/workflow:brainstorm` — explore what to build for a phase
3. `/workflow:plan` — structure how to build it → writes to `docs/plans/`
4. `/workflow:ship` — implement + code review + PR
5. `/workflow:phase-review` — validate phase deliverables
6. `/workflow:compound` — document what you learned → writes to `docs/solutions/`

**Review criteria** (used internally by `/workflow:ship`):
- `review-criteria:code_review` — standard review
- `review-criteria:code_review_critical` — adversarial review

**Utilities** (standalone tools):
- `utilities:compushar` — quick commit → push → PR
- `utilities:fix-the-things` — automated environment repair
- `utilities:investigate` — multi-perspective bug investigation

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

### SMS/MMS Constraints

- SMS has no formatting — no markdown, no syntax highlighting in text
- All visual content (diffs, previews, review summaries) must be rendered as images sent via MMS
- SMS segments are 160 chars (GSM-7) or 70 chars (UCS-2/emoji) — keep text responses concise
- MMS images must be < 1MB: PNG for diffs (sharp text), JPEG for screenshots

### Docker-First Development

- The Docker image must run identically on a Mac (local) and Fly.io (production)
- Local development: relay + Docker container on Mac, ngrok for Twilio webhooks
- Production: same Docker image on Fly.io, same relay server on Railway/Fly.io
- Environment differences between local and production should be config-only (`.env`)

### Key Integrations

| Service | Purpose |
|---------|---------|
| **Twilio** | SMS/MMS transport — webhooks inbound, API outbound |
| **Claude Code CLI** | Headless agent execution on the VM |
| **Playwright MCP** | Screenshot capture, page navigation, app interaction |
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
- **MMS**: Images over 1MB silently fail on some carriers — always compress
```

## Lessons Learned

_(None yet — add lessons here as you discover them)_
