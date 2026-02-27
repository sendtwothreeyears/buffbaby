# Phase 1: Echo

**Stage:** Local Development
**Depends on:** Nothing (first phase)
**Done when:** You text the Twilio number from your phone, you get your exact message echoed back. You receive a test image via WhatsApp.

## What You Build

The simplest possible proof of life: a Twilio WhatsApp Sandbox, an ngrok tunnel, and a minimal Node.js relay server that receives an incoming WhatsApp message and echoes the message body back. Also sends a static test image via WhatsApp to prove the image delivery pipeline works end-to-end.

Deliverables:
- Twilio account with WhatsApp Sandbox (dev) or Business API (prod)
- ngrok installed and configured
- Minimal Node.js relay server (~50 LOC) that echoes WhatsApp messages and sends a test WhatsApp media image
- `.env` file with Twilio credentials, ngrok URL, and allowed phone number (E.164 format, e.g., `+1XXXXXXXXXX`)
- Phone number allowlist: reject messages from non-allowlisted numbers (compare `req.body.From` against `.env`)

## Prerequisites (manual — complete before `/ship`)

These are manual setup steps done in the Twilio console and terminal, not shippable code:

1. Create Twilio account
2. Buy a phone number
3. Join the Twilio WhatsApp Sandbox (dev) or apply for WhatsApp Business API (prod)
4. Install ngrok (`brew install ngrok` or download)

## Tasks

- [ ] Build a Node.js relay server that echoes incoming WhatsApp messages back and sends a static test image via WhatsApp
  - Plan: `/workflow:plan Twilio WhatsApp echo server with ngrok — receive WhatsApp message, echo back, send test WhatsApp media image`
  - Ship: `/workflow:ship docs/plans/YYYY-MM-DD-feat-sms-echo-plan.md`

## Notes

- ngrok free tier generates a new URL on every restart. You must update the Twilio webhook URL each time. Consider a paid ngrok plan ($8/month) for a stable subdomain, or automate the URL update.
- Twilio webhook signature validation is deferred to Phase 3. The echo server should still restrict to the allowlisted phone number in `.env`.
- The test WhatsApp media image can be any publicly accessible PNG URL passed as `MediaUrl` in the Twilio API response, or served by the echo server itself on a public-facing route via ngrok.
- The echo server is throwaway code — Phase 3 replaces it with the real relay. But it validates the entire Twilio → ngrok → localhost → Twilio round trip.
- Keep the relay server in a single file for now. No framework — just `express` with Twilio's webhook parsing.

## Review

**Status:** PASS
**Reviewed:** 2026-02-25

### Validation Results

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Echo WhatsApp message back to sender | PASS | User confirmed: texting the Twilio number returns the exact message |
| Test image received via WhatsApp | PASS | User confirmed: WhatsApp media image delivered alongside echo |
| Non-allowlisted numbers silently dropped | PASS | User confirmed: no response from non-allowlisted number |
| `npm install && npm start` launches on port 3000 | PASS | Verified — server starts and binds to port 3000 |
| Server logs inbound/outbound messages | PASS | Code logs `[INBOUND]`, `[OUTBOUND]`, and `[BLOCKED]` events |
| Phone number allowlist in `.env` | PASS | `ALLOWED_PHONE_NUMBERS` parsed as comma-separated E.164 Set |
| `.env.example` documents all config | PASS | All 6 env vars documented with placeholder format |
| Test image < 100KB | PASS | `assets/test-image.png` is 603 bytes |

### Code Quality

- **64 LOC** (vs ~50 target) — justified by env var validation block
- Single-file Express server, no unnecessary abstractions
- Clean error handling with try/catch on Twilio API call
- No YAGNI violations (confirmed by ship review simplicity pass)
- Code matches the plan document exactly

### Issues Found

None. No P1 or P2 issues identified during ship review or phase review.

### Tech Debt

- **No webhook signature validation** — deferred to Phase 3 (by design). Anyone who discovers the ngrok URL can forge requests.
- **ngrok URL requires manual update** on restart — acceptable for local dev, becomes irrelevant in Phase 7 (Deploy).

### Next Steps

Phase complete. Next: **Phase 2 — Docker** (`02-phase-docker.md`). Start with `/workflow:brainstorm` or `/workflow:plan` for containerizing the relay server.
