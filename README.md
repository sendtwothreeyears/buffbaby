# textslash

> Control a cloud dev environment from any phone. No app. No internet plan. Just SMS.

textslash is an SMS-based interface for agentic development workflows. Text a phone number, control [Claude Code](https://docs.anthropic.com/en/docs/claude-code) running on a cloud VM entirely via SMS/MMS — diffs as images, previews as screenshots, approvals as text replies.

## Why SMS?

- **Universal** — works on every phone ever made, no smartphone required
- **No app install** — zero friction onboarding, just a phone number
- **Works without internet** — SMS uses cellular networks, not data plans
- **Built-in audit trail** — every command and response is in your message history

## Architecture

```
Phone (SMS) → Twilio → Relay Server → Docker VM (Claude Code)
```

Three layers:

| Layer | What | Code |
|-------|------|------|
| **Relay Server** | Express server — receives Twilio webhooks, authenticates by phone number, sends responses as SMS/MMS | `server.js` (64 LOC) |
| **Docker VM** | Always-on container — Claude Code CLI, Chromium, Playwright, HTTP API wrapper | `vm/` (157 LOC) |
| **Twilio** | SMS/MMS transport — webhooks inbound, API outbound | Config only |

## Status

**Alpha** — Phases 1–2 complete. The relay server and Docker VM work independently. Phase 3 (wiring relay → VM) is next.

| Component | Status | What works |
|-----------|--------|------------|
| Relay Server | Working | Receives SMS, authenticates sender, echoes with MMS test image |
| Docker VM | Working | Runs Claude Code headlessly via HTTP API, serves images |
| Relay → VM | Not started | Phase 3 — forwarding SMS commands to the VM |

## Quickstart

### Prerequisites

- Node.js 22+
- Docker
- A Twilio account with an SMS-capable phone number
- An Anthropic API key
- [ngrok](https://ngrok.com) (for local development)

### Option A: AI-Native Setup (Recommended)

```bash
git clone https://github.com/sendtwothreeyears/ts.git textslash
cd textslash
claude  # Opens Claude Code
```

Then run `/setup` and follow the prompts.

### Option B: Manual Setup

```bash
git clone https://github.com/sendtwothreeyears/ts.git textslash
cd textslash

# 1. Configure relay server
cp .env.example .env
# Edit .env with your Twilio credentials and allowed phone numbers

# 2. Configure and start the VM
cp vm/.env.example vm/.env
# Edit vm/.env with your Anthropic API key
docker compose up -d

# 3. Start the relay server
npm install
npm run dev

# 4. Expose the relay to Twilio
ngrok http 3000
# Copy the ngrok URL to PUBLIC_URL in .env and restart the relay

# 5. Configure Twilio
# Set your Twilio phone number's Messaging webhook to: <ngrok-url>/sms
```

### Try It

1. **SMS relay:** Text your Twilio number — you'll get an echo + test image back
2. **Claude Code VM:** `curl -X POST http://localhost:3001/command -H 'Content-Type: application/json' -d '{"text":"hello"}'`

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). TL;DR: bug fixes and simplifications welcome. New features go through the Claude Code skills system.

## License

[MIT](LICENSE)
