# Phase 3: Command

**Stage:** Local Development
**Depends on:** Phase 1 (Echo), Phase 2 (Docker)
**Done when:** You text "what is 2+2" to the Twilio number, Claude Code answers, you get the answer back as SMS.

## What You Build

Connect the relay server (Phase 1) to the Docker container (Phase 2). The relay receives an incoming SMS via Twilio webhook, forwards the message body to Claude Code's HTTP API inside the Docker container, and sends Claude Code's text response back as SMS via Twilio.

This is the core transport — SMS in, Claude Code processes, SMS out. The relay is a dumb pipe.

Deliverables:
- Relay server upgraded from echo to forwarding: receives SMS → POSTs to Docker container's `/command` endpoint → sends response as SMS
- **Async webhook pattern:** Relay responds to Twilio's inbound webhook immediately with `200 OK` (empty TwiML `<Response></Response>`). Claude Code command runs asynchronously. Response sent as a new outbound SMS via Twilio REST API. This is required because Claude Code takes longer than Twilio's 15-second webhook timeout.
- **Twilio webhook signature validation:** Verify that incoming requests are actually from Twilio using `twilio.validateRequest()`. Reject forged requests.
- Phone number authentication: only the allowed phone number from `.env` can send commands
- Error handling: connection refused, 500, timeout from Docker container → user receives a sensible error SMS ("Something went wrong. Try again in a moment.")
- Concurrency guard with per-user message queue (5-message cap): if the user sends a message while a command is processing, it queues and auto-processes after the current command
- `.env` updated with `CLAUDE_HOST=http://localhost:3001`
- `.env.example` with all required variables: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `ALLOWED_PHONE_NUMBERS`, `CLAUDE_HOST`
- Session resume: `--continue` flag on Claude Code for conversation continuity
- Idle shutdown: VM exits after 30 min idle, Docker `restart: unless-stopped` handles restart
- Response truncation at 1500 chars for SMS-friendly output

## Tasks

- [x] Relay forwards incoming SMS text to Claude Code HTTP API in Docker container and sends the response back via Twilio SMS
  - Plan: `docs/plans/2026-02-26-feat-connect-relay-to-vm-plan.md`
  - Ship: `/workflow:ship docs/plans/2026-02-26-feat-connect-relay-to-vm-plan.md`

## Notes

- **The async pattern is not optional.** Twilio gives 15 seconds for a webhook response. Claude Code takes longer for anything non-trivial. If you respond synchronously, Twilio will timeout and retry, causing duplicate messages. Respond immediately with `200 OK`, process async, send result via Twilio Messages API.
- The relay replaces the echo logic from Phase 1 — same server, upgraded behavior.
- The concurrency guard is a per-phone-number queue. If `busy`, queue the message (up to 5) and reply "Got it, I'll process this next." When Claude Code responds, dequeue and process next, or set idle. Queue full (6+) replies "Queue full, please wait."
- Claude Code may return long responses. SMS segments are 160 chars — Twilio handles concatenation, but consider truncating very long responses with a note. Full "Reply 'more'" support is deferred to Phase 16 (UX Polish).
