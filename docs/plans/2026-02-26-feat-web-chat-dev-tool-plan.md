---
phase: "4.1"
condensed: true
original: archive/plans/2026-02-26-feat-web-chat-dev-tool-plan.md
---

# Phase 4.1: Web Chat Dev Testing Tool (Condensed)

**Stage:** Local Development
**Depends on:** Phase 4 (Screenshots)
**Done when:** Opening the relay URL in a phone browser shows a chat interface that sends messages to Claude Code and displays responses with inline screenshots.

## Summary

Built a browser-based chat interface served by the relay server that mimics the WhatsApp conversation, bypassing Twilio entirely. Two new routes (`POST /chat` JSON API and `GET /` serving the HTML page) plus one HTML file (`public/index.html`) with inline CSS/JS. Calls the same `forwardToVM()` function as WhatsApp, with no queuing (UI disables send while in-flight), no text truncation, and partial results on error.

## Key Deliverables

- `POST /chat` endpoint — JSON API calling `forwardToVM()`, no Twilio auth or queuing
- `GET /` route — serves `public/index.html` via `res.sendFile()`
- `public/index.html` — single-file chat UI with inline CSS/JS, mobile-first design
- `express.json()` middleware added to relay (safe alongside existing `express.urlencoded()`)

## Key Technical Decisions

- **No queuing on chat endpoint**: UI disables send button while in-flight, preventing 409 conflicts
- **No text truncation**: Web chat renders full response (no WhatsApp 4096-char limit)
- **Partial results on error**: Timeout/failure responses include any text/images captured before failure
- **No client-side fetch timeout**: Server-side 330s timeout is the limit; UI shows elapsed time spinner
- **No conversation persistence**: DOM-only, lost on refresh; VM `--continue` maintains session state
- **No auth on `/chat`**: Dev tool for local use only; gate or remove before production

## Status

Completed
