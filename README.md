# textslash

> Control a cloud dev environment from any phone. No additional app. Just WhatsApp.

textslash is a WhatsApp-based interface for agentic development workflows. Send a WhatsApp message, control [Claude Code](https://docs.anthropic.com/en/docs/claude-code) running on a cloud VM entirely via WhatsApp — diffs as monospace text, previews as screenshots, approvals as text replies.

## Why WhatsApp?

- **Universal** — 2B+ users, already installed on most smartphones
- **No additional app** — WhatsApp is already there for most users
- **Rich formatting** — monospace code blocks, clickable links, in-line media
- **Reliable delivery** — in-order, read receipts, no carrier variability
- **Built-in audit trail** — every command and response is in your chat history

## Architecture

```
Phone (WhatsApp) → Twilio → Relay Server → Docker VM (Claude Code)
```

Three layers:

| Layer | What | Code |
|-------|------|------|
| **Relay Server** | Express server — receives Twilio webhooks, authenticates by phone number, sends responses as WhatsApp messages | `server.js` |
| **Docker VM** | Always-on container — Claude Code CLI, Chromium, Playwright, HTTP API wrapper | `vm/` |
| **Twilio** | WhatsApp transport — webhooks inbound, API outbound | Config only |

## Status

**Alpha** — Phases 1–4 complete. The relay server and Docker VM work end-to-end via WhatsApp.

| Component | Status | What works |
|-----------|--------|------------|
| Relay Server | Working | Receives WhatsApp messages, authenticates sender, forwards to VM, sends responses with media |
| Docker VM | Working | Runs Claude Code headlessly via HTTP API, serves images |
| Relay → VM | Working | Forwarding commands to the VM, returning responses with screenshots |

## Quickstart

### Prerequisites

- Node.js 22+
- Docker
- A Twilio account with WhatsApp Sandbox (or Business number)
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

# 5. Configure Twilio WhatsApp Sandbox
# Set the webhook URL to: <ngrok-url>/webhook
# See: https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn
```

### Try It

1. **WhatsApp relay:** Send a WhatsApp message to the sandbox number — you'll get a response back
2. **Claude Code VM:** `curl -X POST http://localhost:3001/command -H 'Content-Type: application/json' -d '{"text":"hello"}'`

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). TL;DR: bug fixes and simplifications welcome. New features go through the Claude Code skills system.

## License

[MIT](LICENSE)
