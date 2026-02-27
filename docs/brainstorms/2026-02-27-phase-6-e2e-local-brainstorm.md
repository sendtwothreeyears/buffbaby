---
date: 2026-02-27
topic: phase-6-e2e-local
phase: 6
condensed: true
original: archive/brainstorms/2026-02-27-phase-6-e2e-local-brainstorm.md
---

# Phase 6: End-to-End Local (Condensed)

## Summary

Designed the full local loop: phone message to Claude Code execution to progress streaming to diff/screenshot delivery to approval-based PR creation. Two deliverables were scoped: progress update streaming (VM POSTs callbacks to relay) and an approval state machine (idle/working/awaiting_approval). This is the demo milestone where the product works end-to-end from a phone.

## Key Decisions

- **Callback-first build order**: Progress streaming built first, approval flow layered on top -- each testable independently.
- **VM-to-relay via `RELAY_CALLBACK_URL`**: Environment variable; Docker for Mac uses `host.docker.internal:3000`.
- **Phone number as session ID**: Already the key in `userState` Map; relay callback endpoint is `POST /callback/:phone`.
- **Structured progress markers (`::progress::`)**: Claude Code emits markers in stdout; VM parses and POSTs to relay. No fuzzy matching.
- **Three-state machine replacing busy boolean**: `idle` (accept commands), `working` (queue messages, accept cancel), `awaiting_approval` (approve/reject/cancel only).
- **Dedicated `/approve` endpoint on VM**: Relay sends `{ approved: true/false }`; VM triggers PR creation or undo.
- **30-minute approval timeout**: Returns to idle, changes preserved on disk.
- **Cancel kills process group**: `SIGTERM` via `process.kill(-child.pid)`, discard output, return to idle.

## Outcomes

- Data flow fully specified: 15-step sequence from WhatsApp message to PR URL delivery
- Applied institutional learnings from prior phases (session lifecycle, transport-agnostic API, partial results on error, budget-aware formatting, process group management)
- One open question carried forward: what "reject" does concretely (git checkout vs stash vs leave dirty)

## Status

Completed / Implemented in Phase 6
