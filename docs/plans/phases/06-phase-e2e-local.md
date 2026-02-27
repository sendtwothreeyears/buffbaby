# Phase 6: End-to-End Local

**Stage:** Local Development
**Depends on:** Phase 3 (Command), Phase 4 (Screenshots), Phase 5 (Diffs)
**Done when:** You text a natural language command from your phone, Claude Code executes it, you receive progress updates as WhatsApp messages, diff images and app screenshots as WhatsApp media, and can reply "approve" to create a PR on GitHub. All running on your Mac.

## What You Build

The full local experience. Everything from Phases 1-5 wired together into a complete loop. The relay becomes a real product — not just echo or forward, but a conversational bridge between the engineer's phone and their Claude Code instance.

This phase doesn't add new infrastructure — it polishes the integration between existing pieces and adds the interactive elements (progress updates, approval flow) that make it feel like a product.

Deliverables:
- **Progress update streaming via callback:** The API wrapper on the container POSTs milestone updates to a callback URL on the relay (e.g., `POST /callback/:sessionId`). The relay sends each update as a WhatsApp message. This matches the relay's existing webhook-based architecture and avoids the complexity of WebSocket connections.
- **Approval flow with state machine:** Per-session state: `idle` → `working` → `awaiting_approval` → `idle`. Relay recognizes "approve" and "reject" keywords and routes them to Claude Code.
- Full loop validated: text → Claude Code → code changes → diff images + screenshots → approve → PR created
- Relay is ~200-300 LOC

## State Machine

```
idle ──(user sends message)──→ working
working ──(Claude Code sends milestone)──→ working (send status update)
working ──(Claude Code requests approval)──→ awaiting_approval
working ──(Claude Code finishes without approval)──→ idle
working ──(Claude Code errors)──→ idle (send error message)
working ──(user sends message)──→ working (reply "Still working on your last request. Reply 'cancel' to stop.")
awaiting_approval ──(user sends "approve")──→ working (forward to Claude Code)
awaiting_approval ──(user sends "reject")──→ idle (forward to Claude Code)
awaiting_approval ──(user sends anything else)──→ awaiting_approval (reply "Reply 'approve' to create PR or 'reject' to undo.")
awaiting_approval ──(30 min timeout)──→ idle (send "Approval timed out. Changes preserved.")
```

## Tasks

- [ ] Wire progress update streaming — container POSTs milestones to relay callback endpoint, relay sends as WhatsApp messages
  - Plan: `/workflow:plan progress update streaming — container callback to relay, relay sends periodic WhatsApp status updates`
  - Ship: `/workflow:ship docs/plans/YYYY-MM-DD-feat-progress-updates-plan.md`

- [ ] Implement approval flow — relay state machine with approve/reject/cancel handling
  - Plan: `/workflow:plan approval flow — relay state machine with approve, reject, cancel, timeout transitions`
  - Ship: `/workflow:ship docs/plans/YYYY-MM-DD-feat-approval-flow-plan.md`

## Notes

- **Why callback, not WebSocket:** The PRD says "no real-time streaming — WhatsApp delivers complete messages, not character-by-character streams." WhatsApp is a batch-delivery mechanism. Callback (container POSTs milestones to relay) is simpler, stateless on the relay, and consistent with the relay's existing HTTP architecture. WebSocket adds connection management complexity for no benefit.
- **GitHub auth required:** The Docker container must have a `GITHUB_TOKEN` environment variable for PR creation. In local dev, inject via `docker run -e GITHUB_TOKEN=...` or `docker-compose.yml`. Ensure this was set up in Phase 2's `.env.example`.
- **Twilio webhook timeout:** The relay must respond to Twilio's inbound webhook within 15 seconds (solved in Phase 3's async pattern). For long-running tasks in Phase 6, this is critical — Claude Code may run for minutes.
- This is the **demo milestone**. At the end of Phase 6, you can show someone the product working from your phone. Everything after this is deployment and polish.
- Don't over-engineer the relay. It's still ~200-300 LOC. The intelligence is in Claude Code, not the relay.
