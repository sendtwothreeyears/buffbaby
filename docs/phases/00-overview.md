# BuffBaby — Phase Plan

**Source PRD:** `docs/PRD_BUFFBABY.md`
**Generated:** 2026-02-27
**Method:** `/phase-prd`
**Foundation:** TextSlash Phases 1-8 (all PASS) — relay, VM, WhatsApp, Docker, screenshots, diffs, approval flow, deploy, provisioning
**Total:** 5 phases, 9 tasks

---

## Architectural Layers

1. **Adapter layer** — channel-agnostic relay core + per-channel adapters
2. **Channel layer** — Discord Bot API, Telegram Bot API, Twilio WhatsApp API
3. **Compute layer** — Docker container with Claude Code CLI + Playwright (unchanged from TextSlash)
4. **Image layer** — screenshot/diff rendering + HTTP serving from VM (unchanged)
5. **Agent layer** — multi-provider CLI abstraction (Claude Code, Codex, Gemini)

## Core Experience

Send a message on any supported channel (Discord, Telegram, WhatsApp). Claude Code executes it on your VM. You get the result back as a message with diffs, screenshots, and approval buttons — native to your channel.

---

## Workflow

Each phase follows the development loop:

1. `/workflow:brainstorm` — Explore approach (skip if scope is obvious)
2. `/workflow:plan` — Create a plan document in `docs/plans/`
3. `/workflow:ship` — Implement from the plan document
4. `/workflow:phase-review` — Validate phase deliverables before moving on

---

## Stage 1: Multi-Channel Foundation

_Goal: Same relay, three channels. Prove the adapter pattern works locally._

- Phase 9: Adapter Refactor → `09-phase-adapter-refactor.md`
- Phase 10: Discord → `10-phase-discord.md`
- Phase 11: Telegram → `11-phase-telegram.md`

## Stage 2: Polish & Extend

_Goal: Channel-native UX, resilience, multi-agent support._

- Phase 12: Mobile Dev Cockpit → `12-phase-channel-polish.md`
  - 12.1: Command Routing + VM Skills + SQLite
  - 12.2: Smart Output Rendering + Web Views
  - 12.3: Skill Discovery + Discord Slash Commands
  - 12.4: Polish + Additional Capabilities
- Phase 13: Multi-Agent → `13-phase-multi-agent.md`

---

## Deferred

```
DEFERRED TO STAGE 2 (Polish):
- Error recovery (VM health monitoring, thrashing detection)
- Session management (status, stop, resume)
- /help command
- Discord threads per command
- Telegram command menu

DEFERRED BEYOND V1:
- Web terminal escape hatch (xterm.js)
- Telegram Mini App
- CI/CD notifications
- Composite diff images
- Multi-agent orchestration status updates
- Voice commands via Discord
- iMessage, Slack adapters
```

---

## How to Execute

1. Start with Phase 9 (Adapter Refactor). Validate WhatsApp still works through the new architecture.
2. Phase 10 (Discord) and Phase 11 (Telegram) can run in parallel after Phase 9.
3. Phase 12 (Channel Polish) after all three channels are working.
4. Phase 13 (Multi-Agent) after polish is stable.

Each phase is a demo. Each builds on the validated TextSlash foundation (Phases 1-8).
