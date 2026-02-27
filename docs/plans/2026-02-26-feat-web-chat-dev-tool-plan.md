---
title: "feat: Add Web Chat Dev Testing Tool"
type: feat
status: completed
date: 2026-02-26
phase: "4.1"
depends_on: "Phase 4 (Screenshots)"
---

# feat: Add Web Chat Dev Testing Tool

## Overview

A browser-based chat interface served by the relay server that mimics the WhatsApp conversation — bypassing Twilio entirely. Open the relay URL on a phone browser, type messages, see responses and screenshots inline. This unblocks development when Twilio is unavailable.

```
WhatsApp (production):  Phone → Twilio → Relay → VM → Relay → Twilio → Phone
Web chat (dev):    Phone Browser → Relay → VM → Relay → Phone Browser
```

## Problem Statement / Motivation

Phase 4 (Screenshots) is code-complete but Twilio setup can introduce delays. This phase adds a parallel path for testing that bypasses Twilio completely — no waiting, same underlying flow.

Secondary benefit: serves as a demo tool for showing the product without needing a phone number.

## Proposed Solution

Two new routes on the relay server + one HTML file. No changes to existing WhatsApp/Twilio code or the VM.

### `POST /chat` — JSON API Endpoint

Calls the same `forwardToVM(text)` function used by the WhatsApp handler (`server.js:194`). No Twilio auth, no phone allowlist, no message queuing.

**Request:**
```json
POST /chat
Content-Type: application/json

{ "text": "show me the app" }
```

**Success response** (pass-through from VM):
```json
{
  "text": "Here's a screenshot of your running app.",
  "images": [
    { "type": "screenshot", "filename": "abc123.jpeg", "url": "/images/abc123.jpeg" }
  ],
  "exitCode": 0,
  "durationMs": 12345
}
```

**Error response** (with partial results when available):
```json
{
  "error": "timeout",
  "text": "Partial output captured before timeout...",
  "images": [
    { "type": "screenshot", "filename": "abc123.jpeg", "url": "/images/abc123.jpeg" }
  ]
}
```

**Design decisions:**
- **No queuing.** Unlike WhatsApp (which queues up to 5 messages), the chat UI disables the send button while a request is in-flight. This prevents 409 conflicts entirely — simpler than cloning the WhatsApp queue logic.
- **No text truncation.** WhatsApp has a 4096-char limit. Web chat renders the full response with scrollable overflow regardless of length.
- **Partial results on error.** When a command times out (408) or fails (500), any text/images captured before failure are included. The UI renders them with a visual error indicator.
- **Raw VM response shape.** Images are passed through as objects (`{type, filename, url}`), not flattened to URL strings. The UI uses `img.url` for the `<img src>` attribute.

### `GET /` — Chat HTML Page

Serves a single HTML file with inline CSS/JS via `res.sendFile()`. No build step, no npm dependencies, no `express.static()` middleware.

**File location:** `public/index.html`

### Required Relay Changes

1. **Add `express.json()` middleware** alongside existing `express.urlencoded()` at `server.js:34`. This is safe — it only parses requests with `Content-Type: application/json` and doesn't affect existing Twilio webhook handling.
2. **Add `GET /` route** — `res.sendFile(path.join(__dirname, 'public', 'index.html'))`
3. **Add `POST /chat` route** — validates body, calls `forwardToVM()`, returns JSON response

## Technical Considerations

### Timeout Handling
Commands can take up to 300s on the VM (`forwardToVM` has a 330s abort timeout). The browser's `fetch()` must not have a client-side timeout shorter than this. The UI shows a spinner with elapsed time ("Thinking... 45s") so the developer knows it's not frozen.

### Concurrency
The VM has a single-concurrency lock — returns 409 Conflict if busy. The chat UI prevents this by disabling input during requests. If a 409 somehow reaches the client (e.g., WhatsApp and chat used simultaneously), the UI displays a "VM is busy" message.

### Image Serving
Images are already proxied through the relay at `GET /images/:filename` (`server.js:57-81`). The browser fetches from the same origin — no CORS issues, no URL construction needed. The existing path-traversal protection applies.

### Conversation Persistence
None. Conversation lives in the DOM and is lost on page refresh. This is intentional — it's a dev tool, not a production chat app. The VM's `--continue` flag maintains Claude Code session state across requests regardless.

### Security
The `/chat` endpoint has no authentication. It's a dev tool for local use only. The spec notes it should be gated or removed before production (Phase 7). An `ENABLE_WEB_CHAT` env var could gate it, but for now it's always-on since the relay is only exposed via ngrok during development.

## Acceptance Criteria

- [x] Opening the relay URL (`GET /`) in a phone browser shows the chat interface
- [x] Sending a text message via the chat returns Claude Code's response with full (non-truncated) text
- [x] Sending "show me the app" returns a screenshot displayed inline in the chat
- [x] Multi-image responses render stacked vertically, full-width
- [x] Send button and input are disabled while a request is in-flight
- [x] Loading spinner shows elapsed time during long-running commands
- [x] Error responses (timeout, VM busy, VM down) display meaningful messages
- [x] Partial results (text/images captured before failure) render with an error indicator
- [x] Chat works over ngrok from a phone on any network
- [x] Existing WhatsApp/Twilio endpoints (`POST /sms`, `GET /images/:filename`) are unchanged
- [x] No new npm dependencies added

## Chat UI Specification

Single HTML file (`public/index.html`) with inline CSS and JS.

### Layout
- Full-viewport mobile-first design (works on phone browsers over ngrok)
- Header bar with app name/status
- Scrolling message thread (fills available space)
- Fixed input bar at bottom (above mobile keyboard)

### Message Rendering
- User messages: right-aligned, distinct color
- Bot messages: left-aligned, distinct color
- Images: full-width within message bubble, stacked vertically for multi-image responses
- Error messages: visually distinct (red border or banner) with partial results rendered normally below
- Empty responses: show a subtle "No output" indicator

### Input Behavior
- Text input + send button
- Send on Enter key (not Shift+Enter, which inserts newline)
- Input and button disabled while request is in-flight
- Client-side validation: prevent sending empty/whitespace-only messages
- Auto-focus input on page load and after each response

### Loading State
- Spinner or pulsing indicator in the message thread (where the response will appear)
- Elapsed time counter: "Thinking... 12s"
- Input field disabled with visual indication

### Scrolling
- Auto-scroll to latest message on new messages and images
- Respect user's scroll position if they've scrolled up to read history

## Implementation Tasks

### server.js Changes (~30 lines)

```javascript
// 1. Add JSON body parsing (line ~34)
app.use(express.json());

// 2. Serve chat page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 3. Chat endpoint
app.post("/chat", async (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: "Text is required" });

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

### public/index.html (~200-300 lines)

Single file with inline `<style>` and `<script>`. Key implementation points:

- **Fetch with no client-side timeout:** `fetch('/chat', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({text}) })` — let the server-side 330s timeout be the limit
- **Elapsed time counter:** `setInterval` that updates every second while a request is in-flight
- **Image rendering:** `img.url` from the response → `<img src="${img.url}" loading="lazy">`
- **Auto-scroll logic:** Track if user has scrolled up; only auto-scroll if they're near the bottom
- **Error display:** Check for `error` field in response JSON, render with error styling, still show `text` and `images` if present

### Files Created/Modified

| File | Action | Description |
|------|--------|-------------|
| `server.js` | Modified | Add `express.json()`, `GET /`, `POST /chat` |
| `public/index.html` | Created | Chat UI (inline HTML/CSS/JS) |

## Dependencies & Risks

**Dependencies:**
- Phase 4 (Screenshots) must be code-complete — it is ✅
- Docker VM must be running locally — existing `docker-compose up` workflow

**Risks:**
- **Low:** `express.json()` middleware could theoretically interfere with Twilio webhook parsing — but it won't, since Twilio sends `application/x-www-form-urlencoded` and `express.json()` only activates for `application/json`
- **Low:** Long fetch requests (up to 5 min) could be dropped by aggressive network proxies — unlikely over ngrok in dev

## References & Research

### Internal References
- `forwardToVM()`: `server.js:194-230` — POST to VM, 330s timeout, cold-start retry
- WhatsApp handler: `server.js:89-191` — existing message processing flow (queue, send, error handling)
- Image proxy: `server.js:57-81` — path-validated proxy to VM's `/images/:filename`
- VM command endpoint: `vm/vm-server.js:80-165` — Claude Code CLI wrapper, response format
- Phase 4.1 spec: `docs/plans/phases/04.1-phase-web-chat.md`

### Institutional Learnings Applied
- **Path traversal protection** (`docs/solutions/developer-experience/docker-vm-claude-code-headless-setup-20260225.md`): Existing `/images/:filename` proxy already has this protection — no new file-serving routes need it
- **Logging conventions** (`docs/solutions/developer-experience/whatsapp-echo-server-twilio-ngrok-setup-20260225.md`): Use `[CHAT]` prefix for chat endpoint logs, matching existing `[INBOUND]`/`[OUTBOUND]` pattern
- **Doc sync** (`docs/solutions/documentation-gaps/stale-loc-counts-links-after-refactor-20260226.md`): Update CLAUDE.md key files table after adding new endpoint
