---
phase: 4
condensed: true
original: archive/plans/2026-02-26-feat-phase-4-screenshots-plan.md
---

# Phase 4: Screenshots -- VM Capture to WhatsApp Delivery (Condensed)

**Stage:** Local Development
**Depends on:** Phase 3 (Command)
**Done when:** Texting "show me the app" returns a screenshot of the running app on the user's phone via WhatsApp.

## Summary

Built a screenshot pipeline where Claude Code captures screenshots of a running dev server inside the Docker container and delivers them to the user's phone via WhatsApp. The pipeline flows: Claude Code calls `POST /screenshot` on the VM, Playwright captures a JPEG, the relay proxies the image for Twilio to fetch, and the user receives it as WhatsApp media. This is the first phase where images flow from the VM to the phone.

## Key Deliverables

- `POST /screenshot` VM endpoint — Playwright-based capture with mobile/desktop viewports and iterative JPEG compression
- In-memory `pendingImages` array — tracks screenshots during `/command` execution, drained into response
- Relay `GET /images/:filename` proxy — UUID-validated proxy from Twilio to VM images
- `sendMessage()` media support — WhatsApp media via Twilio `mediaUrl` parameter
- Ephemeral image cleanup — 30-min TTL, 5-min interval, 100-file cap
- `vm/CLAUDE.md` — system prompt teaching Claude Code about the `/screenshot` endpoint
- `vm/test-app/index.html` — static HTML test target for e2e testing

## Key Technical Decisions

- **Mobile viewport default (390x844 @ 2x DPR)**: Matches phone viewing context; desktop available as option
- **Iterative JPEG compression**: Start at quality 80, reduce by 10 until under 600KB; fallback to 1x DPR
- **Browser launched per-request (not persistent)**: Headless Chromium cold start ~1-2s, simplifies lifecycle
- **UUID filenames for security**: Unguessable image URLs; no auth tokens on image proxy (deferred to Phase 7)
- **Relay proxies images (no disk write)**: Pipes VM response body directly to Twilio
- **CLAUDE.md system prompt**: Critical for Claude Code to know about `/screenshot` and when to use it

## Status

Completed
