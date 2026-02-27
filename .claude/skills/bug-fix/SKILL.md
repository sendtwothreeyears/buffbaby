---
name: bug-fix
description: >
  Fix bugs from a code review or bug report. Takes a review file (with numbered P1/P2/P3 findings)
  or a bug description, lets you select which findings to fix and in what order, then works through
  each with a diagnose→fix→verify loop. Commits fixes incrementally.
argument-hint: "<review file path, bug description, or 'resume'>"
---

# Bug Fix

Work through a list of bugs systematically: diagnose the root cause, fix it, verify no regressions, commit, next.

## When to Use

- After `/code-review` or `/code-review-critical` produces a findings list
- After `/workflow:ship` Phase 3 identifies issues to fix
- When a bug is reported (GitHub issue, user report, test failure)
- When you have a list of things to fix and want structured execution

## Phase 0: Parse Input

### If input is a review file path

Read the file and extract all numbered findings. Parse each for:
- **Number** — the finding's index in the list
- **Severity** — P1/P2/P3 (or Blocker/Important/Potential from critical reviews)
- **Location** — `file:line` reference
- **Problem** — what's wrong
- **Validation status** — ✅/❌/❓/⬇️ if present (skip ❌ findings automatically)

Present a summary:

```
Found 11 findings in CR-feat-auth-20260226.md:
  P1 (CRITICAL):    #1, #4, #7
  P2 (IMPORTANT):   #2, #5, #8, #10
  P3 (NICE-TO-HAVE): #3, #6, #9, #11
```

### If input is a bug description

Create a single-item work list from the description. Skip to Phase 2.

### If input is 'resume'

Check for an in-progress fix session in `notes/BF-*.md`. Read the progress table and continue from the first non-completed finding.

## Phase 1: Select & Order

Use `AskUserQuestion` to ask which findings to fix:

**Question:** "Which findings should I fix? (P1s are recommended first)"

**Options:**
- **All P1s and P2s** — Skip P3s (Recommended)
- **All findings** — Fix everything including P3s
- **P1s only** — Critical fixes only

The user can also respond with custom selection like "1,3,5", "skip 4", "P1 only then 2 and 5", or "reverse order".

Build the **work list** — an ordered sequence of findings to fix.

## Phase 2: Fix Loop

Create a tracking file at `notes/BF-[source]-[YYYYMMDD-HHMM].md`:

```markdown
# Bug Fix Session

**Source:** [review file or bug description]
**Date:** [timestamp]
**Branch:** [current branch]

## Progress

| # | Severity | Finding | Status | Commit |
|---|----------|---------|--------|--------|
| 1 | P1 | [short description] | pending | — |
| 4 | P1 | [short description] | pending | — |
| 2 | P2 | [short description] | pending | — |
```

For each finding in the work list:

### 2a. Diagnose

1. **Read the code** at the referenced location (`file:line`)
2. **Understand the context** — read surrounding code, callers, tests
3. **Identify root cause** — is the finding's diagnosis correct? Sometimes the review spots a symptom but the root cause is elsewhere
4. **Check `docs/solutions/`** for known patterns related to this bug
5. **Assess blast radius** — what else could break if you change this?

If the finding turns out to be a false positive on closer inspection, mark it `skipped (false positive)` in the progress table and move on.

### 2b. Fix

1. **Make the minimal fix** that addresses the root cause
2. **Follow existing patterns** — grep for how similar issues are handled elsewhere in the codebase
3. **Don't fix adjacent code** — only fix the specific finding. Resist the urge to refactor while you're in there.

### 2c. Verify

1. **Re-read the fix** — does it actually address the finding?
2. **Check for regressions** — did the fix break anything obvious?
3. **Run quality checks** if available:
   ```bash
   npm run type-check 2>/dev/null
   npm run lint 2>/dev/null
   npm test 2>/dev/null
   ```
4. **Syntax check** the modified file(s) at minimum: `node -c <file>`

### 2d. Commit

If the fix is confirmed good:

```bash
git add <specific files>
git commit -m "$(cat <<'EOF'
fix: [description of what was fixed]

Addresses finding #[N] from [review source]

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

Update the progress table: status → `fixed`, commit hash filled in.

### 2e. Next

Move to the next finding. If multiple findings touch the same file, consider batching them into one commit with a combined message.

## Phase 3: Report

After all findings are processed, update the tracking file with a summary and present:

```
═══════════════════════════════════════════════
BUG FIX SESSION COMPLETE
═══════════════════════════════════════════════

Source: [review file or description]

Fixed:          [N] findings
Skipped:        [N] (false positives or deferred)
Commits:        [N]

Remaining unfixed:
  #6 (P3) — [reason skipped]
  #9 (P3) — [reason skipped]
═══════════════════════════════════════════════
```

If any P1 or P2 findings were skipped or couldn't be fixed, flag them prominently.

## Principles

1. **One finding at a time.** Don't try to fix everything at once. The loop exists for a reason.
2. **Diagnose before fixing.** The review might be wrong about the cause. Read the code first.
3. **Minimal fixes.** Don't refactor. Don't improve. Just fix the finding.
4. **Commit incrementally.** Each fix (or small batch of related fixes) gets its own commit.
5. **False positives are fine.** If a finding is wrong, skip it — that's useful signal for the reviewer too.
