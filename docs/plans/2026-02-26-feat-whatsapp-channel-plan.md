---
title: "feat: Add WhatsApp messaging channel via Twilio Sandbox"
type: feat
status: active
date: 2026-02-26
phase: "4.2"
depends_on: "Phase 4.1 (Web Chat Dev Tool)"
---

# feat: Add WhatsApp Messaging Channel via Twilio Sandbox

## Overview

Add WhatsApp as the primary messaging channel using Twilio's WhatsApp Sandbox API. Twilio's WhatsApp webhooks use the same webhook format — the `From` field includes a `whatsapp:` prefix on phone numbers. This is a ~20-line change to `server.js`.

```
WhatsApp: Phone → Twilio WA  → POST /sms → forwardToVM() → sendMessage() → Twilio WA  → Phone
Web chat: Browser → POST /chat → forwardToVM() → JSON → Browser
```

Both channels call the same `forwardToVM()`. The VM is transport-agnostic.

## Problem Statement / Motivation

WhatsApp via Twilio Sandbox is available immediately — no additional verification needed. WhatsApp provides richer capabilities (monospace text, 16MB media, reliable delivery order) that benefit engineering workflows.

## Proposed Solution

Detect WhatsApp messages from the `From` field in the existing `/sms` webhook handler. Route outbound messages with the correct `to`/`from` addressing. No new endpoints, no new files, no VM changes.

### Key Design Decision: Key `userState` by Raw `From`

The brainstorm proposed stripping the `whatsapp:` prefix and adding a `channel` field to `userState`. SpecFlow analysis found a **queue bug** with that approach: the message queue stores bare text strings, so when messages from different channels are queued under the same key, responses route to the wrong channel.

**Solution:** Key `userState` by the raw `From` value (including `whatsapp:` prefix). This means `whatsapp:+15551234567` gets its own state entry with independent queue and busy flag. This:

- Eliminates queue routing bugs entirely
- Requires no changes to `getState()`, `processCommand()`, or queue logic
- Reduces the change to just two functions: the `/sms` handler (allowlist check) and `sendMessage()`

### Changes to `server.js`

**1. Env var: add `TWILIO_WHATSAPP_NUMBER` (optional)**

```javascript
const { ..., TWILIO_WHATSAPP_NUMBER } = process.env;
```

Not in the `required` array — WhatsApp is additive. Store bare number (`+14155238886`), code prepends `whatsapp:`.

**2. `/sms` handler: strip prefix for allowlist, early-exit if WhatsApp not configured**

```javascript
const from = req.body.From;
const phone = from.replace(/^whatsapp:/, "");

// Reject WhatsApp if not configured
if (from.startsWith("whatsapp:") && !TWILIO_WHATSAPP_NUMBER) {
  console.log(`[BLOCKED] WhatsApp not configured: ${phone}`);
  return res.sendStatus(200);
}

// Allowlist check uses stripped phone
if (!allowlist.has(phone)) {
  console.log(`[BLOCKED] ${phone}`);
  return res.sendStatus(200);
}
```

Everything after the allowlist check uses `from` (raw) unchanged — `getState(from)`, `sendMessage(from, ...)`, `processCommand(from, ...)` all work as-is.

**3. `sendMessage()`: detect channel from `to` parameter, use correct `from` number**

```javascript
async function sendMessage(to, body, mediaUrls = []) {
  const fromAddr = `whatsapp:${TWILIO_WHATSAPP_NUMBER}`;

  const params = { to, from: fromAddr, body };
  if (mediaUrls.length > 0) {
    params.mediaUrl = mediaUrls;
  }
  await client.messages.create(params);
  // ... logging
}
```

**4. Startup logging**

```javascript
console.log(`[STARTUP] WhatsApp: ${TWILIO_WHATSAPP_NUMBER ? `enabled (${TWILIO_WHATSAPP_NUMBER})` : "disabled"}`);
```

### No Changes Required

| Component | Why Unchanged |
|-----------|---------------|
| `forwardToVM()` | Transport-agnostic — takes text, returns JSON |
| `processCommand()` | Passes raw `from` through to `sendMessage()` — already works |
| `getState()` / queue logic | Keyed by raw `from` — separate entries per channel |
| Image proxy (`GET /images/:filename`) | Same URL pattern for both channels |
| Webhook signature validation | Twilio signs WhatsApp webhooks the same way |
| `vm/vm-server.js` | No transport awareness |
| `public/index.html` | Web chat is independent |
| `docker-compose.yml` | No transport awareness |

## Technical Considerations

### Webhook Signature Validation

The existing `twilio.webhook()` middleware validates WhatsApp webhooks using the same HMAC-SHA1 mechanism and auth token. The `whatsapp:` prefix in the `From` parameter is just another body value included in the signature. **No changes needed.** Verified by reading the Twilio SDK source.

### WhatsApp Sandbox Limitations

- Users must send a join code (e.g., "join word-word") to the sandbox number to opt in. Twilio handles the join code internally — it does not trigger a webhook, so the relay never sees it.
- 24-hour session window: can only reply within 24 hours of last user-initiated message (low risk for request-response pattern)
- Sandbox webhook URL configured separately in Twilio Console

### Raw From Keying

With raw `From` keying, each user's WhatsApp identity (`whatsapp:+15551234567`) gets its own independent session with its own queue and busy flag.

### Text Truncation

WhatsApp supports 4096 chars — current truncation may be relaxed in a future text-first output phase.

## Acceptance Criteria

- [ ] WhatsApp message to Twilio sandbox → response received in WhatsApp
- [ ] "show me the app" via WhatsApp → screenshot delivered inline in WhatsApp
- [ ] Web chat still works identically (regression check)
- [ ] WhatsApp message from phone not on allowlist → silently dropped
- [ ] WhatsApp message with `TWILIO_WHATSAPP_NUMBER` unset → silently dropped with log warning
- [ ] Startup log shows WhatsApp enabled/disabled status
- [ ] Existing web chat (`POST /chat`) unchanged
- [ ] No new npm dependencies
- [ ] `.env.example` updated with `TWILIO_WHATSAPP_NUMBER` and setup instructions
- [ ] `ARCHITECTURE.md` updated with WhatsApp flow
- [ ] `SECURITY.md` updated with WhatsApp-specific notes

## Implementation Tasks

### server.js (~20 lines changed)

- [x] Add `TWILIO_WHATSAPP_NUMBER` to env var destructuring
- [x] Add WhatsApp-not-configured early-exit in `/sms` handler
- [x] Strip `whatsapp:` prefix for allowlist check (use stripped `phone` for allowlist, raw `from` for everything else)
- [x] Update `sendMessage()` to detect WhatsApp from `to` prefix and use correct `from` number
- [x] Add WhatsApp status to startup logging

### Configuration

- [x] Add `TWILIO_WHATSAPP_NUMBER` to `.env.example` with sandbox setup instructions

### Documentation

- [x] Update `ARCHITECTURE.md`: add WhatsApp as a channel in Layer 1 and Layer 3 descriptions, add WhatsApp data flow section
- [x] Update `SECURITY.md`: note allowlist covers both channels, add WhatsApp sandbox limitation (24h session window, join code requirement)
- [x] Update `CLAUDE.md`: update "About This Project" to reflect WhatsApp-only, update architecture diagram and Key Integrations table

## Dependencies & Risks

**Dependencies:**
- Twilio WhatsApp Sandbox must be activated in Twilio Console
- Sandbox webhook URL must be pointed to relay's `/sms` endpoint
- User must send join code to sandbox number to opt in

**Risks:**
- **Low:** WhatsApp sandbox media support — Twilio docs confirm media in outbound WhatsApp messages but verify with smoke test
- **Low:** WhatsApp 24-hour session window — all our interactions are request-response within seconds/minutes

## References & Research

### Internal References
- `server.js:121-168` — `/sms` webhook handler (allowlist, queue logic)
- `server.js:265-279` — `sendMessage()` (outbound Twilio API call)
- `server.js:44-51` — `getState()` and `userState` Map
- `server.js:115-118` — Twilio webhook signature validation
- `server.js:226-262` — `forwardToVM()` (transport-agnostic, no changes)

### Institutional Learnings Applied
- **Transport abstraction** (`docs/solutions/developer-experience/web-chat-dev-tool-twilio-bypass-20260226.md`): `forwardToVM()` is transport-agnostic by design. Channel routing belongs at the transport boundary.
- **Doc sync** (`docs/solutions/documentation-gaps/stale-loc-counts-links-after-refactor-20260226.md`): Documentation updates are part of the code change, not optional follow-up.
- **Logging conventions** (`docs/solutions/developer-experience/whatsapp-echo-server-twilio-ngrok-setup-20260225.md`): Use consistent `[PREFIX]` log format. The raw `from` value in logs already reveals channel.

### Brainstorm
- `docs/brainstorms/2026-02-26-phase-4.2-whatsapp-pivot-brainstorm.md` — full analysis, competitive landscape, key decisions
