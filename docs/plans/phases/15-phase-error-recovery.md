# Phase 15: Error Recovery

**Stage:** Scale and Polish
**Depends on:** Phase 11 (Beta)
**Done when:** VM restart is detected and communicated. Stale sessions are handled. Thrashing agent is caught and user is offered a fresh start. Messages sent during active work are queued.

## What You Build

Error recovery and resilience features that make the product robust for real users. VM restart detection, stale session handling, thrashing detection, and message queuing during active workflows.

Deliverables:
- **VM restart detection:** Relay periodically pings VM `/health`. If VM goes down, sends SMS: "Your session was interrupted. Last state saved at commit [hash]. Reply 'resume' to pick up where you left off."
- **Stale session handling:** If a session has been idle for > 24 hours with uncommitted changes, send a reminder SMS. If idle > 7 days, auto-stash and notify.
- **Thrashing detection:** Monitor Claude Code output for repeated failure patterns (3+ similar error messages or "attempt N of..." patterns). Send: "Agent may be stuck (3 failed attempts on the same issue). Reply 'fresh' to spawn a new agent, or 'stop' to cancel."
- **Message queuing during active work:** When the relay state is `working`, incoming messages are queued (not rejected). Reply: "I'm currently working on your last request. I'll process your next message when this completes. Reply 'cancel' to stop." Process queued messages after the current task completes.

## Tasks

- [ ] Implement VM health monitoring and restart recovery — periodic health checks, interrupt notification, resume flow
  - Plan: `/workflow:plan VM health monitoring — periodic pings, restart detection, user notification, resume`
  - Ship: `/workflow:ship docs/plans/YYYY-MM-DD-feat-vm-health-plan.md`

- [ ] Implement thrashing detection and message queuing — pattern matching on repeated failures, queue messages during active work
  - Plan: `/workflow:plan thrashing detection and message queuing — failure pattern detection, message queue, fresh agent spawning`
  - Ship: `/workflow:ship docs/plans/YYYY-MM-DD-feat-thrashing-queue-plan.md`

## Notes

- VM health monitoring is a background process on the relay, not triggered by user messages. Use a simple interval (every 30 seconds) pinging each active user's VM `/health` endpoint.
- Thrashing detection uses simple heuristics, not AI. Look for: repeated error strings in Claude Code output, "attempt N" patterns, same file being modified 3+ times in a row.
- Message queuing upgrades the Phase 3 concurrency guard from "reject" to "queue." Instead of replying "Still working..." and dropping the message, store it and process after the current task completes.
- The "fresh" command spawns a new `claude -p` process on the VM with a handoff prompt containing: what was attempted, current state, observed errors. This leverages the thrashing handoff pattern from CLAUDE.md.
