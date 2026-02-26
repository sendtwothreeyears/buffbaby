# Contributing

## Philosophy

textslash follows a "skills-over-features" model. The core stays minimal (~225 LOC across two servers). New capabilities go through the [Claude Code skills system](https://docs.anthropic.com/en/docs/claude-code/tutorials#create-custom-slash-commands) rather than core code changes.

**We accept:** Bug fixes, security improvements, documentation improvements, performance optimizations, simplification of existing code.

**New features:** Open an issue first to discuss. Major features should be implemented as Claude Code skills, not core code changes.

## Getting Started

### Two-Install Setup

The project has two `package.json` files — one for each server:

```bash
npm install            # Relay server deps (root)
cd vm && npm install   # VM server deps
```

### Running Locally

1. Copy `.env.example` → `.env` in both root and `vm/`
2. Fill in Twilio and Anthropic credentials
3. `docker compose up -d`  — start VM
4. `npm run dev`            — start relay (with file watching)
5. `ngrok http 3000`        — tunnel for Twilio webhooks
6. Update Twilio phone number webhook URL to `<ngrok-url>/sms`

### Code Style

- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- Keep files under 200 LOC — if it's bigger, split it
- No unnecessary abstractions — three lines of repetition > premature DRY
- Vanilla Node.js — no TypeScript, no build step

## PR Process

1. Fork and create a branch (`feat/...`, `fix/...`)
2. Make your changes
3. Ensure no secrets in your diff
4. Open a PR with a clear description of what and why

## Project Structure

```
textslash/
├── server.js              # Relay server (Twilio ↔ SMS)
├── vm/
│   ├── vm-server.js       # VM server (HTTP API ↔ Claude Code)
│   ├── Dockerfile         # Container image
│   └── package.json       # VM dependencies
├── docker-compose.yml     # VM orchestration
├── package.json           # Relay dependencies
├── .claude/skills/        # Claude Code skills (extensibility layer)
└── docs/                  # Plans, brainstorms, solutions
```
