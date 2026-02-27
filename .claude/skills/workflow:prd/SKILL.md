---
name: workflow:prd
description: Create a comprehensive Product Requirements Document through dialogue-driven exploration. Use when starting a new product or feature that needs a full PRD before implementation.
argument-hint: "[product idea or problem to solve]"
disable-model-invocation: true
---

# Create a Product Requirements Document (PRD)

**Note: The current year is 2026.** Use this when dating PRD documents.

A PRD defines **WHAT** we're building and **WHY**. It precedes brainstorming and planning — it's the foundation document that everything else builds on.

## Product Idea

<product_idea> #$ARGUMENTS </product_idea>

**If the product idea above is empty, ask the user:** "What product or feature would you like to define? Describe the idea, problem, or opportunity you're thinking about."

Do not proceed until you have a product idea from the user.

## Execution Flow

### Phase 0: Assess Scope

Evaluate whether a full PRD is needed or something lighter.

**Full PRD indicators:**
- New product or major feature
- Multiple user types or complex user flows
- Infrastructure, architecture, or platform decisions needed
- Business model or pricing considerations
- Multi-phase rollout planned

**If a full PRD seems overkill:**
Use **AskUserQuestion tool** to suggest: "This might be small enough for `/workflow:brainstorm` or `/workflow:plan` instead. Should I proceed with a full PRD, or would a lighter approach work?"

### Phase 1: Deep Discovery (Dialogue-Driven)

Explore the product idea through collaborative dialogue using **AskUserQuestion tool**. Ask questions **one at a time**. Go deep — a PRD is a foundation document, so thoroughness matters here.

#### 1.1 Problem & Motivation

Understand the problem before the solution:

- **Who** is affected? (specific user profiles, not vague personas)
- **What** do they struggle with today? (current pain points, failed workarounds)
- **Why now?** What's changed that makes this timely? (market shifts, new tech, competitive pressure)
- **What evidence** supports this? (data, quotes, research, competing products)

#### 1.2 Vision & Positioning

Understand the product's identity:

- What's the **core differentiator**? Why will this win over alternatives?
- What is this product **NOT**? (anti-goals are as important as goals)
- What's the **one-sentence pitch**?
- What's the **delivery model**? (SaaS, self-hosted, native app, CLI tool, etc.)

#### 1.3 Users & Use Cases

Understand who uses this and how:

- **Primary user** — who benefits most? What's their day-to-day like?
- **Secondary users** — who else interacts with the product?
- **Key workflows** — walk through 3-5 concrete user flows end-to-end
- **Edge cases** — what happens when things go wrong?

#### 1.4 Scope & Priorities

Draw boundaries:

- **P0 (must-have)** — what's required for launch?
- **P1 (important)** — what makes it polished?
- **P2 (nice-to-have)** — what comes later?
- **Out of scope** — what are we explicitly NOT building?

#### 1.5 Technical Shape

Understand the technical landscape (high-level, not implementation details):

- What's the **architecture** at a high level? (components, data flow)
- What are the **key integrations**? (APIs, services, platforms)
- What are the **hard constraints**? (platform limits, compliance, cost)
- What are the **technical risks**?

#### 1.6 Business & Growth

Understand the business side:

- **How will this make money?** (or save money, or grow users)
- **What does success look like?** (metrics, targets, timelines)
- **What's the rollout strategy?** (phases, beta, graduation criteria)
- **What's the cost model?** (infrastructure, per-user, development)

**Exit condition:** Continue asking questions until you have enough material for every PRD section, OR user says "proceed" or "that's enough."

### Phase 2: Competitive Research

Run research to understand the competitive landscape:

- **Web search** for competing products, alternatives, and market context
- Look for recent launches, pricing models, and user reviews
- Identify gaps in the market that this product fills

Use **WebSearch** for up to 3-5 targeted searches. Focus on:
1. Direct competitors (products solving the same problem)
2. Adjacent products (products solving related problems differently)
3. Market context (trends, recent launches, user demand signals)

Summarize findings briefly for the user before proceeding.

### Phase 3: Draft the PRD

Write the PRD to `docs/PRD_<PRODUCT_NAME>.md` using UPPER_SNAKE_CASE for the product name portion.

**Example filenames:**
- `docs/PRD_WHATSAPP_AGENTIC_COCKPIT.md`
- `docs/PRD_MOBILE_EXPENSE_TRACKER.md`
- `docs/PRD_API_GATEWAY.md`

Ensure `docs/` directory exists before writing.

#### PRD Structure

Use this structure. Every section should be filled in based on the dialogue. Sections can be trimmed if genuinely not applicable, but default to including them.

```markdown
# PRD: [Product Name]

**Author:** [Developer name from git config user.name]
**Date:** [Today's date]
**Status:** Draft
**Last Updated:** [Today's date]
**Model:** [One-line description of the delivery model]

---

## Problem Statement

_[2-3 paragraph narrative describing the problem, who has it, and why existing solutions fall short. Write in italics for emphasis — this is the emotional hook.]_

**Who** is affected:
[Specific user description]

**What** they struggle with:
- [Pain point 1]
- [Pain point 2]
- [Pain point 3]

**Why now** (urgency/opportunity):
- [Reason 1]
- [Reason 2]

**Evidence** (data, quotes, research):
- [Evidence 1]
- [Evidence 2]

---

## Core Differentiator

[What makes this product fundamentally different from alternatives. Not a feature list — the strategic positioning. Why does this approach win?]

[Optional: comparison table showing what competitors require vs. what this product requires]

---

## Goals & Success Metrics

| Goal | Metric | Target |
|------|--------|--------|
| [Goal 1] | [How to measure] | [Target value] |
| [Goal 2] | [How to measure] | [Target value] |

**Anti-goals** (what we are NOT optimizing for):
- [Anti-goal 1]
- [Anti-goal 2]

---

## Target Users

**Primary user:**
- Description: [Who they are, what they do]
- Key needs: [What they need from this product]
- Current workaround: [How they solve this today]

**Secondary user:**
- Description: [Who they are]
- Key needs: [What they need]

---

## Scope

### In Scope (Requirements)

**P0 — Must have (launch blockers):**
- [ ] [Requirement 1]
- [ ] [Requirement 2]

**P1 — Important (needed for polished experience):**
- [ ] [Requirement 1]

**P2 — Nice to have (future):**
- [ ] [Requirement 1]

### Out of Scope (Non-Goals)
- [Explicit non-goal 1]
- [Explicit non-goal 2]

---

## User Flows

[3-5 detailed user flows showing step-by-step interactions. Number each step. Include system responses.]

**Flow 1: [Name]**
1. [Step]
2. [Step]

**Edge cases to handle:**
- [Edge case 1]
- [Edge case 2]

---

## Technical Considerations

- **Performance:** [Latency, throughput, responsiveness targets]
- **Security:** [Auth, encryption, data protection]
- **Scalability:** [How it grows with users/load]
- **Integrations:** [External services, APIs, platforms]
- **Reliability:** [Uptime, recovery, data durability]
- **[Platform]-specific constraints:** [Any platform limits]

---

## Architecture Overview

[ASCII diagram showing major components and data flow]

[Narrative explaining the architecture: what each component does, how they connect, why this design is simple/appropriate]

[Include: local development setup, production setup, and the migration path between them if applicable]

---

## Assumptions & Constraints

**Assumptions** (things we believe but haven't validated):
- [Assumption 1]

**Constraints** (hard limits):
- [Constraint 1]

**Dependencies:**
- [Dependency 1]

---

## Open Questions & Risks

| Question / Risk | Owner | Status | Resolution |
|-----------------|-------|--------|------------|
| [Question 1] | [Name] | Open | [Notes] |

---

## Timeline & Milestones

### Phase A: [Name]

| Milestone | Target Date | Notes |
|-----------|-------------|-------|
| [Milestone 1] | TBD | [Notes] |

---

## Rollout Strategy

- **Rollout approach:** [Phased description]
- **Graduation criteria:** [What must be true to proceed]
- **Rollback plan:** [How to undo if needed]

---

## Cost Model

### Development Cost
| Component | Cost | Notes |
|-----------|------|-------|
| [Component] | [Cost] | [Notes] |

### Production Cost (Per User)
| Component | Cost | Notes |
|-----------|------|-------|
| [Component] | [Cost] | [Notes] |

### Pricing Model
| Tier | Price | Includes |
|------|-------|----------|
| [Tier] | [Price] | [What's included] |

---

## Learning & Growth

**New technology/skills being implemented:**
- [Tech/skill 1]

**How this stretches beyond current abilities:**
- [Stretch 1]

**What excites me most:**
- [Excitement 1]

---

## Appendix

### Competitive Landscape
- [Competitor 1 + link] — [one-line description]

### Research
- [Research source 1]

### Technical References
- [Reference 1]
```

#### Writing Guidelines

- **Be specific, not generic.** Real numbers, real product names, real constraints. A PRD that says "fast performance" is useless. A PRD that says "text responses within 5 seconds, media within 10 seconds" is actionable.
- **Problem Statement should be compelling.** Write it as a narrative that makes someone care about the problem. Use italics for the hook paragraphs.
- **User Flows are the heart of the PRD.** Walk through 3-5 real interactions step-by-step, including system responses and error cases. These flows should make the product tangible.
- **Anti-goals are critical.** Explicitly stating what you're NOT building prevents scope creep and misaligned expectations.
- **Architecture should be visual.** Use ASCII diagrams. Show the data flow. Show what the user owns vs. what the service owns.
- **Cost Model should be honest.** Include development costs, per-user costs, and a pricing model. Show the unit economics.
- **Open Questions are a feature, not a bug.** A good PRD acknowledges what it doesn't know. Open questions with owners and statuses show the document is alive.

### Phase 4: Review & Handoff

After writing the PRD, use **AskUserQuestion tool** to present next steps:

**Question:** "PRD drafted at `docs/PRD_<NAME>.md`. What would you like to do next?"

**Options:**

1. **Open in editor** — Open the PRD for review (`open docs/PRD_<NAME>.md`)
2. **Review and refine** — Improve through structured self-review (loads `document-review` skill)
3. **Split into phases** — Run `/phase-prd` to break the PRD into sequenced development phases
4. **Done for now** — Return later

**If user selects "Review and refine":**
Load the `document-review` skill and apply it to the PRD. When review returns, present options again.

**If user selects "Split into phases":**
Call `/phase-prd` with the PRD file path.

## Output Summary

When complete, display:

```
PRD complete!

Document: docs/PRD_<PRODUCT_NAME>.md

Key sections:
- Problem: [one-line summary]
- Users: [primary user type]
- Scope: [X] P0 requirements, [Y] P1, [Z] P2
- Architecture: [one-line summary]
- Open questions: [N] unresolved

Next: Run `/workflow:brainstorm` or `/phase-prd` to start breaking this down.
```

## Important Guidelines

- **Go deep in dialogue.** A PRD is the foundation — shallow questions produce shallow documents. Ask follow-ups.
- **Use the user's voice.** Capture their excitement, their specific language, their vision. Don't genericize.
- **Be opinionated.** If something doesn't make sense or has a gap, say so. Push back like a senior PM.
- **Include real numbers.** Costs, latency targets, user counts, pricing — specificity makes a PRD useful.
- **ASCII diagrams over words.** Architecture is always clearer as a visual.
- **The Learning & Growth section is personal.** Let the author reflect on what they're learning and what excites them.

NEVER CODE! Just explore and document the product definition.
