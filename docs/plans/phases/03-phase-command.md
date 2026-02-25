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
- Concurrency guard: if the user sends a message while a command is processing, reply "I'm still working on your last request."
- `.env` updated with `CLAUDE_HOST=http://localhost:3000`
- `.env.example` with all required variables: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `ALLOWED_PHONE_NUMBER`, `CLAUDE_HOST`, `ANTHROPIC_API_KEY`

## Tasks

- [ ] Relay forwards incoming SMS text to Claude Code HTTP API in Docker container and sends the response back via Twilio SMS
  - Plan: `/workflow:plan relay server forwards SMS to Claude Code in Docker container, returns response as SMS with async webhook pattern`
  - Ship: `/workflow:ship docs/plans/YYYY-MM-DD-feat-sms-relay-plan.md`

## Notes

- **The async pattern is not optional.** Twilio gives 15 seconds for a webhook response. Claude Code takes longer for anything non-trivial. If you respond synchronously, Twilio will timeout and retry, causing duplicate messages. Respond immediately with `200 OK`, process async, send result via Twilio Messages API.
- The relay replaces the echo logic from Phase 1 — same server, upgraded behavior.
- The concurrency guard is simple: a per-phone-number flag. If `busy`, reply with "Still working..." and don't forward. If `idle`, forward and set `busy`. When Claude Code responds, set `idle` and send the reply.
- Claude Code may return long responses. SMS segments are 160 chars — Twilio handles concatenation, but consider truncating very long responses with a note. Full "Reply 'more'" support is deferred to Phase 16 (UX Polish).
