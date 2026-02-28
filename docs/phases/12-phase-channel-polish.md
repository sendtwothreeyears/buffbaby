# Phase 12: Mobile Development Cockpit

**Stage:** Polish & Extend
**Depends on:** Phases 10, 11 (Discord + Telegram both working)
**Done when:** Clone repos, switch between them, check status, get help — all from phone. Long output summarized with web view links. Project skills auto-discovered. PR lifecycle from phone.

## What You Build

Transform the WhatsApp/Discord/Telegram interface from a raw Claude Code terminal into a comprehensive phone-first development experience. Engineers clone repos, run project-specific skills, and view output properly — all from their phone, no laptop needed.

## Sub-Phases

| Phase | Name | Plan | Status |
|-------|------|------|--------|
| 12.1 | Command Routing + Core VM Skills + SQLite | `docs/plans/2026-02-27-phase-12.1-command-routing-plan.md` | active |
| 12.2 | Smart Output Rendering + Web Views | `docs/plans/2026-02-27-phase-12.2-output-rendering-plan.md` | pending |
| 12.3 | Project Skill Discovery + Discord Slash Commands | `docs/plans/2026-02-27-phase-12.3-skill-discovery-plan.md` | pending |
| 12.4 | Polish + Additional Capabilities | `docs/plans/2026-02-27-phase-12.4-polish-commands-plan.md` | pending |

**Dependency chain:** 12.1 → 12.2, 12.3 (parallel) → 12.4

## Tasks

- [ ] Phase 12.1: Command routing, VM skills (clone/switch/repos/status), SQLite persistence
  - Ship: `/workflow:ship docs/plans/2026-02-27-phase-12.1-command-routing-plan.md`

- [ ] Phase 12.2: Output type detection, web view rendering, adapter link formatting
  - Ship: `/workflow:ship docs/plans/2026-02-27-phase-12.2-output-rendering-plan.md`

- [ ] Phase 12.3: Skill scanning, Discord slash commands, dynamic help
  - Ship: `/workflow:ship docs/plans/2026-02-27-phase-12.3-skill-discovery-plan.md`

- [ ] Phase 12.4: PR lifecycle, branch management, onboarding flow
  - Ship: `/workflow:ship docs/plans/2026-02-27-phase-12.4-polish-commands-plan.md`

## Notes

- Full plan and brainstorm: `docs/plans/2026-02-27-feat-mobile-dev-cockpit-plan.md`
- One VM, one relay, one team. CWD is per-VM. Global command queue.
- SQLite on Fly volume for persistence. `better-sqlite3` (synchronous, no async complexity).
- Project skills invoked via Claude Code (freeform), not the command router. Router only discovers and displays them.
- Web views use UUID + 30-min TTL for security. HMAC-signed URLs deferred to production hardening.
