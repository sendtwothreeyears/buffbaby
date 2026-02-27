---
date: 2026-02-26
topic: phase-4-screenshots
phase: 4
condensed: true
original: archive/brainstorms/2026-02-26-phase-4-screenshots-brainstorm.md
---

# Phase 4: Screenshots (Condensed)

## Summary

Designed a screenshot pipeline where Claude Code captures screenshots of a running dev server inside Docker and delivers them to the user's phone via WhatsApp. This was the first phase where images flow from the VM to the phone. Chose Playwright CLI over MCP, a dedicated VM endpoint over Claude Code shelling out, and relay-proxied images over a second ngrok tunnel.

## Key Decisions

- **Playwright CLI, not MCP**: Phase 2 already removed `.mcp.json` due to documented MCP shortcomings; CLI is simpler and more observable
- **Dedicated `POST /screenshot` VM endpoint**: VM server owns Playwright; Claude Code calls it via `curl`; testable independently
- **Claude Code decides when to screenshot**: AI interprets user intent (no brittle keyword matching on the relay)
- **Relay proxies images for Twilio**: One public surface (ngrok -> relay); no second tunnel; works identically in production
- **Ephemeral `/tmp/images/` storage**: Images are working artifacts, not long-term storage; TTL or cap-based cleanup
- **In-memory array tracks images per command**: Lightweight; drains into response `images` field; resets per command
- **No ImageStore abstraction (YAGNI)**: Add when R2/S3 is actually needed (Phase 7+)
- **Simple static HTML test target**: Minimal footprint; proves pipeline without framework complexity

## Outcomes

- End-to-end flow: user texts "show me the app" -> relay -> VM /command -> Claude Code curls /screenshot -> Playwright captures -> image saved -> relay proxies -> Twilio sends media -> user receives screenshot
- JPEG compression to <1MB; mobile (390px) and desktop (1440px) viewports at 2x DPR
- Phase spec updates needed: remove MCP references, note YAGNI on ImageStore, simplify test target

## Status

Completed — Implemented in Phase 4
