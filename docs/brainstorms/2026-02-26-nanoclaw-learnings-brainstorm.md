---
date: 2026-02-26
topic: NanoClaw Learnings
phase: General
condensed: true
original: archive/brainstorms/2026-02-26-nanoclaw-learnings-brainstorm.md
---

# NanoClaw Learnings: What to Adopt (Condensed)

## Summary

Identified three MVP features inspired by NanoClaw (messaging-to-container-to-Claude project) and three deferred features. NanoClaw validates the messaging-to-container pattern works at scale; we adopt its best ideas while keeping our Claude Code CLI architecture.

## Key Decisions

- **Session resume (MVP)**: Use Claude Code CLI `--continue` flag to resume conversations. One VM per user means no session ID tracking needed. Upgrade to `--resume <id>` when multi-project support arrives.
- **Relay-side message queue (MVP)**: In-memory per-user queue in the relay (not the VM). User texts while busy get queued and processed in order. Keeps VM simple.
- **Container idle shutdown (MVP)**: Timer-based in vm-server.js (30min default, configurable). VM exits on idle; Fly.io auto-start handles wake-up on next request.
- **Deferred features**: Scheduled tasks, mid-execution injection, explicit session IDs -- all postponed until core loop is solid.
- **Phase placement**: All three MVP features target Phase 3 (when relay and VM first connect).

## Outcomes

- NanoClaw comparison validated our architectural choices (CLI vs SDK, webhooks vs polling, persistent vs ephemeral)
- Session resume is a one-line change (`claude -p` to `claude -p --continue`)
- Idle shutdown leverages Fly.io auto-start for zero cold-start complexity
- Mid-execution injection deferred because it requires replacing one-shot `claude -p` with persistent process + IPC

## Status

Completed -- MVP features implemented in Phase 3. Deferred features remain in backlog.
