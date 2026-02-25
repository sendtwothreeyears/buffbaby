---
name: workflow:phase-prd
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

Write the plan to a `plan/` folder in the current working directory. Create one file per phase, plus an overview file.

### Folder Structure

```
plan/
├── 00-overview.md          # Full plan summary + deferred work
├── 01-phase-[name].md      # Phase 1
├── 02-phase-[name].md      # Phase 2
├── 03-phase-[name].md      # Phase 3
└── ...
```

### File Naming

- Prefix with zero-padded number matching the phase number (01, 02, ... 10, 11)
- Suffix with a kebab-case slug of the phase name (e.g., `01-phase-echo.md`, `02-phase-docker.md`)
- The overview file is always `00-overview.md`

### `00-overview.md` Format

```markdown
# [Project Name] — Phase Plan

## Stage 1: Local Development
- Phase 1: [Name] → `01-phase-[name].md`
- Phase 2: [Name] → `02-phase-[name].md`

## Stage 2: Deploy to Production
- Phase 3: [Name] → `03-phase-[name].md`

## Stage 3: Scale and Polish
- Phase 4: [Name] → `04-phase-[name].md`

## Deferred
- [Item] → Stage [N]
- [Item] → Stage [N]
```

### Individual Phase File Format

Each `NN-phase-[name].md` file:

```markdown
# Phase [N]: [Name]

**Stage:** [Stage name]
**Depends on:** [Phase N-1 or "Nothing (first phase)"]
**Done when:** [Concrete validation criteria]

## What You Build

[Specific deliverables — not vague goals]

## Tasks

- /ship [task description]
- /ship [task description]

## Notes

[Any additional context, gotchas, or decisions relevant to this phase]
```

### Writing the Files

1. Create the `plan/` directory if it doesn't exist
2. Write `00-overview.md` first
3. Write each phase file in order
4. Report the full list of created files to the user when done

## Phase 7: Iterate on Each Phase

After writing all files, walk the user through each phase one at a time for review and refinement.

### Iteration Loop

For each phase file (in order, starting with Phase 1):

1. **Present the phase** — Read the phase file and present a summary to the user
2. **Ask for feedback** — Use `AskUserQuestion` with these options:
   - **"Looks good"** — Phase is approved, move to the next
   - **"Needs changes"** — User wants to refine this phase
   - **"Split this phase"** — Phase is too big, break it into smaller phases
   - **"Merge with next"** — Phase is too small, combine with the following phase
3. **Apply feedback** — If changes are requested, update the phase file and re-present
4. **Repeat** until the user approves, then move to the next phase

### When Splitting or Merging

- **Split:** Create new numbered files and renumber all subsequent phases. Update `00-overview.md`.
- **Merge:** Combine the two phase files into one, delete the extra, renumber subsequent phases. Update `00-overview.md`.
- Always keep file numbering sequential with no gaps.

### Completion

Once all phases are approved:
1. Update `00-overview.md` with the final phase list
2. Report: total phases, total `/ship` tasks, and the recommended starting command (the first `/ship` task from Phase 1)
3. Remind the user: "Run `/phase-review` after completing each phase to validate before moving on."

## Principles

1. **Prove the core experience first.** Everything else is decoration until the fundamental loop works.
2. **One new capability per phase.** If it breaks, you know exactly what broke.
3. **Validate from the user's perspective.** Not "the function returns the right value" but "I texted the number and got the right response."
4. **Defer everything you can.** Databases, websites, payments, error handling — none of these matter until the core works.
5. **Local before cloud.** Build on your machine first. Deploy to production second. The same code should run in both places.
6. **Container-first development.** If your local environment matches production (Docker), the deploy phase is a config change, not a rewrite.
7. **Each phase is a demo.** At the end of every phase, you should be able to show someone what you built and they can see it working.
