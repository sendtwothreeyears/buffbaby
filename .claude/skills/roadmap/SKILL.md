---
name: roadmap
description: Capture a future plan, feature idea, or deferred work item into docs/future-plans/. Use when discussing something that should be built later but not now — after MVP, next phase, or when a dependency matures.
argument-hint: "<topic description>"
---

# Roadmap — Capture Future Plans

Write a structured future plan document to `docs/future-plans/` for ideas, features, and deferred work that should be revisited after the current phase or MVP.

## When to Use

- User says "add this to future plans" or "we'll do this later"
- A feature idea emerges during conversation that's out of scope for now
- Work is explicitly deferred from the current phase
- A dependency isn't ready yet but the plan should be captured
- User wants to record a strategic direction for the product

## Phase 1: Understand What to Capture

From the conversation, extract:

1. **What** — the feature, enhancement, or architectural change
2. **Why** — the motivation, user need, or competitive pressure
3. **Why not now** — what makes this a future item (out of scope, dependency not ready, MVP first)
4. **When to revisit** — trigger conditions (after MVP, when X matures, Phase N)
5. **Key decisions** — tradeoffs, options, or open questions to resolve later

Summarize what you plan to capture and confirm with the user.

## Phase 2: Write the Document

### File naming

`docs/future-plans/<slug>.md`

Slug format: lowercase, hyphens, descriptive. Examples:
- `multi-channel-expansion.md`
- `sprites-migration.md`
- `team-collaboration.md`

### Document structure

Follow the existing pattern in `docs/future-plans/`:

```markdown
# Future Plan: <Title>

**Created:** <date>
**Status:** Deferred — <reason>
**Depends on:** <what must happen first>

## Why

<Motivation — why this matters, what problem it solves>

## What

<Description of the feature/change>

## Why Not Now

<Why this is deferred — what's blocking or why it's out of scope>

## Key Decisions

<Tradeoffs, options, open questions to resolve when this is picked up>

## When to Revisit

<Trigger conditions — what must be true before starting this work>

## Research Sources

<Links to relevant docs, articles, discussions>
```

### Guidelines

- **Be concrete.** Include enough detail that a future session can pick this up without re-researching.
- **Include tradeoffs.** If there are multiple approaches, list them with pros/cons.
- **Link to research.** If the conversation included web searches or doc reading, include the sources.
- **Match existing style.** Read existing files in `docs/future-plans/` and match their tone and depth.
- **Don't over-specify.** This is a plan, not a PRD. Capture the direction and key decisions, not every implementation detail.

## Phase 3: Verify

1. Write the file
2. Show the user what was captured
3. Confirm accuracy

## Edge Cases

**Multiple future plans in one conversation:** Create separate files for each. Don't combine unrelated plans into one doc.

**Plan already exists:** Check `docs/future-plans/` first. If a related doc exists, update it rather than creating a duplicate.

**Plan is too small for its own file:** If it's a single paragraph, consider adding it to an existing related future plan doc or to `docs/future-plans/post-deploy-enhancements.md` as a new section.
