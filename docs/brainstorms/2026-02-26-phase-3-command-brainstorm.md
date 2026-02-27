---
date: 2026-02-26
topic: phase-3-command
phase: 3
condensed: true
original: archive/brainstorms/2026-02-26-phase-3-command-brainstorm.md
---

# Phase 3: Command — Expanded Scope (Condensed)

## Summary

Explored connecting the relay to the VM (core transport) and expanded the original Phase 3 plan with three NanoClaw-inspired features: session resume via `--continue`, relay-side message queue, and container idle shutdown. Incorporated learnings from Phase 1-2 compounds on Docker, webhook parsing, and logging conventions.

## Key Decisions

- **Async webhook pattern**: Respond 200 OK immediately, process in background, send result via Twilio REST API (Twilio gives only 15s for webhook response)
- **Message queue over concurrency guard**: Instead of rejecting messages while busy, queue them and acknowledge ("Got it, I'll process this next"); cap at 5 per user
- **Session resume via `--continue`**: One-line change to `claude` spawn args; upgrade to `--resume <id>` when multi-project is added
- **Idle shutdown checks `!busy`**: Don't kill mid-command; Docker Compose `restart: unless-stopped` handles restart locally, Fly.io auto-start in production
- **Relay retries once on VM connection failure**: Covers cold-start window after idle shutdown without polling
- **In-memory queue acceptable for MVP**: Persistent queue (SQLite) deferred; relay rarely restarts
- **Node 22 native `fetch`**: No new HTTP client dependency needed
- **New env vars**: `CLAUDE_HOST` (relay, default `http://localhost:3001`), `IDLE_TIMEOUT_MS` (VM, default 30 min)

## Outcomes

- Relay grows from ~68 LOC echo server to ~150-200 LOC forwarding + queue server
- VM changes are surgical (~15-30 lines added for idle shutdown + `--continue`)
- Docker Compose needs no changes — networking already works
- Logging extended with `[FORWARD]`, `[RESPONSE]`, `[QUEUED]`, `[DEQUEUED]`, `[IDLE]` prefixes

## Status

Completed — Implemented in Phase 3
