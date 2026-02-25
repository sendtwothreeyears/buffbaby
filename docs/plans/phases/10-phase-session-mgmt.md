# Phase 10: Session Management

**Stage:** Deploy to Production
**Depends on:** Phase 9 (Onboarding)
**Done when:** You text "status" and get your current session info. You text "stop session" and it stops. You text "resume [repo]" and it picks back up.

## What You Build

Session management commands recognized by the relay. These give users the ability to manage their working context: start a session on a specific repo and branch, check status, stop, and resume. This is a prerequisite for beta — without it, users have no way to manage their work context.

This is the first relay feature that requires persistent state beyond phone → VM routing. Session state is stored in Supabase alongside the user record.

Deliverables:
- Relay recognizes session commands: "start session [repo] [branch]", "stop session", "resume [repo]", "status"
- Session state stored in Supabase: current repo, branch, active/inactive, last activity timestamp
- "status" returns: active session info, VM health, recent activity summary
- Relay forwards session commands to Claude Code on the VM for execution (the relay recognizes the command type, Claude Code does the actual git clone/checkout/etc.)

## Tasks

- [ ] Implement session management — start, stop, resume, status commands via SMS with Supabase persistence
  - Plan: `/workflow:plan session management — relay-recognized commands, Supabase session state, VM lifecycle`
  - Ship: `/workflow:ship docs/plans/YYYY-MM-DD-feat-session-management-plan.md`

## Notes

- The relay recognizes a small set of keywords directly: "approve", "reject", "cancel" (from Phase 6), and now "start session", "stop session", "resume", "status". Everything else is forwarded to Claude Code verbatim.
- "status" is the most important command for beta users. It answers "what is my VM doing right now?" — critical when you've been away from your phone.
- Session state in Supabase: add columns to the existing `users` table or create a separate `sessions` table. A separate table is cleaner since a user could have multiple sessions over time.
- "stop session" should gracefully shut down any running dev server and commit/stash uncommitted changes. "resume" should restore the working state.
