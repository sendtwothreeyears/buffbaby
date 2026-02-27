---
phase: 3
condensed: true
original: archive/plans/2026-02-26-feat-connect-relay-to-vm-plan.md
---

# Phase 3: Connect WhatsApp Relay to Cloud VM with Message Queue (Condensed)

**Stage:** Local Development
**Depends on:** Phase 1 (Echo Server), Phase 2 (Docker VM)
**Done when:** Texting "what is 2+2" to the Twilio WhatsApp number returns Claude Code's answer as a WhatsApp message.

## Summary

Connected the relay server to the Cloud VM, replacing Phase 1 echo logic with real Claude Code interaction. The relay receives WhatsApp messages via Twilio webhook, forwards them to the VM's HTTP API, and returns Claude's response as a WhatsApp message. Added three features inspired by NanoClaw: session resume (`--continue` flag), relay-side per-user message queue (up to 5 messages), and container idle shutdown (default 30 min).

## Key Deliverables

- `server.js` rewrite — async forwarding pipeline with Twilio webhook signature validation, per-user message queue, VM error mapping, response truncation (1500 chars), cold-start retry
- `vm-server.js` additions — `--continue` flag for session resume, idle shutdown timer
- `.env.example` updates — `CLAUDE_HOST`, `PUBLIC_URL`
- `vm/.env.example` updates — `IDLE_TIMEOUT_MS`

## Key Technical Decisions

- **Twilio webhook signature validation**: `twilio.webhook()` middleware with `url: PUBLIC_URL + '/webhook'` to handle ngrok proxy
- **Per-user message queue (Map)**: Up to 5 queued messages per user; ack message on queue, error on full
- **Immediate 200 OK to Twilio**: Async processing pattern prevents Twilio timeouts
- **AbortController fetch timeout (330s)**: 30s buffer over VM's 300s COMMAND_TIMEOUT_MS
- **Cold-start retry**: Wait 4s and retry once on ECONNREFUSED
- **`--continue` flag**: Session resume for Claude Code; single-user assumption acceptable for MVP
- **Idle shutdown**: `setInterval` checks last activity; `process.exit(0)` after IDLE_TIMEOUT_MS; Docker auto-restarts

## Status

Completed
