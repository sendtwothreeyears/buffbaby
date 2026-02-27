# Phase 6: End-to-End Local — Brainstorm

**Date:** 2026-02-27
**Phase:** 6 (End-to-End Local)
**Status:** Brainstorm complete

## What We're Building

The full local loop: text a command from your phone → Claude Code executes → progress updates stream to WhatsApp → diffs and screenshots delivered → reply "approve" to create a PR. All running on your Mac.

Two deliverables:
1. **Progress update streaming** — VM POSTs milestone callbacks to the relay during execution; relay forwards them as WhatsApp messages
2. **Approval flow** — Relay state machine (idle → working → awaiting_approval → idle) with keyword routing for approve/reject/cancel

This is the **demo milestone**. At the end of Phase 6, the product works end-to-end from your phone.

## Why This Approach

### Callback-First Implementation Order

Build progress streaming first, then layer the approval state machine on top.

**Rationale:**
- Progress streaming delivers value independently — you see milestone updates even without the approval flow
- Each piece is testable in isolation before wiring together
- Matches the two-task split already defined in the phase spec
- Incremental: can demo progress updates before the full approval loop is ready

### Key Architecture Decisions

**1. VM-to-Relay Communication: Environment Variable**
- Add `RELAY_CALLBACK_URL` to the VM's `.env`
- Docker for Mac uses `host.docker.internal:3000` to reach the host relay
- Simple, explicit, no request-level coordination needed

**2. Session Identification: Phone Number**
- Use the phone number (already the key in `userState` Map) as the session identifier
- Relay callback endpoint: `POST /callback/:phone`
- Already unique per user, works for multi-user later

**3. Milestone Format: Structured Markers in System Prompt**
- Instruct Claude Code (via system prompt) to emit progress markers: `::progress:: message`
- VM parses stdout for these markers and POSTs them to the relay callback
- Explicit contract — no fuzzy pattern matching, won't false-positive on normal output

**4. Approval Trigger: Special Field in VM Response**
- VM response includes `approvalRequired: true` when Claude Code emits `::approval::` marker
- Relay transitions to `awaiting_approval` state and prompts the user
- Clean separation between "Claude is done" and "Claude wants approval"

**5. Approval Delivery: Dedicated VM Endpoint**
- New `POST /approve` endpoint on the VM
- Relay sends `{ approved: true/false }` when user responds
- VM handler triggers Claude Code to create PR or undo changes
- Clean separation from the `/command` endpoint

**6. State Machine: Replace busy boolean**
- Current: `{ busy: boolean, queue: string[] }`
- New: `{ state: 'idle' | 'working' | 'awaiting_approval', queue: string[] }`
- `idle` — accept new commands
- `working` — queue messages, accept "cancel" to kill process
- `awaiting_approval` — only accept "approve", "reject", "cancel"; reply with instructions for anything else

**7. Queue Behavior in awaiting_approval: No Queue**
- Only recognize approve/reject/cancel keywords
- Reply to anything else: "Reply 'approve' to create PR or 'reject' to undo."
- No message queuing during approval state

**8. Cancel Behavior: Kill Process, Return to Idle**
- Send SIGTERM to Claude Code process group (existing `process.kill(-child.pid)` pattern)
- Discard pending output
- Transition to idle
- Fast and clean

**9. Approval Timeout: 30 Minutes**
- Timer starts when entering `awaiting_approval`
- On timeout: transition to `idle`, send "Approval timed out. Changes preserved."
- Changes stay on disk — user can send a new command to pick up where they left off

## Open Questions

1. **What does "reject" do concretely?** Approve creates a PR. Reject "undoes changes" — but how? `git checkout .`? `git stash`? Leave files dirty and return to idle? Needs a decision before planning.

## Data Flow

```
1. User sends WhatsApp message
2. Twilio → POST /webhook → relay
3. Relay: state idle → working, forward to VM (POST /command { text, callbackPhone }) — relay includes the user's phone number so the VM knows where to POST callbacks
4. VM: spawn Claude Code, pipe prompt via stdin
5. Claude Code emits ::progress:: markers in stdout
6. VM: parse markers, POST /callback/:phone { type: 'progress', message }
7. Relay: receive callback, sendMessage() to WhatsApp
8. Claude Code finishes, emits ::approval:: marker (or not)
9. VM: respond to /command with { text, images, diffs, approvalRequired }
10. Relay: if approvalRequired → state awaiting_approval, send prompt to user
11. User replies "approve"
12. Relay: POST /approve { approved: true } to VM
13. VM: spawn Claude Code to create PR
14. VM: respond with PR URL
15. Relay: send PR URL to WhatsApp, state → idle
```

## Institutional Learnings Applied

From `docs/solutions/`:
- **Session lifecycle pattern** (screenshot pipeline): Reset → accumulate → drain on all exit paths
- **Transport-agnostic API** (web chat bypass): Keep approval logic decoupled from WhatsApp specifics
- **Partial results on error** (compression pipeline): Surface diffs/screenshots even on error/timeout
- **Budget-aware formatting** (diff pipeline): Progress messages subject to 4096-char WhatsApp limit
- **Process group management** (Docker VM setup): `detached: true` + `process.kill(-child.pid)` for cancel

## Scope Constraints

- Relay stays ~200-300 LOC — intelligence lives in Claude Code, not the relay
- In-memory state only — no database for alpha stage
- Single-concurrency on VM preserved (one command at a time)
- No real-time streaming — WhatsApp delivers complete messages; milestones are periodic batch updates
