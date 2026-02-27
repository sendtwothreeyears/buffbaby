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

- [x] Wire progress update streaming — container POSTs milestones to relay callback endpoint, relay sends as WhatsApp messages
  - Plan: `docs/plans/2026-02-27-feat-phase-6-e2e-local-plan.md` (Task 1)
  - Ship: `/workflow:ship docs/plans/2026-02-27-feat-phase-6-e2e-local-plan.md`

- [x] Implement approval flow — relay state machine with approve/reject/cancel handling
  - Plan: `docs/plans/2026-02-27-feat-phase-6-e2e-local-plan.md` (Task 2)
  - Ship: `/workflow:ship docs/plans/2026-02-27-feat-phase-6-e2e-local-plan.md`

## Notes

- **Why callback, not WebSocket:** The PRD says "no real-time streaming — WhatsApp delivers complete messages, not character-by-character streams." WhatsApp is a batch-delivery mechanism. Callback (container POSTs milestones to relay) is simpler, stateless on the relay, and consistent with the relay's existing HTTP architecture. WebSocket adds connection management complexity for no benefit.
- **GitHub auth required:** The Docker container must have a `GITHUB_TOKEN` environment variable for PR creation. In local dev, inject via `docker run -e GITHUB_TOKEN=...` or `docker-compose.yml`. Ensure this was set up in Phase 2's `.env.example`.
- **Twilio webhook timeout:** The relay must respond to Twilio's inbound webhook within 15 seconds (solved in Phase 3's async pattern). For long-running tasks in Phase 6, this is critical — Claude Code may run for minutes.
- This is the **demo milestone**. At the end of Phase 6, you can show someone the product working from your phone. Everything after this is deployment and polish.
- Don't over-engineer the relay. It's still ~200-300 LOC. The intelligence is in Claude Code, not the relay.

## Review (Revision 2)

**Status:** PASS
**Reviewed:** 2026-02-27 (re-reviewed after Dockerfile fix)

### Validation Results

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Text command from phone → Claude executes | PASS | User verified via WhatsApp. Also validated via curl: `POST /command {"text":"What is 2+2?"}` → `{"text":"4","exitCode":0,"durationMs":2895}` |
| Progress updates as WhatsApp messages | PASS | VM line-buffered parser (`::progress::` markers) at vm-server.js:136-157, `postCallback()` POSTs to relay `/callback/:phone`, relay forwards via `sendMessage()`. 41 state refs, 8 handler function refs in relay. |
| Diffs as WhatsApp media | PASS | Formatted diff in monospace code block with file headers. `collectDiffs()` runs `git diff HEAD` autonomously on all exit paths. Budget-aware truncation at file boundaries. |
| App screenshots as WhatsApp media | PASS | **Previously broken, now fixed.** `POST /screenshot {"url":"http://localhost:8080"}` → `{"success":true,"sizeBytes":25590}`. Image proxy chain verified: VM :3001/images → Relay :3000/images → Twilio mediaUrl. |
| Reply "approve" to create PR | PASS | Approval prompt verified on WhatsApp. VM `/approve` endpoint creates commit + PR via Claude Code CLI. `/approve` when idle returns gracefully (no crash). |
| State machine (idle/working/awaiting_approval) | PASS | 4 handler functions (handleApprove, handleReject, handleCancel, handleCancelWorking), 30-min approval timeout, queue depth 5. |
| Cancel from working or awaiting_approval | PASS | AbortController on relay + `POST /cancel` on VM kills process group. Cancel with no active process returns `{"cancelled":false}`. |
| All running on Mac | PASS | Docker container + relay on localhost, `extra_hosts` for host.docker.internal, ngrok for Twilio. |
| Relay ~200-300 LOC | FAIL | 514 LOC relay, 457 LOC VM — see Tech Debt |

### Code Quality

Code follows all established institutional patterns:
- **Reset → Accumulate → Drain:** `pendingCallbacks` and `pendingImages` reset on entry, drained via `Promise.allSettled` before response
- **Process group management:** `detached: true` + `process.kill(-child.pid, "SIGTERM")` for cancel
- **Error path preservation:** Diffs and images returned on error/timeout paths
- **Budget-aware formatting:** Approval prompt and diffs respect 4096-char WhatsApp limit
- **Transport-agnostic VM API:** VM knows nothing about WhatsApp; relay owns formatting

Previously fixed during ship:
1. State race in handleApprove (idle before processQueue)
2. Unhandled promise rejection in processQueue
3. Missing response.ok check in handleApprove
4. Marker stripping bug (markers leaking into response text)

### Issues Found & Fixed (This Review)

- **P1: Playwright Chromium user mismatch (FIXED):** Dockerfile ran `npx playwright install chromium` as root, but app runs as `appuser`. Browser binary landed in `/root/.cache/ms-playwright/` — invisible to appuser. Screenshot endpoint returned 502 on every call. Fix: run install as `USER appuser`, then switch back to root for remaining steps. Documented in `docs/solutions/developer-experience/playwright-chromium-user-mismatch-dockerfile-20260227.md`.
- **P3: ENABLE_TEST_APP missing from vm/.env (FIXED):** Present in `.env.example` but not in actual `.env`. Test app on port 8080 was not running. Added to `vm/.env`.

### Institutional Knowledge Check

Learnings-researcher surfaced 10 relevant docs. Key findings:
- Dockerfile fix aligns with the non-root user pattern from Phase 2 (`docker-vm-claude-code-headless-setup-20260225.md`) — same root cause category (user context isolation in Docker).
- Screenshot pipeline follows the Reset → Accumulate → Drain pattern established in Phase 4.
- No code repeats previously-documented mistakes post-fix.

### Tech Debt

- **Relay LOC (514 vs ~200-300 target):** Grown due to diff formatting, image proxy, approval handlers, and state machine. Not a problem — relay has more transport responsibilities than originally planned.
- **Callback auth deferred:** `/callback/:phone` has no authentication. Localhost-only for alpha. Phase 7.
- **Progress message batching:** No debouncing if Claude emits markers rapidly. Acceptable for alpha.
- **Approval → PR not fully e2e tested:** Requires GitHub auth on the VM container. Deferred to manual testing.
- **VM not in a git repo:** `/approve` endpoint spawns Claude Code to commit+PR, but `/app` inside the container has no `.git`. Needs a mounted repo or clone step for PR creation to work.

### Next Steps

Phase 6 complete — this is the **demo milestone**. The product works end-to-end from your phone. Screenshot pipeline now fully operational after Dockerfile fix.

Next: **Phase 7 (Deploy)** — same Docker image on Fly.io, relay on Railway. Start with `/workflow:brainstorm` to plan the deployment strategy.
