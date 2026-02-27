---
module: WhatsApp Relay Server
date: 2026-02-25
problem_type: developer_experience
component: twilio-whatsapp-relay
symptoms:
  - "Local development requires exposing localhost to Twilio webhooks"
  - "WhatsApp media delivery requires publicly accessible file serving"
  - "Phone number allowlist must use exact E.164 format for matching"
root_cause: "Twilio webhooks require a public HTTPS endpoint; local development on localhost is not routable from the internet without ngrok tunneling and careful env var coordination"
resolution_type: environment_setup
severity: high
tags: [twilio, ngrok, whatsapp, express, webhooks, local-development, phase-1]
---

# Troubleshooting: Twilio WhatsApp Echo Server with ngrok for Local Development

## Problem

Setting up a local Twilio WhatsApp development pipeline requires coordinating ngrok tunneling, Express webhook parsing, phone number allowlisting, and media serving — with several non-obvious pitfalls that cause silent failures.

## Environment

- **Module:** WhatsApp Relay Server
- **Component:** Express server + Twilio SDK + ngrok
- **Date:** 2026-02-25
- **Phase:** 1 (Echo)

## Symptoms

- Text messages sent to the Twilio number produce no response
- Media images not arriving despite text being delivered
- Webhook handler runs but `req.body` is empty or undefined
- Allowlisted phone number still gets blocked (silent drop)
- ngrok URL changes break all inbound message delivery

## What Didn't Work

**Direct solution:** The echo server was implemented and validated end-to-end on the first attempt. The learnings below come from design decisions and known pitfalls documented during planning.

## Solution

### Architecture

```
Phone → Twilio → ngrok → localhost:3000/webhook → Echo response → Twilio → Phone (WhatsApp)
```

### Setup Steps

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and fill in Twilio credentials
3. Start ngrok: `ngrok http 3000`
4. Copy ngrok HTTPS URL to `.env` as `NGROK_URL`
5. Set Twilio WhatsApp Sandbox webhook → `POST {NGROK_URL}/webhook`
6. Start server: `npm start`
7. Text the Twilio number from your allowlisted phone

### Key Implementation Details

**Webhook parsing:** Twilio sends `application/x-www-form-urlencoded`, not JSON. Must use `express.urlencoded({ extended: false })`.

**Media serving:** Images must be publicly accessible URLs. Serve via Express static route through ngrok:
```javascript
app.get("/test-image.png", (req, res) => {
  res.sendFile(path.join(__dirname, "assets", "test-image.png"));
});

// Reference in Twilio API call:
mediaUrl: [`${NGROK_URL}/test-image.png`]
```

**Phone allowlist:** Parse comma-separated E.164 numbers from `.env` into a Set for O(1) lookup:
```javascript
const allowlist = new Set(ALLOWED_PHONE_NUMBERS.split(",").map((n) => n.trim()));
```

**Silent drops:** Return `200 OK` with no body for blocked numbers — prevents information leakage.

**Env var validation:** Fail fast on startup if required vars are missing:
```javascript
const required = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER", "NGROK_URL", "ALLOWED_PHONE_NUMBERS"];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}
```

## Why This Works

1. **express.urlencoded()** correctly parses Twilio's form-encoded webhook payload into `req.body.From` and `req.body.Body`
2. **ngrok** bridges the gap between localhost and Twilio's requirement for a public HTTPS endpoint
3. **E.164 normalization** ensures allowlist comparison matches Twilio's canonical phone number format
4. **Static file serving through ngrok** makes media images reachable from Twilio's servers for WhatsApp delivery

## Prevention

### ngrok URL Instability
- Free tier generates new URL on every restart
- **Must update both** `.env` AND Twilio console webhook each time
- Post-restart checklist: (1) note new URL, (2) update `.env`, (3) update Twilio webhook, (4) send test WhatsApp message
- Becomes irrelevant in Phase 7 (production deploy with permanent domain)

### WhatsApp Media Delivery Issues
- WhatsApp supports up to 16MB, but large images slow delivery on mobile connections
- Keep images small for fast delivery (test image is 603 bytes)
- Verify image URL is accessible before sending: `curl {NGROK_URL}/test-image.png`
- Log image size with every outbound media message

### Phone Number Format Mismatch
- Twilio sends `From` in E.164 format (`+1XXXXXXXXXX`)
- Allowlist values must match exactly — `1234567890` won't match `+11234567890`
- Always store and compare in E.164

### Webhook Parsing Gotcha
- Using `express.json()` instead of `express.urlencoded()` silently fails to parse the body
- `req.body.From` and `req.body.Body` will be `undefined` with no error

### Security (Intentional Tech Debt)
- No webhook signature validation in Phase 1 — deferred to Phase 3
- Anyone who discovers the ngrok URL can forge requests
- Acceptable for local-only testing; must be resolved before production

### Logging Conventions Established
```
[INBOUND]  — Incoming webhook received and parsed
[OUTBOUND] — WhatsApp message sent via Twilio API
[BLOCKED]  — Webhook rejected (not in allowlist)
[ERROR]    — API failure or unexpected error
```

## Related Issues

No related issues documented yet.
