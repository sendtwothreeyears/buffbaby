---
name: workflow:phase-review
description: Review a completed phase after implementation. Validates deliverables against the phase plan, checks code quality, and gates progression to the next phase. Use after completing a phase's /ship tasks.
disable-model-invocation: true
---

# Phase Review

Review a completed development phase against its plan. Validate that deliverables are met, code quality is acceptable, and the phase is truly done before moving on.

## Phase 1: Identify the Phase to Review

1. Look for a `docs/plans/phases/` directory in the current working directory
2. If no `docs/plans/phases/` directory exists, ask the user where their phase files are
3. Read `00-overview.md` to understand the full plan context
4. **Auto-detect the current phase:** Scan phase files in order. The first file without a `## Review` section (or with a failed review) is the phase to review.
5. If all phases have passing reviews, tell the user — the plan is complete.
6. Confirm with the user: "Phase [N]: [Name] — ready to review?"

If the user passes a phase number or name as an argument, use that instead of auto-detecting.

## Phase 2: Load the Phase Plan

1. Read the phase file (`NN-phase-[name].md`)
2. Extract:
   - **Validation criteria** — the "Done when" conditions
   - **Deliverables** — what was supposed to be built
   - **Dependencies** — what this phase builds on (confirm those phases passed review)
   - **Tasks** — the workflow tasks that were defined (brainstorm → plan → ship)

If a dependency phase hasn't passed review yet, warn the user: "Phase [dep] hasn't been reviewed yet. Review that first, or continue anyway?"

## Phase 3: Validate Deliverables

Go through each "Done when" criterion and actually verify it. This is not a checkbox exercise — **run the validation.**

### Validation Methods (use whatever fits)

- **Tests:** Run relevant test suites, report pass/fail counts
- **curl/HTTP:** Hit endpoints, verify responses
- **File checks:** Confirm expected files exist with expected content
- **Build check:** Verify the project builds without errors
- **Manual inspection:** Read the code and confirm the described behavior is implemented
- **Screenshots:** If UI work, use simulator/browser tools to capture current state

### For Each Criterion

Record:
- **Criterion:** The exact "done when" text
- **Status:** PASS or FAIL
- **Evidence:** What you checked and what you found
- **Notes:** Any caveats (e.g., "passes but with deprecation warnings")

## Phase 4: Code Quality Review

### 4.0 Check Institutional Knowledge

Surface relevant past solutions before reviewing:

- Read `.claude/subagents/learnings-researcher.md`, then spawn a Task (subagent_type: "general-purpose", model: "haiku") using its contents as the agent prompt. Pass: "Find learnings related to the modules changed in this phase"

Use any matches to inform the review — flag code that repeats previously-documented mistakes or ignores proven patterns.

### 4.1 Review Focus

Review the code changes made during this phase. Focus on:

1. **Correctness** — Does the code actually do what the phase requires?
2. **Future-phase risks** — Will anything here cause problems in later phases? (Check `00-overview.md` for what's coming next)
3. **Missing edge cases** — Obvious failure modes not handled
4. **Tech debt introduced** — Shortcuts taken that should be tracked

**Do NOT review for:**
- Style nitpicks (that's what linters are for)
- Premature optimization
- Things explicitly deferred to later phases

### Finding the Changes

Use git to identify what changed during this phase:
- `git log --oneline` to find the relevant commits
- `git diff` against the commit before the phase started
- If unclear, ask the user which commits belong to this phase

## Phase 5: Write the Review

Update the phase file by appending a `## Review` section at the bottom:

```markdown
## Review

**Status:** PASS | FAIL
**Reviewed:** [date]

### Validation Results

| Criterion | Status | Evidence |
|-----------|--------|----------|
| [Done when text] | PASS/FAIL | [What was checked] |

### Code Quality

[Summary of code review findings — keep it concise]

### Issues Found

- [Issue description and severity]

### Tech Debt

- [Debt item — track for future phases]

### Next Steps

[If PASS: "Phase complete. Next: Phase [N+1] — start with the first task's `/workflow:brainstorm` or `/workflow:plan`"]
[If FAIL: "Fix these items before proceeding: [list]"]
```

## Phase 6: Report to User

### If PASS

1. Update the phase file with the review
2. Tell the user:
   - Phase [N] is complete
   - Summary of what was validated
   - Any tech debt to be aware of
   - The next phase name and its first task (starting with `/workflow:brainstorm` or `/workflow:plan`)
3. If this was the last phase: "All phases complete. The plan is fully implemented."

### If FAIL

1. Update the phase file with the review (status: FAIL)
2. Tell the user:
   - Which validation criteria failed and why
   - What needs to be fixed
   - Suggested approach to fix (brief)
3. Do NOT proceed to the next phase

## Principles

1. **Actually validate, don't just check boxes.** Run the tests. Hit the endpoints. Read the code.
2. **Gate progression honestly.** A phase that mostly works is not done. Either it passes all criteria or it doesn't.
3. **Track tech debt, don't ignore it.** Shortcuts are fine in early phases, but write them down so they don't become surprises later.
4. **Review against the plan, not against perfection.** If the phase plan says "hardcode the config," don't fail it for hardcoding the config.
5. **Keep reviews concise.** The review section should be scannable — tables and bullet points, not essays.
