# Post-Deploy Enhancements

**Date:** 2026-02-27
**Context:** Deferred from Phase 7 brainstorm to keep deployment focused on MVP.

## 1. Git Repo Persistence (Volume)

Clone repos to `/data/repos/<repo>` on first command referencing a repo. Persists across Machine restarts so Claude Code operates on a real git repo.

**Why deferred:** Phase 7's goal is "deploy what we have." Git repo cloning is a new feature, not deployment infrastructure. The current system works without persistent repos.

**When to revisit:** After Phase 7 deploys successfully and the basic flow works end-to-end in production.

## 2. Relay State Persistence

The relay's in-memory state (`userState` Map — queue, approval timers, busy flags) is lost on restart. Adding SQLite or file-based persistence would survive rare restarts without losing user context.

**Open decision:** SQLite vs file-based. SQLite adds a dependency but is more robust; file-based is simpler. For single-user, file-based JSON is likely sufficient.

**Why deferred:** Relay restarts are rare, and for single-user deployment the impact is low — user just resends their message. Not worth the added complexity for Phase 7 MVP.

**When to revisit:** Phase 8 (multi-user) where losing state affects multiple users simultaneously.

## 3. Validate Self-Hosted Provisioning End-to-End

Run `scripts/setup.sh` with a test prefix (e.g., `test-ts`) on a fresh Fly.io account to confirm the full provisioning flow works: app creation, secret injection, Dockerfile builds on Fly.io's remote builders, Flycast networking, health checks. Then configure Twilio webhook and send a WhatsApp message to verify the deployed stack responds. Tear down with `scripts/teardown.sh` after.

**Why deferred:** Requires interactive terminal session with live Fly.io credentials and Twilio webhook reconfiguration. Code-reviewed and all flyctl commands match the proven Phase 7 deployment.

**When to revisit:** Before sharing the repo publicly or onboarding the first external user.
