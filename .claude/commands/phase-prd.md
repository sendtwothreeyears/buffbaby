---
name: phase-prd
description: Break a PRD into phased, /ship-able work. Use when you have a PRD and need to decompose it into sequenced phases with clear validation criteria, ordered by dependency so each phase builds on the last.
---

# Phase a PRD into Shippable Work

Take a PRD and decompose it into sequenced development phases, where each phase has a clear "done" state and maps to one or more `/ship` tasks.

## When to Use

- You have a completed PRD and need to start building
- A project has multiple layers that depend on each other
- You need to sequence work so each phase validates before the next begins
- You want to defer complexity (signup pages, payments, databases) until actually needed

## Phase 1: Read and Understand the PRD

1. Read the PRD thoroughly — scope, architecture, user flows, technical considerations
2. Identify the **architectural layers** — what are the distinct components? (e.g., messaging layer, compute layer, image pipeline, onboarding)
3. Identify **dependencies** — what must exist before something else can work? (e.g., you can't send screenshots via SMS until the SMS echo works)
4. Identify the **core experience** — what is the one thing that, if it works, proves the product? Everything else is built around this.

## Phase 2: Define Development Stages

Group phases into three stages. Each stage has a different goal:

### Stage 1: Local Development
- **Goal:** Prove the core experience works on your machine
- **Characteristics:** Hardcoded config (`.env`), no database, no website, no payments
- **Validation:** You can demo the product from your own device
- **Cost:** Minimal — only external service fees (APIs, messaging, etc.)

### Stage 2: Deploy to Production
- **Goal:** Same experience, but running in the cloud — works when your laptop is closed
- **Characteristics:** Cloud infrastructure, automated provisioning, public endpoints
- **Validation:** The product works identically to local, but you didn't touch your laptop
- **Key principle:** If you developed in containers (Docker) from day one, this is a config change, not a rewrite

### Stage 3: Scale and Polish
- **Goal:** Other people can use it
- **Characteristics:** Onboarding, multi-user support, error handling, payments
- **Validation:** Real users are using the product without your help

## Phase 3: Break Stages into Phases

Within each stage, create numbered phases. Each phase must have:

1. **A name** — short, descriptive (e.g., "Echo", "Docker", "Screenshots")
2. **What you build** — specific deliverables, not vague goals
3. **Dependencies** — which previous phase(s) must be complete
4. **Validation criteria** — one concrete test that proves it works. Prefer end-to-end validation over unit tests (e.g., "text the number and get a response" not "webhook handler passes unit tests")
5. **`/ship` tasks** — one or more tasks within the phase, each small enough for a single `/ship` run

### Sequencing Rules

- **Each phase builds on the previous.** Never start a phase whose dependency isn't validated.
- **The first phase is always the simplest possible proof of life.** (e.g., echo a message back, render a hello world, return a 200 OK)
- **Defer complexity.** If something isn't needed to validate the current phase, don't build it yet. Hardcode values, use `.env` files, skip the database.
- **Infrastructure before features.** Get the plumbing working (message in → message out) before adding rich behavior (diff images, multi-agent orchestration).
- **One new thing per phase.** Each phase should add exactly one new capability. If a phase introduces two new things and fails, you don't know which one broke.

### Phase Size Guide

- **Too small:** "Add Twilio webhook signature validation" — this is a task within a phase, not a phase itself
- **Right size:** "Relay forwards SMS to Claude Code in Docker, response comes back as SMS" — one new capability, clear validation
- **Too big:** "Full end-to-end workflow with screenshots, diffs, multi-agent, and session management" — break this into 4-5 phases

## Phase 4: Map Phases to `/ship` Tasks

For each phase, write out the `/ship` commands that will build it:

```
Phase 3: Command
  /ship relay forwards SMS text to Claude Code headless in Docker container and returns response as SMS

Phase 4: Screenshots
  /ship Claude Code uses Playwright MCP to capture app screenshots and relay sends them back via Twilio MMS
```

Each `/ship` task should be:
- **Self-contained** — it can be built and validated independently within the phase
- **Specific** — describes the exact behavior, not a vague goal
- **Validatable** — you know it works when you see a specific result

## Phase 5: Identify Deferred Work

Create an explicit list of things you are NOT building yet, and which stage they belong to:

```
DEFERRED TO STAGE 2 (Deploy):
- Automated VM provisioning
- Public endpoints without ngrok

DEFERRED TO STAGE 3 (Scale):
- Onboarding website
- User database
- Stripe payments
- Multi-user routing
- Error recovery
```

This prevents scope creep during early phases and gives you a ready-made backlog for later stages.

## Phase 6: Output the Phase Plan

Present the complete plan in this format:

```
## Stage 1: Local Development

### Phase 1: [Name]
- **Build:** [What you build]
- **Depends on:** Nothing (first phase)
- **Done when:** [Concrete validation]
- **Tasks:**
  - /ship [task description]

### Phase 2: [Name]
- **Build:** [What you build]
- **Depends on:** Phase 1
- **Done when:** [Concrete validation]
- **Tasks:**
  - /ship [task description]
  - /ship [task description]

...

## Stage 2: Deploy to Production
...

## Stage 3: Scale and Polish
...

## Deferred
- [Item] → Stage [N]
- [Item] → Stage [N]
```

## Principles

1. **Prove the core experience first.** Everything else is decoration until the fundamental loop works.
2. **One new capability per phase.** If it breaks, you know exactly what broke.
3. **Validate from the user's perspective.** Not "the function returns the right value" but "I texted the number and got the right response."
4. **Defer everything you can.** Databases, websites, payments, error handling — none of these matter until the core works.
5. **Local before cloud.** Build on your machine first. Deploy to production second. The same code should run in both places.
6. **Container-first development.** If your local environment matches production (Docker), the deploy phase is a config change, not a rewrite.
7. **Each phase is a demo.** At the end of every phase, you should be able to show someone what you built and they can see it working.
