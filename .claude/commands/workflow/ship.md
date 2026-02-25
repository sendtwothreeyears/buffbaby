---
name: workflow:ship
description: >
  Full implementation-to-PR workflow with code review and self-correction.
  Takes a plan document or task description, implements it with incremental commits,
  runs code review, fixes issues, and opens a PR.
argument-hint: "[plan file path or task description]"
---

# Ship

Implement a task from plan through PR with code review and self-correction.

## When to Use

- **End-to-end workflow**: Implement a feature from plan to open PR (implement → review → fix → PR)
- **After `/workflow:plan`**: Takes a plan document as input and executes it systematically

## Usage

```
/workflow:ship [--worktree] <plan file path or task description>
```

**Flags:**
- `--worktree` — Run in an isolated worktree. Main working directory is untouched.

**Examples:**
- `/workflow:ship docs/plans/2026-02-25-feat-user-auth-plan.md`
- `/workflow:ship --worktree add retry logic to the webhook handler`

---

## Tracking Progress

Use **TaskCreate/TaskUpdate** to track phase progress. At the start of the ship process, create tasks for all phases. Mark each `in_progress` when starting and `completed` when done.

### Metadata File

Create a simple metadata file at `notes/ship-{identifier}.md`:

```markdown
# Ship: {identifier}

Branch: {branch-name}
PR: #{number} {url}

## Artifacts
- Review: {file path}
- Fix Commit: {hash}

## Issues Found
- [P1] {description} - Fixed in {hash}
- [P2] {description} - Deferred
```

### After Context Compaction

If context is compacted:
1. Check task list — incomplete tasks show where you are
2. Read the metadata file for artifact references
3. Continue from the first non-completed phase

---

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              /ship Flow                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Phase 0: Understand & Setup                                                │
│     ├─► Read plan document or task description                              │
│     ├─► Ask clarifying questions if needed                                  │
│     ├─► Branch setup (standard or worktree)                                 │
│     └─► Break plan into tasks                                               │
│                                                                             │
│  Phase 1: Implement                                                         │
│     ├─► Task execution loop (read → implement → test → commit)              │
│     ├─► Incremental commits at logical boundaries                           │
│     └─► Update plan checkboxes as tasks complete                            │
│                                                                             │
│  Phase 2: Quality Check                                                     │
│     └─► Run type-check, lint, tests — fix any failures                      │
│                                                                             │
│  Phase 3: Code Review                                                       │
│     ├─► Self-review using code_review criteria                              │
│     ├─► Validate each finding                                               │
│     └─► Fix confirmed issues                                                │
│                                                                             │
│  Phase 4: Ship                                                              │
│     ├─► Sync with target branch, push                                       │
│     └─► Create PR via gh                                                    │
│                                                                             │
│  Phase 5: Post-Ship Review                                                  │
│     ├─► Sanity check on full PR diff                                        │
│     └─► Fix issues (higher threshold)                                       │
│                                                                             │
│  Phase 6: Wrap Up                                                           │
│     ├─► Summary report with deferred items                                  │
│     ├─► Update plan status to completed                                     │
│     └─► Worktree cleanup (if --worktree)                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 0: Understand & Setup

### 0.1 Initialize

1. **Determine identifier** from `$ARGUMENTS` — derive from the plan filename or task (e.g., `user-auth`, `webhook-retry`)
2. **Create tasks** for all phases using TaskCreate
3. **Create metadata file** at `notes/ship-{identifier}.md`

### 0.2 Read and Understand the Task

1. **Read the input** — if `$ARGUMENTS` is a file path, read the plan document completely. If it's a task description, use it directly.
2. **Review references** — read any files, blueprints, or docs linked in the plan
3. **Identify unknowns** — what's ambiguous, underspecified, or could go multiple ways?
4. **Ask clarifying questions** — use `AskUserQuestion` to resolve unknowns

**Rules:**
- Ask as many questions as necessary — no limit
- Don't ask obvious questions — use judgment for straightforward decisions
- If the plan is crystal clear, skip to branch setup

### 0.3 Branch Setup

Detect the default branch dynamically:

```bash
default_branch=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@')
if [ -z "$default_branch" ]; then
  default_branch=$(git rev-parse --verify origin/main >/dev/null 2>&1 && echo "main" || echo "master")
fi
```

Check if `--worktree` flag is present. If yes, follow **Worktree Mode**. Otherwise, follow **Standard Mode**.

#### Standard Mode

```bash
current_branch=$(git branch --show-current)
```

**If already on a feature branch** (not the default branch):
- Ask: "Continue working on `[current_branch]`, or create a new branch?"

**If on the default branch:**
```bash
git fetch origin "$default_branch"
git pull origin "$default_branch"
git checkout -b <branch-name>
```

Never commit directly to the default branch without explicit user permission.

#### Worktree Mode

Create an isolated worktree from the default branch. The main working directory is NEVER modified.

```bash
WORKTREE_BASE="$(git rev-parse --show-toplevel)/../.worktrees"
BRANCH_NAME="<branch-name>"
WORKTREE_PATH="$WORKTREE_BASE/$BRANCH_NAME"

git fetch origin "$default_branch"
mkdir -p "$WORKTREE_BASE"
git worktree add "$WORKTREE_PATH" -b "$BRANCH_NAME" "origin/$default_branch"

cd "$WORKTREE_PATH"
git submodule update --init --recursive
npm install  # or project-appropriate install command
```

**If worktree or branch already exists:** Ask user whether to reuse, recreate, or abort.

**CRITICAL: All subsequent file operations must use `$WORKTREE_PATH` as the root.**

### 0.4 Break Plan into Tasks

Use TaskCreate to break the plan into actionable tasks:
- Include dependencies between tasks
- Prioritize based on what needs to be done first
- Include testing tasks
- Keep tasks specific and completable

---

## Phase 1: Implement

### 1.1 Task Execution Loop

For each task in priority order:

```
while (tasks remain):
  - Mark task as in_progress
  - Read any referenced files from the plan
  - Look for similar patterns in codebase
  - Implement following existing conventions
  - Write tests for new functionality
  - Run tests after changes
  - Mark task as completed
  - Mark off the corresponding checkbox in the plan file ([ ] → [x])
  - Evaluate for incremental commit (see below)
```

**IMPORTANT**: Always update the original plan document by checking off completed items. Use the Edit tool to change `- [ ]` to `- [x]` for each task you finish.

### 1.2 Incremental Commits

After completing each task, evaluate whether to commit:

| Commit when... | Don't commit when... |
|----------------|---------------------|
| Logical unit complete (model, service, component) | Small part of a larger unit |
| Tests pass + meaningful progress | Tests failing |
| About to switch contexts (backend → frontend) | Purely scaffolding with no behavior |
| About to attempt risky/uncertain changes | Would need a "WIP" commit message |

**Heuristic:** "Can I write a commit message that describes a complete, valuable change? If yes, commit. If the message would be 'WIP' or 'partial X', wait."

```bash
# Stage only files related to this logical unit
git add <specific files>
git commit -m "$(cat <<'EOF'
feat(scope): description of this unit

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

### 1.3 Follow Existing Patterns

- Read referenced code from the plan first
- Match naming conventions exactly
- Reuse existing components where possible
- Follow project coding standards (see CLAUDE.md)
- When in doubt, grep for similar implementations

### 1.4 Test Continuously

- Run relevant tests after each significant change
- Don't wait until the end to test
- Fix failures immediately
- Add new tests for new functionality

---

## Phase 2: Quality Check

Run the full quality suite before proceeding to review:

```bash
# Use project's actual commands — these are common defaults
npm run type-check    # or equivalent
npm run lint          # or equivalent
npm test              # or equivalent
```

Fix any failures. Re-run until all pass.

**Checklist:**
- All tasks marked completed
- All tests pass
- Linting passes
- Code follows existing patterns

---

## Phase 3: Code Review

### 3.1 Self-Review

Review your own changes using the criteria from `code_review.md`:

1. **Get the diff:**
   ```bash
   git diff origin/$default_branch...HEAD
   ```

2. **Conduct the review** following `code_review.md` criteria:
   - **Architectural**: Does the solution address the root cause? Are there better patterns?
   - **Tactical**: Test coverage, security, performance, type safety, pattern consistency, clarity
   - **Stakeholder perspectives**: Developer (maintainable?), Operations (deployable?), End User (intuitive?), Security (attack surface?)

3. **Categorize findings** using P1/P2/P3 severity:
   - **P1 (CRITICAL)**: Security vulnerabilities, data loss risks, runtime errors — must fix
   - **P2 (IMPORTANT)**: Code quality, missing error handling, performance — should fix
   - **P3 (NICE-TO-HAVE)**: Style improvements, minor optimizations — fix if trivial

4. **Write the review** to `notes/ship-review-{identifier}.md`

### 3.2 Validate Findings

For each P1 and P2 finding:
1. Re-read the specific code
2. Verify the issue exists and is part of this branch's changes
3. Mark each: ✅ Confirmed / ❌ False Positive / ❓ Uncertain

### 3.3 Fix Confirmed Issues

- **P1 (✅):** Always fix — no exceptions
- **P2 (✅):** Fix unless clearly wrong or inapplicable
- **P3 (✅):** Fix only if trivial
- **❓ Uncertain:** Ask user before fixing

After fixes:
```bash
npm run type-check && npm run lint && npm test
```

Commit fixes:
```bash
git add <fixed files>
git commit -m "$(cat <<'EOF'
fix: address code review feedback

- [List each fix applied]

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4: Ship

### 4.1 Sync and Push

```bash
git fetch origin "$default_branch"
git merge "origin/$default_branch"
# Resolve conflicts if any
git push -u origin HEAD
```

### 4.2 Create PR

```bash
gh pr create --title "<type>(scope): description" --body "$(cat <<'EOF'
## Summary
- {what this PR does, 2-3 bullets}

## Test Plan
- [x] Type check passes
- [x] Lint passes
- [x] Unit tests pass
- [ ] {Manual verification steps if applicable}

## Review Notes
{Any deferred items or known limitations}

🤖 Generated with Claude Code
EOF
)"
```

Output the PR URL. Update metadata file with PR number and URL.

---

## Phase 5: Post-Ship Review

A final sanity check on the complete PR diff. This catches anything missed during implementation.

### 5.1 Review Full Diff

```bash
git diff origin/$default_branch...HEAD
```

Review the entire diff with fresh eyes, focusing on:
- Anything that looks obviously wrong
- Security concerns
- Breaking changes that might have been missed
- Logic errors
- Inconsistencies between files

### 5.2 Fix Issues (Higher Threshold)

Only fix issues that meet a higher bar:
- **P1 (✅):** Always fix
- **P2 (✅):** Fix only if clearly correct and low-risk
- **P3:** Skip

If fixes are made:
```bash
git add <fixed files>
git commit -m "$(cat <<'EOF'
fix: post-review corrections

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
git push
```

Re-run quality checks after any fixes.

---

## Phase 6: Wrap Up

### 6.1 Summary Report

```
═══════════════════════════════════════════════════════════════
SHIP COMPLETE
═══════════════════════════════════════════════════════════════

PR: {url}

## Summary
{1-2 sentence description of what was implemented}

## Implementation
- Files created: {list}
- Files modified: {list}
- Commits: {count}

## Code Review
- Issues found: {P1: X, P2: Y, P3: Z}
- Issues fixed: {number}
- Issues deferred: {number}

## Quality
- Type-check: ✅ Pass
- Lint: ✅ Pass
- Tests: ✅ {X} passed, {Y} skipped, {Z} failed

═══════════════════════════════════════════════════════════════
```

### 6.2 Deferred Items

If any review items were deferred, list them and offer to generate a follow-up prompt:

```
Would you like me to write a follow-up prompt to address these {N} deferred item(s)?
```

If yes, write to `notes/follow-up-{branch-name}.md`.

### 6.3 Update Plan Status

If the input document has YAML frontmatter with a `status` field:
```
status: active  →  status: completed
```

### 6.4 Cleanup

**If --worktree was used:** Ask whether to remove the worktree or keep it.

```bash
# Only after user confirms
git worktree remove "$WORKTREE_PATH" --force
```

Mark all tasks complete. Delete or archive metadata file.

---

## Failure Handling

- **Plan unclear:** Ask for clarification using `AskUserQuestion` before proceeding
- **Tests fail repeatedly:** Summarize attempts and ask for help
- **Uncertain review items (❓):** Ask user for guidance before fixing
- **Merge conflicts:** Resolve them, or ask for help if complex
- **Context compaction:** Check task list FIRST to find where you are. Read metadata file for artifacts. Continue from the first incomplete phase. NEVER skip phases.

---

## Key Principles

- **The plan is your guide** — read referenced code, follow existing patterns, don't reinvent
- **Test as you go** — run tests after each change, not at the end
- **Incremental commits** — commit at logical boundaries, not at the end
- **Ship complete features** — don't leave features 80% done
- **No over-engineering** — do what's asked, nothing more

---

Now begin. Ship it.
