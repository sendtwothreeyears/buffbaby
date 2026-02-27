# Phase 4: Screenshots — Brainstorm

**Date:** 2026-02-26
**Phase:** 4 (Screenshots)
**Depends on:** Phase 3 (Command) — PASS
**Done when:** You text "show me the app" and receive a screenshot of the running app on your phone via WhatsApp.

## What We're Building

A screenshot pipeline that lets Claude Code capture screenshots of a running dev server inside the Docker container and deliver them to the user's phone via WhatsApp. This is the first phase where **images flow from the VM to the phone**.

### End-to-End Flow

```
User texts "show me the app"
  → Twilio webhook → Relay → VM /command
  → Claude Code interprets the request
  → Claude Code curls POST /screenshot on the VM server
  → VM server uses Playwright to navigate + capture
  → Screenshot saved to /tmp/images/<uuid>.jpeg
  → Image registered in in-memory array
  → /command response includes images: [{ type: "screenshot", url: "/images/<uuid>.jpeg" }]
  → Relay reads images array
  → Relay proxies image at PUBLIC_URL/images/<uuid>.jpeg
  → Relay sends WhatsApp media via Twilio with mediaUrl pointing to relay's public URL
  → User receives screenshot on phone
```

## Why This Approach

### Playwright CLI over MCP

Playwright MCP (`@playwright/mcp`) has documented shortcomings (community reports on Reddit). Phase 2 already removed `.mcp.json` (commit 177f86f) in favor of Playwright CLI — calling it "simpler, more observable, fewer moving parts." Phase 4 continues this decision.

**Implication:** Claude Code doesn't have native `browser_screenshot` / `browser_navigate` MCP tools. Instead, the VM server owns Playwright and exposes it as an HTTP endpoint.

### Dedicated VM Endpoint (not Claude Code shelling out)

The VM server gets a `POST /screenshot` endpoint. Claude Code calls it via `curl` when it decides a screenshot is appropriate.

**Why not Claude Code running Playwright directly?**
- Clean separation: Playwright is a VM service, not a Claude Code concern
- Testable independently (`curl -X POST localhost:3001/screenshot`)
- VM server controls Playwright lifecycle, viewport config, compression
- Claude Code stays focused on interpreting user intent

### Claude Code Decides When to Screenshot (not keyword matching)

The user's message goes through `/command` as normal. Claude Code's intelligence decides when screenshots are appropriate — "show me the app" triggers one, "show me the code" does not. No brittle keyword lists on the relay.

### Relay Proxies Images (not a second ngrok tunnel)

Twilio needs a publicly accessible URL to fetch media. The VM is on `localhost:3001` (not public). The relay adds a `GET /images/:filename` route that fetches from `CLAUDE_HOST/images/:filename` and serves it through the relay's public ngrok URL.

- One public surface (ngrok → relay)
- No second tunnel to manage
- Works identically in production (relay just points to VM's internal URL)

### Ephemeral Images (no database)

Images are working artifacts that guide the current conversation — not long-term storage. `/tmp/images/` is sufficient. A TTL-based cleanup (e.g., delete files older than 1 hour) or cap (keep last 100) prevents disk fill. No SQLite, no document store.

### In-Memory Image Tracking Per Command

The `/screenshot` endpoint appends `{ filename, type }` to a simple in-memory array. When `/command` finishes, it drains this array into the response's `images` field. Array resets per command. Lightweight, fits the ephemeral model.

### YAGNI on ImageStore Interface

No formal `ImageStore` class with `upload()`/`getUrl()` methods. Just two functions: save an image to `/tmp/images/`, serve it via the existing `GET /images/:filename` endpoint. Add the abstraction when R2/S3 is actually needed (Phase 7+ at earliest).

### Simple Static HTML for Test Target

A single `index.html` served by a lightweight server (e.g., `npx serve`) inside Docker. Minimal footprint, fast startup, proves the screenshot pipeline without adding framework complexity. Not a Vite or Next.js app.

## Key Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Playwright CLI, not MCP | Documented MCP shortcomings; Phase 2 already removed it |
| 2 | Dedicated `POST /screenshot` VM endpoint | Clean separation; VM owns Playwright |
| 3 | Claude Code triggers screenshots via curl | AI decides when screenshots are appropriate; no keyword matching |
| 4 | Relay proxies images for Twilio | One public surface; works local and production |
| 5 | Ephemeral `/tmp/images/` storage | Images guide current activity, not long-term store |
| 6 | In-memory array tracks images per command | Lightweight; reset per command; no DB needed |
| 7 | No ImageStore abstraction (YAGNI) | Add when R2/S3 is actually needed |
| 8 | Simple static HTML test target | Minimal footprint; proves pipeline |

## Scope

### In Scope (Phase 4)
- `POST /screenshot` endpoint on VM server (Playwright capture, JPEG compression, viewport config)
- In-memory image tracking per command execution
- Relay image proxy route (`GET /images/:filename`)
- Relay WhatsApp media delivery (read `images` array, send via Twilio `mediaUrl`)
- TTL or cap-based cleanup for `/tmp/images/`
- Simple static HTML dev server inside Docker for testing
- JPEG compression to < 1MB for screenshots
- Mobile (390px) and desktop (1440px) viewport support at 2x DPR

### Out of Scope
- Playwright MCP / `.mcp.json`
- ImageStore interface / abstraction layer
- SQLite or any persistent database
- Vite / Next.js sample app
- Diff images (Phase 5)
- Image authentication / token-based access (Phase 7)
- R2/S3 migration (Phase 7+)

## Open Questions

_None — all design questions resolved during brainstorming._

## Phase 4 Spec Updates Needed

The current `04-phase-screenshots.md` has stale references that conflict with decisions made here:
- References `.mcp.json` and Playwright MCP — should reflect CLI approach + `/screenshot` endpoint
- Calls for ImageStore interface — should note YAGNI decision
- Sample dev server described as Vite/Next.js — should be simple static HTML
