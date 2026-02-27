# WhatsApp Agentic Development Cockpit — Phase Plan

**Source PRD:** `PRD_WHATSAPP_AGENTIC_COCKPIT.md`
**Generated:** 2026-02-25
**Method:** `/phase-prd`
**Total:** 16 phases, 27 tasks

---

## Architectural Layers

1. **Messaging layer** — Twilio WhatsApp (inbound/outbound)
2. **Relay layer** — thin Node.js server (webhook handler + router, ~200-300 LOC)
3. **Compute layer** — Docker container with Claude Code CLI + Playwright
4. **Image layer** — screenshot/diff rendering + HTTP serving from VM
5. **Onboarding layer** — signup website, database, provisioning, payments

## Dependency Chain

```
Twilio → Relay → Docker/Claude Code → Playwright → Image serving
                                                         ↓
                                              WhatsApp delivery back through Twilio
```

## Core Experience

You send a command via WhatsApp, Claude Code executes it, you get the result back as a WhatsApp message. The relay is a dumb pipe — it forwards text and delivers images. All intelligence lives in Claude Code on the user's VM.

---

## Workflow

Each phase follows the development loop:

1. `/workflow:brainstorm` — Explore approach (skip if scope is obvious)
2. `/workflow:plan` — Create a plan document in `docs/plans/`
3. `/workflow:ship` — Implement from the plan document
4. `/workflow:phase-review` — Validate phase deliverables before moving on

---

## Stage 1: Local Development

_Goal: Prove the core experience works on your Mac._
_Cost: Free (Twilio WhatsApp Sandbox is free)._
_Characteristics: Hardcoded `.env`, no database, no website, no payments._

- Phase 1: Echo → `01-phase-echo.md`
- Phase 2: Docker → `02-phase-docker.md`
- Phase 3: Command → `03-phase-command.md`
- Phase 4: Screenshots → `04-phase-screenshots.md`
- Phase 4.2: WhatsApp Channel → `04.2-phase-whatsapp.md`
- Phase 5: Diffs → `05-phase-diffs.md`
- Phase 6: End-to-End Local → `06-phase-e2e-local.md`

## Stage 2: Deploy to Production

_Goal: Same experience, but running in the cloud — works when your laptop is closed._
_Cost: ~$180 upfront._
_Key principle: Same Docker image, different host. Config change, not a rewrite._

- Phase 7: Deploy → `07-phase-deploy.md`
- Phase 8: Provisioning → `08-phase-provisioning.md`
- Phase 9: Onboarding → `09-phase-onboarding.md`
- Phase 10: Session Management → `10-phase-session-mgmt.md`

## Stage 3: Scale and Polish

_Goal: Other people can use it._
_Characteristics: Multi-user, monitoring, rich features, error handling._

- Phase 11: Beta → `11-phase-beta.md`
- Phase 12: Conversational Navigation → `12-phase-conversational-nav.md`
- Phase 13: Multi-Agent → `13-phase-multi-agent.md`
- Phase 14: CI/CD → `14-phase-cicd.md`
- Phase 15: Error Recovery → `15-phase-error-recovery.md`
- Phase 16: UX Polish → `16-phase-ux-polish.md`

---

## Deferred

```
DEFERRED TO STAGE 2 (Deploy):
- Fly.io deployment
- Automated VM provisioning
- Public endpoints without ngrok

DEFERRED TO STAGE 3 (Scale):
- Multi-user routing
- Conversational navigation
- Multi-agent status updates
- CI/CD integration
- Error recovery and thrashing detection
- Composite images
- /help, /history, /cost commands

DEFERRED BEYOND V1:
- Stripe payments
- WhatsApp group chats
- Multi-project management
- Native app
- Multi-channel expansion (Telegram, Discord)
- ImageStore migration to R2/S3
- Dictation error correction ("Did you mean X?")
```

---

## Graduation Criteria (from PRD)

Before proceeding to wider launch, all of the following must be true:

- At least 10 engineers from the bootcamp cohort have used it for 2+ weeks
- Engineers report being able to complete at least 50% of their agentic workflow sessions via WhatsApp
- Relay server uptime > 99% over a 2-week period
- Zero instances of message loss or incorrect routing
- Media messages delivered reliably via WhatsApp
- Works on both iPhone and Android without platform-specific issues

These criteria are tracked in Phase 11 (Beta).

---

## How to Execute

1. Start with Phase 1 (Echo). Validate from your phone.
2. Phase 2 (Docker) can run in parallel with Phase 1.
3. After both are validated, proceed to Phase 3 (Command).
4. Continue sequentially — each phase adds one new capability.
5. At Phase 6, you have a demoable product running locally.
6. Stage 2 is a deployment exercise, not a code change.
7. Phase 10 (Session Management) gives beta users the tools to manage their workflow.
8. Stage 3 starts with beta users and iterates based on feedback.

Each phase is a demo. Each task has a concrete done state. If a phase fails, you know exactly what broke because it only introduced one new thing.
