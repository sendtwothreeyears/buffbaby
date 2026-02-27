---
module: "Relay + Public UI"
date: "2026-02-26"
problem_type: developer_experience
component: "Web chat dev tool (GET /, POST /chat)"
symptoms:
  - "Twilio A2P/toll-free verification blocks WhatsApp testing for days to weeks"
  - "Screenshot pipeline code-complete but cannot be validated end-to-end"
  - "No way to test full user flow without working WhatsApp delivery"
  - "Development velocity blocked by external dependency outside team control"
root_cause: "Hard dependency on Twilio for all testing. No local bypass or mock interface existed. The relay server's forwardToVM() function was transport-agnostic but only exposed through the Twilio-authenticated /webhook endpoint."
resolution_type: tooling_addition
severity: medium
tags:
  - developer-experience
  - testing-bypass
  - twilio-verification
  - local-development
  - web-chat
  - transport-abstraction
---

# Troubleshooting: Dev Velocity Blocked by Twilio Verification

## Problem

Twilio WhatsApp Sandbox verification and number approval can take days to weeks. Phase 4 (Screenshots) was code-complete but entirely blocked on WhatsApp delivery — the screenshot pipeline couldn't be tested end-to-end without Twilio working.

## Environment

- Module: Relay (`server.js`) + Public UI (`public/index.html`)
- Affected Component: End-to-end testing flow
- Date: 2026-02-26

## Symptoms

- Phase 4 implementation complete (screenshots work locally in Docker)
- Cannot test the full flow: user message -> VM execution -> response + image -> user sees result
- Stuck waiting for Twilio A2P approval (external dependency, not under team control)
- Development velocity blocked; can't iterate on screenshot behavior or response formatting

## What Didn't Work

**Attempted Solution 1:** Waiting for Twilio approval
- **Why it failed:** Passive approach; no control over timeline. A2P/toll-free verification is rate-limited by carrier compliance teams.

**Attempted Solution 2:** Testing with curl only
- **Why it failed:** Validates the API but doesn't exercise the full user experience. No mobile browser rendering, no image display, no real-time feedback loop.

## Solution

Added a browser-based chat interface that bypasses Twilio entirely by calling the same `forwardToVM()` function through a new JSON API endpoint. Zero changes to existing WhatsApp/Twilio code.

```
WhatsApp (production):  Phone -> Twilio -> POST /webhook -> forwardToVM() -> Twilio WhatsApp -> Phone
Web chat (dev):         Browser -> POST /chat -> forwardToVM() -> JSON response -> Browser
```

### New endpoint (`server.js:63-84`)

```javascript
app.post("/chat", async (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) {
    return res.status(400).json({ error: "Text is required" });
  }

  try {
    const data = await forwardToVM(text);
    res.json(data);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({
      error: status === 408 ? "timeout" : status === 409 ? "busy" : "error",
      text: err.text || null,
      images: err.images || [],
    });
  }
});
```

### Chat UI (`public/index.html`, 310 LOC)

Single-file, mobile-first chat interface. No dependencies, no build step. Features:
- Message thread with user/bot alignment (chat-style bubbles)
- Inline image rendering via `<img>` tags pointing to `/images/:filename`
- Loading spinner with elapsed-time counter
- Error states with type labels (timeout, busy, error)
- Smart scroll behavior (auto-scrolls unless user scrolled up, resets on send)
- Input disabling during request processing

## Why This Works

1. **`forwardToVM()` is transport-agnostic.** It takes text, sends it to the VM, and returns structured data (`text` + `images` + `exitCode` + `durationMs`). By adding a second endpoint that calls the same function, we get feature parity with zero coupling to Twilio.
2. **Pure addition, no changes to production paths.** `git diff` shows only additions — the `/webhook` handler, `processCommand`, `sendMessage`, and VM code are untouched. Both transports work simultaneously.
3. **No authentication needed for dev use.** The web chat is accessed via ngrok URL (which is inherently access-controlled). No phone allowlist, no Twilio webhook validation, no message queuing.
4. **Doubles as a demo tool.** Engineers can share the ngrok URL with stakeholders to show the product without needing a WhatsApp Business number or Twilio approval.

## Prevention

- **Design transport as an abstraction boundary early.** The `forwardToVM()` function signature (`text -> Promise<data>`) made this bypass trivial. Future transports (Telegram, Discord) can reuse the same function.
- **Gate dev tools with env vars before production.** The `GET /` route will conflict with any future landing page. Gate behind `ENABLE_WEB_CHAT` or move to `/chat` path before Phase 7 (Deploy).
- **Keep dev tools self-contained and minimal.** Single HTML file, no npm dependencies, no build step = zero maintenance burden. If it breaks, delete and rebuild in 30 minutes.
- **When blocked by an external dependency, build a dev bypass — don't wait.** The pattern: identify the abstraction boundary, add a parallel path that skips the external system, test through the bypass, then validate through the real system when it becomes available.

## Related Issues

- See also: [sms-echo-server-twilio-ngrok-setup-20260225.md](sms-echo-server-twilio-ngrok-setup-20260225.md) — Twilio webhook setup, ngrok configuration
- See also: [docker-vm-claude-code-headless-setup-20260225.md](docker-vm-claude-code-headless-setup-20260225.md) — VM server architecture that the web chat bypasses Twilio to reach
