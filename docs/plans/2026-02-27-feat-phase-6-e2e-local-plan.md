---
phase: 6
condensed: true
original: archive/plans/2026-02-27-feat-phase-6-e2e-local-plan.md
---

# Phase 6: End-to-End Local (Condensed)

**Stage:** Local Development
**Depends on:** Phase 5 (Code Diffs)
**Done when:** Full loop works from phone: send command, receive progress updates, see diffs/screenshots, reply "approve" to create PR. All running on Mac.

## Summary

Wired the full local loop with two deliverables: (1) progress streaming via `::progress::` markers in Claude Code stdout, parsed by a line-buffered VM parser that POSTs callbacks to the relay, forwarded as WhatsApp messages; (2) approval flow with a relay state machine (`idle -> working -> awaiting_approval -> idle`) supporting approve/reject/cancel keywords, 30-min timeout, and message queuing.

## Key Deliverables

- VM line-buffered stdout parser detecting `::progress::` and `::approval::` markers
- VM callback POST function with `pendingCallbacks` array drained via `Promise.allSettled` before response
- Relay `POST /callback/:phone` endpoint forwarding progress messages to WhatsApp
- Relay state machine replacing `busy` boolean with `state` field and `approvalTimer`/`abortController`
- `handleApprove()`: POSTs to VM `/approve`, VM runs Claude Code to commit + create PR, extracts PR URL
- `handleReject()`: POSTs to VM `/approve {approved:false}`, VM runs `git checkout . && git clean -fd`
- `handleCancelWorking()`: Aborts in-flight fetch + POSTs to VM `/cancel` to kill process group
- VM `/approve` and `/cancel` endpoints
- `vm/CLAUDE.md` updated with `::progress::` and `::approval::` marker instructions

## Key Technical Decisions

- **`::progress::` / `::approval::` marker format**: Simple line-based markers parseable by regex, emitted by Claude Code via CLAUDE.md instructions
- **Callbacks drained before `/command` response**: `Promise.allSettled(pendingCallbacks)` ensures all progress messages delivered before final response
- **State machine with keyword routing**: `awaiting_approval` only accepts approve/reject/cancel; other messages get an instruction reply
- **Cancel uses AbortController + process group kill**: Both relay (abort fetch) and VM (SIGTERM to process group) fire in parallel
- **Approval on clean exit only**: `::approval::` marker ignored if exit code is non-zero
- **No callback auth for alpha**: Localhost-only; deferred to Phase 7

## Status

Completed
