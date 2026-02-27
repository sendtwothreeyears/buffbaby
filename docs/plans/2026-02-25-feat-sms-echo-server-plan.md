---
title: "feat: WhatsApp Echo Server with Media Test Image"
type: feat
status: completed
date: 2026-02-25
phase: 1
---

# feat: WhatsApp Echo Server with Media Test Image

## Overview

Build the simplest possible proof of life: a minimal Node.js relay server (~50 LOC) that receives an incoming WhatsApp message via Twilio webhook, echoes the message body back, and sends a static test image via WhatsApp media. This validates the entire Twilio -> ngrok -> localhost -> Twilio round trip.

This is throwaway code — Phase 3 replaces it with the real relay. Keep it simple.

## Problem Statement / Motivation

The WhatsApp Agentic Development Cockpit requires a working WhatsApp pipeline before anything else can be built. Phase 1 proves that:

1. Twilio can deliver WhatsApp messages to our server
2. Our server can send WhatsApp messages back
3. WhatsApp media delivery works end-to-end

Every subsequent phase depends on this pipeline working.

## Proposed Solution

A single-file Express server with one webhook endpoint (`POST /sms`) and one static route (`GET /test-image.png`). No framework beyond Express. No database. No auth beyond a phone number allowlist. Uses Twilio's WhatsApp Sandbox (dev) or Business API (prod).

### Architecture

```
Phone (WhatsApp) -> Twilio -> ngrok -> localhost:3000/sms -> Echo message + media -> Twilio -> Phone (WhatsApp)
```

### Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | Express only | Phase plan specifies it; smallest dependency footprint |
| File structure | Single file (`server.js`) | ~50 LOC, throwaway code |
| Auth | Phone allowlist from `.env` | Simplest possible; signature validation deferred to Phase 3 |
| Test image | Small PNG committed to repo, served via Express | No external dependency; works through ngrok |
| Non-allowlisted senders | Silent drop + console.log | No information leakage; easy to debug |
| Logging | console.log all messages in/out | Trivial to add; essential for validating the pipeline |
| ALLOWED_PHONE_NUMBERS format | Comma-separated E.164 string | Simplest for `.env` parsing |

## Technical Considerations

- **ngrok free tier** generates a new URL on every restart. The Twilio webhook URL must be updated manually in the Twilio console each time. Document this clearly.
- **WhatsApp media limit is 16MB**, but test image should still be small (< 100KB ideal) for fast delivery.
- **No webhook signature validation** in Phase 1 — anyone who discovers the ngrok URL can forge requests. Acceptable for local-only testing.

## Acceptance Criteria

- [x] `npm install && npm start` launches the server on port 3000
- [ ] Texting the Twilio number from an allowlisted phone echoes the exact message back
- [ ] A test image is received via WhatsApp media alongside the echo
- [ ] Texting from a non-allowlisted number produces no response (silent drop)
- [x] Server logs all inbound messages (From, Body) and outbound responses to console

## Implementation

### Project Setup

Initialize the Node.js project and install dependencies.

**Files to create:**

#### `package.json`

```json
{
  "name": "textslash-relay",
  "version": "0.1.0",
  "private": true,
  "description": "WhatsApp relay server for the WhatsApp Agentic Development Cockpit",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "express": "^4.21.0",
    "twilio": "^5.0.0"
  }
}
```

#### `.env.example`

```bash
# Twilio credentials (from https://console.twilio.com)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1XXXXXXXXXX

# ngrok public URL (update after each ngrok restart)
NGROK_URL=https://xxxx-xx-xx-xxx-xx.ngrok-free.app

# Comma-separated E.164 phone numbers allowed to use the relay
ALLOWED_PHONE_NUMBERS=+1XXXXXXXXXX

# Server port
PORT=3000
```

#### `server.js`

Single-file Express server. Responsibilities:

1. **`POST /sms`** — Twilio webhook handler
   - Parse `req.body.From` and `req.body.Body` (Twilio sends URL-encoded form data)
   - Check `From` against `ALLOWED_PHONE_NUMBERS` — if not listed, log warning and return 200 (silent drop)
   - If allowed: send echo message + test image via Twilio REST API (WhatsApp)
   - Log inbound and outbound to console

2. **`GET /test-image.png`** — Static route serving the test image
   - Serves `assets/test-image.png` from disk
   - Publicly accessible through ngrok for Twilio WhatsApp media delivery

3. **Startup** — Validate required env vars are set, log the webhook URL

```javascript
// server.js — Pseudocode structure (~50 LOC target)

// Load .env, require express + twilio
// Parse ALLOWED_PHONE_NUMBERS into a Set

// POST /sms handler:
//   Log: "[INBOUND] From: ${from}, Body: ${body}"
//   If from not in allowlist → log warning, return 200
//   Create Twilio client, send message:
//     to: from
//     from: TWILIO_PHONE_NUMBER
//     body: body (echo)
//     mediaUrl: [`${NGROK_URL}/test-image.png`]
//   Log: "[OUTBOUND] Echo sent to ${from}"

// GET /test-image.png handler:
//   Serve static file from assets/

// Listen on PORT, log startup info
```

#### `assets/test-image.png`

A small test PNG (< 100KB). Can be a simple colored rectangle with "textslash echo test" text, or any recognizable image. The only requirement is that it's visually distinct so you can confirm WhatsApp media delivery.

### Verification Steps

After setup:

1. Start ngrok: `ngrok http 3000`
2. Copy the ngrok URL to `.env` as `NGROK_URL`
3. Configure Twilio webhook: set the phone number's "A message comes in" webhook to `{NGROK_URL}/sms` (HTTP POST)
4. Start the server: `npm start`
5. Text the Twilio number from your phone
6. Confirm: echo message received + test image received via WhatsApp
7. Text from a different (non-allowlisted) number — confirm no response

## Dependencies & Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| WhatsApp Sandbox not configured | Medium | Join Twilio WhatsApp Sandbox immediately; upgrade to Business API for production |
| ngrok URL changes break webhook | High (expected) | Document the manual update process clearly |
| WhatsApp media fails silently | Low | Keep image small (< 100KB), PNG format, verify via ngrok URL in browser first |
| Twilio rate limits | Very low | Single user, low volume testing |

## References

- Phase plan: `docs/plans/phases/01-phase-echo.md`
- PRD: `PRD_WHATSAPP_AGENTIC_COCKPIT.md`
- Twilio WhatsApp webhook docs: https://www.twilio.com/docs/messaging/guides/webhook-request
- Twilio Node.js SDK: https://www.twilio.com/docs/libraries/reference/twilio-node
