# Phase 9: Adapter Refactor

**Stage:** Multi-Channel Foundation
**Depends on:** Phase 8 (Provisioning) — all TextSlash phases complete
**Done when:** WhatsApp works exactly as before, but `server.js` is split into a channel-agnostic relay core + a WhatsApp adapter. No user-visible behavior changes.

## What You Build

Refactor the monolithic `server.js` (514 LOC) into an adapter pattern:

1. **Relay core** — channel-agnostic message routing, VM forwarding, state machine (`idle → working → awaiting_approval`), progress callback handling, image proxy. No knowledge of WhatsApp, Discord, or Telegram.
2. **WhatsApp adapter** — wraps existing Twilio integration. Normalizes inbound webhooks into the relay core's message format. Formats outbound messages for WhatsApp (text truncation, 1-media-per-message, etc.).
3. **Adapter interface** — common contract: `onMessage(msg)` for inbound, `sendText()`, `sendMedia()`, `sendActions()` for outbound. Each adapter implements this.

Deliverables:
- Relay core extracted from `server.js` — all channel-specific code removed
- WhatsApp adapter implementing the adapter interface
- All existing functionality preserved: commands, screenshots, diffs, approval flow, progress streaming, image proxy
- Adapter interface documented in code comments (not a separate doc)

## Tasks

- [ ] Extract channel-agnostic relay core from `server.js` and create WhatsApp adapter
  - Brainstorm: `/workflow:brainstorm adapter pattern for multi-channel relay — interface design, message normalization`
  - Plan: `/workflow:plan refactor server.js into relay core + WhatsApp adapter`
  - Ship: `/workflow:ship docs/plans/YYYY-MM-DD-feat-adapter-refactor-plan.md`

## Notes

- This is a **pure refactor** — zero new features. The risk is breaking existing WhatsApp functionality.
- Test by sending the same commands via WhatsApp before and after. All flows must work: basic command, screenshots, diffs, approval, progress streaming.
- The WhatsApp adapter handles Twilio-specific quirks: webhook signature validation, `whatsapp:` prefix stripping, 1600-char sandbox limit, 1-media-per-message, 24-hour session window.
- The relay core should use a channel-agnostic user ID (not raw phone number). The WhatsApp adapter maps `whatsapp:+1234567890` to an internal ID.
- Image proxy (`GET /images/:filename`) stays in the relay core — all channels need it.
- The web chat UI (`GET /`, `POST /chat`) can be treated as a fourth adapter or kept separate.
- Don't over-abstract. The adapter interface should be the minimum needed for Discord and Telegram to plug in. Start simple, extend as needed.
