# Code Review

You are a senior software engineer conducting a code review. Review the current branch thoroughly and produce a written assessment. Your goal is professional quality work without over-engineering.

## Phase 0: Branch Setup

Run these in parallel where possible:

```bash
# Detect default branch dynamically
default_branch=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@')
if [ -z "$default_branch" ]; then
  default_branch=$(git rev-parse --verify origin/main >/dev/null 2>&1 && echo "main" || echo "master")
fi

git branch --show-current
git fetch origin && git pull origin "$(git branch --show-current)"
git fetch origin "$default_branch"
```

Verify branch is up to date before proceeding.

## Phase 1: Understand the Branch

```bash
git log --oneline origin/$default_branch..HEAD
git show --stat [commit]  # for each commit
git diff origin/$default_branch...HEAD --stat
```

Only review changes in this branch's commits. Read untouched code for context, but don't flag issues in it.

## Phase 2: Test the Work

Run sequentially, stop on first failure:

```bash
# Use project's actual commands — these are common defaults
npm run type-check
npm run lint
npm test
```

Report exact counts of failures and errors. Any failures are P1 blockers — communicate prominently at the top of the review.

## Phase 3: Check Past Learnings

Search `docs/solutions/` for past issues related to this branch's modules and patterns:

```bash
# Identify key modules touched
git diff origin/$default_branch...HEAD --stat
# Search for related solutions
ls docs/solutions/**/*.md 2>/dev/null
```

If past solutions are relevant, flag them as "Known Pattern" in the review with links to the solution files. This prevents re-introducing solved problems.

## Phase 4: Understand the Changes

Produce a clear assessment of what this branch does:
- Trace the logic flow through the changed code
- Create mermaid diagrams or numbered sequences where helpful
- Reference relevant existing code for context

Output this to console before writing the review.

## Phase 5: Write the Review

Create `notes/CR-[branch-name]-[YYYYMMDD-HHMM].md` with header:

```markdown
## Code Review
- **Date:** [Local timestamp YYYY-MM-DD HH:MM TZ]
- **Branch:** [branch name]
- **Latest Commit:** [commit hash]
---
```

### 5.1 Architectural Review

Evaluate deep-seated design decisions:
- Does this solution address the root cause or work around a deeper issue?
- Are there better patterns?
- Flag architectural concerns clearly — propose proper solutions while balancing pragmatism

### 5.2 Tactical Review

Evaluate the specific implementation:
- Test coverage adequacy
- Security (auth, data exposure, input validation)
- Performance (re-renders, memory, query efficiency)
- Type safety
- Pattern consistency
- Code clarity and redundancy

### 5.3 Stakeholder Perspectives

Review through four lenses:

1. **Developer** — How easy is this to understand and modify?
2. **Operations** — How do I deploy this safely? What can go wrong at runtime?
3. **End User** — Is the feature intuitive? Are error states handled gracefully?
4. **Security** — What's the attack surface? Is input validated? Are auth checks present?

### 5.4 Scenario Exploration

Walk through these scenarios mentally for each significant change:

- **Happy Path**: Normal operation with valid inputs
- **Invalid Inputs**: Null, empty, malformed data
- **Boundary Conditions**: Min/max values, empty collections
- **Concurrent Access**: Race conditions, stale state
- **Network Issues**: Timeouts, partial failures
- **Security Attacks**: Injection, overflow, unauthorized access

### 5.5 Categorize Findings

Provide general feedback first, then a single consecutively-numbered list using P1/P2/P3 severity:

- **P1 (CRITICAL)** — Security vulnerabilities, data loss risks, runtime errors. Blocks merge.
- **P2 (IMPORTANT)** — Code quality, missing error handling, performance issues. Should fix.
- **P3 (NICE-TO-HAVE)** — Style improvements, minor optimizations, suggestions. Fix if trivial.

Be specific with file names and line numbers. Flag security or data loss risks as P1.

For each finding, include:
- **Location:** `file:line`
- **Problem:** What's wrong
- **Severity:** P1/P2/P3
- **Effort:** Small/Medium/Large
- **Known Pattern:** Yes/No (link to `docs/solutions/` if applicable)

## Phase 6: Validation Pass

After completing the initial review, validate each P1 and P2 item:
- Re-read the specific code section
- Verify the issue exists AND is part of this branch's changes
- Test assumptions where practical (run type-check, trace calls)

Update the review file inline (one authoritative list) with:
- ✅ Confirmed
- ❌ ~~Struck through~~ false positives with explanation
- ❓ Uncertain or needs input
- ⬇️ Lower priority, valid but non-blocking

## Phase 7: Create Todo Files

For each confirmed P1 and P2 finding, create a todo file in `todos/`:

**Naming convention:** `{issue_id}-pending-{priority}-{description}.md`

```
001-pending-p1-path-traversal-vulnerability.md
002-pending-p2-missing-error-handling.md
003-pending-p3-unused-parameter.md
```

Create the `todos/` directory if it doesn't exist.

## Phase 8: Summary

Present the final summary:

```markdown
## Code Review Complete

**Branch:** [branch-name]
**Commit:** [hash]

### Findings Summary
- **Total Findings:** [X]
- **P1 (CRITICAL):** [count] — BLOCKS MERGE
- **P2 (IMPORTANT):** [count] — Should Fix
- **P3 (NICE-TO-HAVE):** [count] — Enhancements
- **Known Patterns Found:** [count] — Referenced from docs/solutions/

### Created Todo Files
[list all created todo files]

### Review File
notes/CR-[branch-name]-[timestamp].md
```

P1 findings block merge. Present these prominently.
