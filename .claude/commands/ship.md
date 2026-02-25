---
name: ship
description: >
  Full implementation-to-PR workflow with dual-agent code review, consolidation, and self-correction.
  Use to implement features/fixes end-to-end, OR reference specific phases (e.g., Phase 3 dual-agent
  review, Phase 7 PR format) from other workflows. Phases are designed to be composable.
---

# Ship

Implement a task from prompt through PR with dual-agent code review, consolidation, and self-correction.

## When to Use

- **End-to-end workflow**: Implement a feature from Linear ticket to open PR (implement → review → fix → PR)
- **Reference**: Other agents can reference specific phases as examples for their own workflows

## Usage

```
/ship [--worktree] <implementation prompt or task description>
```

**Flags:**
- `--worktree` — Run in an isolated worktree. Main working directory is untouched. Recommended when you have WIP or want guaranteed isolation.

**Examples:**
- `/ship implement the permission flow update from notes/push-notification-permission-flow-update-prompt.md`
- `/ship --worktree add user authentication to the API`

---

## Tracking Progress

### Phase Tracking with TodoWrite

Use **TodoWrite** to track phase progress. At the start of the ship process, create todos for all phases:

```
TodoWrite([
  { content: "Phase 0: Understand & Clarify", status: "in_progress", activeForm: "Understanding task" },
  { content: "Phase 1: Branch Setup & Implementation", status: "pending", activeForm: "Implementing" },
  { content: "Phase 2: Commit", status: "pending", activeForm: "Committing changes" },
  { content: "Phase 3: First Round Review", status: "pending", activeForm: "Running first round review" },
  { content: "Phase 4: Consolidate First Round", status: "pending", activeForm: "Consolidating review feedback" },
  { content: "Phase 5: Validate Issues", status: "pending", activeForm: "Validating issues" },
  { content: "Phase 6: Parallel Fixes", status: "pending", activeForm: "Fixing issues" },
  { content: "Phase 7: Open PR", status: "pending", activeForm: "Opening PR" },
  { content: "Phase 8: Post-PR Summary", status: "pending", activeForm: "Summarizing PR status" },
  { content: "Phase 9: Second Round Review", status: "pending", activeForm: "Running second round review" },
  { content: "Phase 10: Second Round Summary", status: "pending", activeForm: "Summarizing second round" },
  { content: "Phase 11: Cleanup", status: "pending", activeForm: "Cleaning up" }
])
```

**Update TodoWrite as you progress:**
- Mark current phase `in_progress` when starting
- Mark phase `completed` when done
- Only one phase should be `in_progress` at a time

### Metadata File

Create a simple metadata file for artifacts at `notes/ship-{identifier}.md`:

```markdown
# Ship: {identifier}

Branch: {branch-name}
PR: #{number} {url}

## Artifacts
- Initial Commit: {hash}
- Claude Review: {file path}
- Codex Review: {file path}
- Fix Commit: {hash}
- Post-Review: {file path}

## Issues Found
- [IMPORTANT] {description} - Fixed in {hash}
- [POTENTIAL] {description} - Deferred
```

This file is for reference only — TodoWrite is the primary progress tracker.

### After Context Compaction

If context is compacted:
1. Check TodoWrite status — the incomplete phases show where you are
2. Read the metadata file if you need artifact references
3. Continue from the first non-completed phase

---

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              /ship Flow                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Phase 0: Understand & Clarify                                              │
│     ├─► Update Linear ticket (In Progress, assign to Atin)                  │
│     ├─► Switch to dev (CRITICAL - before reading any code)                  │
│     └─► Read task, ask clarifying questions if needed                       │
│                                                                             │
│  Phase 1: Branch Setup & Implementation                                     │
│     ├─► Standard: create feature branch (already on dev)                    │
│     └─► Worktree (--worktree): create isolated worktree from dev            │
│            └─► Multi-repo: parallel worktree creation + npm install         │
│                                                                             │
│  Phase 2: Commit                                                            │
│     └─► Stage and commit with conventional format                           │
│                                                                             │
│  Phase 3: First Round Review (async)                                        │
│     ├─► Launch Claude review agent ──┐                                      │
│     └─► Launch Codex review agent ───┴─► Both write to notes/               │
│                                                                             │
│  Phase 4: Consolidate First Round                                           │
│     └─► Merge + deduplicate issues into single list                         │
│                                                                             │
│  Phase 5: Validate Issues                                                   │
│     └─► Main thread marks each: ✅ Confirmed / ❌ False Positive / ❓ Uncertain│
│                                                                             │
│  Phase 6: Parallel Fixes                                                    │
│     └─► Spawn fix agents (bucketed by file to avoid conflicts)              │
│            └─► Revalidate: type-check, lint, test                           │
│                                                                             │
│  Phase 7: Open PR                                                           │
│     └─► Sync with dev, push, create PR via gh                               │
│                                                                             │
│  Phase 8: Post-PR Summary                                                   │
│     └─► Verify no conflicts, all checks pass, output PR status              │
│                                                                             │
│  Phase 9: Second Round Review (async)                                       │
│     ├─► Claude + Codex sanity check on full diff ──┐                        │
│     ├─► Consolidate & validate                     │                        │
│     └─► Fix issues (higher threshold) ─────────────┘                        │
│                                                                             │
│  Phase 10: Second Round Summary                                             │
│     ├─► Output review results                                               │
│     ├─► List all deferred items (from both rounds)                          │
│     ├─► Offer to generate follow-up prompt for deferred work                │
│     └─► Offer to mark Linear ticket as "Ready for Review"                   │
│                                                                             │
│  Phase 11: Cleanup (if --worktree)                                          │
│     └─► Ask user: remove worktree / keep                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 0: Understand & Clarify

### 0.0 Initialize Progress Tracking

1. **Determine identifier:**
   - If `$ARGUMENTS` contains a ticket reference (e.g., AUT-123): use `aut-123`
   - Otherwise, derive from the task (e.g., `add-user-auth`)

2. **Create TodoWrite phases:**
   ```
   TodoWrite([
     { content: "Phase 0: Understand & Clarify", status: "in_progress", activeForm: "Understanding task" },
     { content: "Phase 1: Branch Setup & Implementation", status: "pending", activeForm: "Implementing" },
     { content: "Phase 2: Commit", status: "pending", activeForm: "Committing changes" },
     { content: "Phase 3: First Round Review", status: "pending", activeForm: "Running first round review" },
     { content: "Phase 4: Consolidate First Round", status: "pending", activeForm: "Consolidating review feedback" },
     { content: "Phase 5: Validate Issues", status: "pending", activeForm: "Validating issues" },
     { content: "Phase 6: Parallel Fixes", status: "pending", activeForm: "Fixing issues" },
     { content: "Phase 7: Open PR", status: "pending", activeForm: "Opening PR" },
     { content: "Phase 8: Post-PR Summary", status: "pending", activeForm: "Summarizing PR status" },
     { content: "Phase 9: Second Round Review", status: "pending", activeForm: "Running second round review" },
     { content: "Phase 10: Second Round Summary", status: "pending", activeForm: "Summarizing second round" },
     { content: "Phase 11: Cleanup", status: "pending", activeForm: "Cleaning up" }
   ])
   ```

3. **Create metadata file** at `notes/ship-{identifier}.md`:
   ```markdown
   # Ship: {identifier}

   Branch: _(not yet created)_
   PR: _(not yet created)_

   ## Artifacts

   ## Issues Found
   ```

### 0.1 Update Linear Ticket

If the task references a Linear ticket (e.g., AUT-123 in the prompt or branch name):

1. **Mark as In Progress** — update ticket status to "In Progress"
2. **Assign to Atin** — set assignee to Atin

```
Use mcp__linear__update_issue with:
- id: <ticket-id>
- state: "In Progress"
- assignee: "Atin"
```

### 0.2 Switch to Dev (CRITICAL — Standard Mode Only)

**Skip this step entirely if `--worktree` flag is present.** In worktree mode:
- The main working directory must remain untouched (another agent may be working there)
- The worktree will be created directly from `origin/dev` in Phase 1
- This ensures the new feature stands alone, not based on whatever branch happens to be checked out

**For Standard Mode (no --worktree):**

Before reading any code, switch to dev to ensure you're looking at the correct codebase:

```bash
git fetch origin dev
git checkout dev
git pull origin dev
```

If working with multiple repos, do this for ALL repos involved.

**Why this matters:** The session may be on a random branch from previous work. Reading code from the wrong branch leads to incorrect understanding and wasted effort.

### 0.3 Understand the Task

Before writing any code:

1. **Read the task** — read `$ARGUMENTS` and any referenced files thoroughly
2. **Identify unknowns** — what's ambiguous, underspecified, or could go multiple ways?
3. **Ask clarifying questions** — use `AskUserQuestion` tool to resolve unknowns

**Question categories to consider:**
- Scope: "Should this also handle X, or just Y?"
- Approach: "There are two ways to do this: A or B. Which do you prefer?"
- Edge cases: "What should happen when X occurs?"
- Dependencies: "This will require changing Z. Is that acceptable?"
- Testing: "Should I add new tests for this, or just ensure existing tests pass?"
- Priority: "Which of these concerns matters most?"

**Rules:**
- Ask as many questions as necessary — no limit
- Use multiple `AskUserQuestion` calls if needed (each supports up to 4 questions)
- Don't ask obvious questions — use judgment for straightforward decisions
- If the prompt is crystal clear with no ambiguity, skip to Phase 1

---

## Phase 1: Branch Setup & Implementation

### 1.1 Ensure Clean Starting Point

Check if `--worktree` flag is present in `$ARGUMENTS`. If yes, follow **Worktree Mode**. Otherwise, follow **Standard Mode**.

---

#### Standard Mode (no --worktree flag)

Already on dev from Phase 0.2. Create a new branch for this work:

```bash
git checkout -b <branch-name>
```

**Multi-repo work:** If the task spans multiple repositories, create matching branch names in each repo.

---

#### Worktree Mode (--worktree flag present)

Create an isolated worktree to guarantee a clean starting point. **The main working directory is NEVER modified.**

**Why this matters:**
- **Other agents may be working** — The main directory might have another ship operation in progress. Touching it would corrupt their work.
- **You might be on a random branch** — This command could be invoked while the main directory is on `aut-747-some-feature`. You don't want `aut-748` to accidentally include 747's uncommitted changes.
- **Features must stand alone** — Each feature branch should be based on `dev`, not on other in-progress work. This keeps PRs clean and reviewable.

**Key principle:** Worktrees are ALWAYS created from `origin/dev`, regardless of what branch the main directory is on. If you're unsure whether worktree mode is appropriate (e.g., the task explicitly needs to build on another branch), ask the user for clarification.

**Step 1: Determine context and repos involved**

First, detect where we're running from:

```bash
# Check if we're inside a git repo
if git rev-parse --show-toplevel >/dev/null 2>&1; then
    # Inside a repo - parent directory contains sibling repos
    REPOS_PARENT="$(git rev-parse --show-toplevel)/.."
else
    # Not in a repo - assume we're in the parent directory containing repos
    REPOS_PARENT="$(pwd)"
fi

WORKTREE_BASE="$REPOS_PARENT/.worktrees"
```

Then identify which repositories this task requires. Use your knowledge of the codebase structure (from CLAUDE.md) to determine if the task is single-repo or multi-repo (e.g., client + backend). If unclear, ask the user.

**Step 2: Check for collisions**

For each repo involved, check if the worktree or branch already exists:

```bash
BRANCH_NAME="<branch-name>"
REPO_PATH="<path-to-repo>"
REPO_NAME="$(basename "$REPO_PATH")"
WORKTREE_PATH="$WORKTREE_BASE/$BRANCH_NAME/$REPO_NAME"

# Check if worktree path exists
if [ -d "$WORKTREE_PATH" ]; then
    echo "WORKTREE_EXISTS"
fi

# Check if branch exists
if git show-ref --verify --quiet "refs/heads/$BRANCH_NAME"; then
    echo "BRANCH_EXISTS"
fi
```

**If worktree exists:** Ask user via `AskUserQuestion`:
- "Reuse existing worktree" — continue with existing worktree
- "Delete and recreate" — remove old worktree, create fresh
- "Abort" — stop and let user handle manually

**To delete an existing worktree** (when user selects "Delete and recreate"):
```bash
git -C "$REPO_PATH" worktree remove "$WORKTREE_PATH" --force
git -C "$REPO_PATH" branch -D "$BRANCH_NAME" 2>/dev/null || true
```

**⚠️ BEFORE RUNNING:** Stop and verify the paths are correct. This is destructive. Never use raw `rm -rf` on worktrees.

**If branch exists (but no worktree):** Ask user via `AskUserQuestion`:
- "Use existing branch" — create worktree from existing branch
- "Delete and recreate branch" — delete branch, create fresh from dev
- "Abort" — stop and let user handle manually

**To delete an existing branch** (when user selects "Delete and recreate branch"):
```bash
git -C "$REPO_PATH" branch -D "$BRANCH_NAME"
```

**Step 3: Create worktrees from origin/dev (parallel for multi-repo)**

For multi-repo work, create all worktrees in parallel. Use the `WORKTREE_BASE` established in Step 1.

**CRITICAL:** The worktree is created from `origin/dev`, NOT from the current HEAD. This ensures a clean base regardless of what branch the main directory is on.

```bash
# For each repo, run in parallel:
REPO_PATH="<repo-path>"
REPO_NAME="$(basename "$REPO_PATH")"
WORKTREE_PATH="$WORKTREE_BASE/$BRANCH_NAME/$REPO_NAME"

# Fetch latest dev WITHOUT changing the main directory's branch
git -C "$REPO_PATH" fetch origin dev

# Create worktree from origin/dev (not current HEAD)
mkdir -p "$WORKTREE_BASE/$BRANCH_NAME"
git -C "$REPO_PATH" worktree add "$WORKTREE_PATH" -b "$BRANCH_NAME" origin/dev
```

**Note:** Using `git -C "$REPO_PATH"` runs git commands against that repo without changing our current directory or affecting the main working directory's state.

**Step 4: Initialize worktrees (parallel)**

Run these in parallel for each worktree:

```bash
cd "$WORKTREE_PATH"
git submodule update --init --recursive
npm install
```

**Step 5: Set working context**

Store the worktree path(s) for use throughout the ship process:
- `WORKTREE_PATH` — primary repo worktree
- `WORKTREE_PATH_BACKEND` — backend repo worktree (if multi-repo)

**CRITICAL: All subsequent file operations (Read, Edit, Write, Bash) must use `$WORKTREE_PATH` as the root, NOT the main working directory.**

---

### 1.2 Execute the Task

Execute the task described in `$ARGUMENTS`:

1. **Implement** — make the changes, following existing codebase patterns
2. **Validate** — run checks after implementation:
   ```bash
   npm run type-check
   npm run lint
   npm test
   ```
3. Fix any issues before proceeding

**Constraints:**
- No over-engineering — do what's asked, nothing more
- Match existing patterns — consistency over preference
- Keep commits atomic and reviewable

---

**After Phase 1:** Mark "Phase 1" as `completed` in TodoWrite, mark "Phase 2" as `in_progress`. Update metadata file with branch name.

---

## Phase 2: Commit

1. Stage changes: `git add -A`
2. Auto-generate commit message in conventional format:
   ```
   fix|feat|refactor(scope): concise description

   - Key changes as bullet points

   Co-Authored-By: Claude <noreply@anthropic.com>
   ```
3. Commit the changes
4. Update metadata file with commit hash
5. Mark "Phase 2" as `completed`, mark "Phase 3" as `in_progress`

---

## Phase 3: First Round Review (async)

Launch TWO code reviews in parallel using clear agents. Both agents use the same review criteria from `/code_review` to ensure consistency.

After both reviews complete, update metadata file with review file paths.

### 3.1 Generate Review Prompt Files

First, create prompt files for both agents. This avoids shell escaping issues and ensures both agents get identical instructions.

```bash
# Generate timestamp and paths
REVIEW_TS=$(date +%Y%m%d-%H%M)
COMMIT_HASH=$(git rev-parse --short HEAD)
DIFF_FILE="/tmp/ship-review-diff-${REVIEW_TS}.txt"
CLAUDE_PROMPT="/tmp/ship-review-prompt-claude-${REVIEW_TS}.md"
CODEX_PROMPT="/tmp/ship-review-prompt-codex-${REVIEW_TS}.md"
CLAUDE_OUTPUT="notes/ship-review-claude-${REVIEW_TS}.md"
CODEX_OUTPUT="notes/ship-review-codex-${REVIEW_TS}.md"

# Save the diff to a file
git diff HEAD~1 > "$DIFF_FILE"
```

```bash
# Create Claude prompt file
cat <<EOF > "$CLAUDE_PROMPT"
# Code Review Task

You are reviewing a code diff. Read the review criteria from ~/.claude/commands/code_review.md (Phase 4 section).

## Diff to Review
Read the diff from: $DIFF_FILE

## Instructions
- Conduct architectural and tactical review per code_review.md
- Categorize issues as BLOCKER, IMPORTANT, or POTENTIAL
- Be specific with file names and line numbers
- Flag security or data loss risks as blockers

## Output
Write your review to: $CLAUDE_OUTPUT

Include a header with:
- Agent: Claude
- Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
- Commit: $COMMIT_HASH

Then list all issues found with their category.
EOF
```

```bash
# Create Codex prompt file (identical instructions, different output path)
cat <<EOF > "$CODEX_PROMPT"
# Code Review Task

You are reviewing a code diff. Read the review criteria from ~/.claude/commands/code_review.md (Phase 4 section).

## Diff to Review
Read the diff from: $DIFF_FILE

## Instructions
- Conduct architectural and tactical review per code_review.md
- Categorize issues as BLOCKER, IMPORTANT, or POTENTIAL
- Be specific with file names and line numbers
- Flag security or data loss risks as blockers

## Output
Write your review to: $CODEX_OUTPUT

Include a header with:
- Agent: Codex
- Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
- Commit: $COMMIT_HASH

Then list all issues found with their category.
EOF
```

### 3.2 Launch Reviews in Parallel

**Agent 1 - Claude Review:**
```bash
claude -p "Read $CLAUDE_PROMPT and follow the instructions." --dangerously-skip-permissions
```

**Agent 2 - Codex Review:**
```bash
codex exec --full-auto --skip-git-repo-check "Read $CODEX_PROMPT and follow the instructions."
```

**How to run in parallel:**
- Use Bash tool with `run_in_background: true` for each command
- Do NOT use `&` inside the command — this orphans the process and loses tracking
- Launch both in a single message (parallel tool calls)
- Use `TaskOutput` to check results when ready
- Reviews may take 5-10+ minutes — wait for completion

**⚠️ ACKNOWLEDGE BACKGROUND TASKS (REQUIRED):** After background tasks complete, you MUST call `TaskOutput(task_id, block: false)` for EACH task to formally close it out. Do this even if you already read the output files. Skipping this step causes the session to hang waiting for acknowledgment.

**Verify output:** After each agent completes, check that the output file exists and has content.

---

## Phase 4: Consolidate First Round

After both reviews complete, spawn a clear agent to consolidate findings into a single deduplicated list. This agent does NOT validate — it just merges and organizes.

```bash
claude -p "$(cat <<'EOF'
You are consolidating parallel code reviews into a single organized list.

## Input Files
Read all files matching: notes/ship-review-*.md

## Your Task

### Step 1: Extract All Issues
- Pull every issue from both review files
- Keep all details: description, file, line number, category

### Step 2: Deduplicate
- Merge issues that describe the same problem (even if worded differently)
- Note which agent(s) reported each item (Claude / Codex / Both)
- Issues reported by only ONE agent are still valid — include them

### Step 3: Create Unique List
Sort by priority (BLOCKER → IMPORTANT → POTENTIAL), then output:

# Code Review Consolidation

**Generated:** [timestamp]
**Sources:** [list the review files]
**Commit:** [commit hash]

---

## BLOCKERS
1. **[Issue title]**
   - Details: [specific description]
   - Location: [file:line]
   - Reported by: [Claude / Codex / Both]

## IMPORTANT
2. **[Issue title]**
   ...

## POTENTIAL
3. **[Issue title]**
   ...

### Step 4: Output
Write to: notes/ship-review-consolidated-$(date +%Y%m%d-%H%M).md

Use consecutive numbering across all categories (1, 2, 3... not restarting per section).
EOF
)" --dangerously-skip-permissions
```

Wait for consolidation to complete.

---

## Phase 5: Validate Issues

The main thread validates each issue from the consolidated list. You have full implementation context — use it.

**For each issue:**
1. Read the code at the specified location
2. Consider the implementation intent — does this issue apply given what you were trying to achieve?
3. Check if the concern is accurate in this codebase context
4. Mark each item:
   - ✅ **Confirmed** — issue is real and should be fixed
   - ❌ **False Positive** — not actually an issue (explain why)
   - ❓ **Uncertain** — needs user input

**Important:** Issues reported by only ONE agent are still valid if confirmed. Single-agent findings are common and should be fixed when legitimate.

Update the consolidated file in place with validation status for each item.

Add confirmed issues to the metadata file's "Issues Found" section:
```
- [BLOCKER] Stale closure in callback - Confirmed
- [IMPORTANT] Missing null check - False Positive
```

Mark "Phase 5" as `completed`, mark "Phase 6" as `in_progress`.

---

## Phase 6: Parallel Fixes

Fix all confirmed issues using parallel sub-agents where possible.

### 6.1 Bucket Issues by File

Group confirmed issues to avoid conflicts:
- Issues in the **same file** → same bucket (one agent)
- Issues in **different files** → can be parallel (separate agents)

Aim for up to 10 parallel agents max. If fewer issues, use fewer agents.

### 6.2 Spawn Fix Agents

For each bucket, spawn a clear agent:

```bash
claude -p "$(cat <<'EOF'
Fix the following code review issues:

[List of issues for this bucket with file locations and descriptions]

For each issue:
1. Read the file
2. Understand the problem
3. Implement the fix
4. Verify your fix addresses the concern

Do not fix issues in files not assigned to you.
EOF
)" --dangerously-skip-permissions
```

Run all fix agents in parallel. Wait for all to complete.

### 6.3 Fix Thresholds

Agents should fix based on these thresholds:
- **BLOCKER (✅):** Always fix — no exceptions
- **IMPORTANT (✅):** Fix unless clearly wrong or inapplicable
- **POTENTIAL (✅):** Fix only if trivial (<10 min effort)

Skip ❌ False Positives. For ❓ Uncertain items, ask user before assigning to agents.

### 6.4 Revalidate

After all agents complete:
```bash
npm run type-check && npm run lint && npm test
```

If any checks fail, fix issues (can spawn more agents if needed) and re-run.

### 6.5 Commit Fixes

```
fix: address code review feedback

- [List each fix applied]
- [Reference issue numbers from consolidated review]

Co-Authored-By: Claude <noreply@anthropic.com>
```

### 6.6 Update Progress

1. Mark Phase 6 complete in TodoWrite
2. Add fix commit hash to metadata file: `| 6 | Fix Commit | {commit hash} |`
3. **Update Issues Tracker** in metadata file — for each issue, update the Status and Fixed In columns:
   ```
   | 1 | Stale closure in callback | BLOCKER | Fixed | 1b6b1083 |
   | 2 | Modal dead-end UX | BLOCKER | Partial | 1b6b1083 |
   ```
   Use these status values:
   - Fixed — fully addressed
   - Partial — partially addressed (explain in notes)
   - Deferred — intentionally skipped for later

---

## Phase 7: Open PR

1. Sync with target branch:
   ```bash
   git fetch origin dev
   git merge origin/dev
   ```
   Resolve conflicts if any.

2. Push: `git push -u origin HEAD`

3. Create PR:
   ```bash
   gh pr create --title "..." --body "..."
   ```

   PR format:
   ```
   ## Summary
   {2-3 bullets: what this PR does}

   ## Test Plan
   - [x] Type check passes
   - [x] Lint passes
   - [x] Unit tests pass
   - [ ] {Manual verification steps if applicable}

   ## Review Notes
   {Any deferred items or known limitations}

   🤖 Generated with Claude Code
   ```

4. Output the PR URL

---

### Context Checkpoint (MANDATORY)

**STOP. Before continuing, you MUST:**
1. **Verify Phases 1-7 are complete** in TodoWrite
2. Mark Phase 7 complete and add PR number/URL to metadata file
3. Re-read `~/.claude/commands/ship.md` if needed for full workflow context
4. Continue executing Phase 8 through Phase 11

Second round reviews are NON-NEGOTIABLE. You MUST complete Phase 9.

---

## Phase 8: Post-PR Summary

Verify the PR is ready and output current status.

### 8.1 Verify PR is Clean

Check for merge conflicts:
```bash
git fetch origin dev
git merge origin/dev --no-commit --no-ff || echo "CONFLICTS DETECTED"
git merge --abort 2>/dev/null || true
```

If conflicts detected: resolve, commit, push.

Run full test suite:
```bash
npm run type-check && npm run lint && npm test
```

If tests fail: fix, commit, push, re-verify.

**Only proceed when:** No merge conflicts, type-check passes, lint passes, all tests pass.

### 8.2 Output PR Status

Generate a report of the ship process so far (second round review still pending):

```
═══════════════════════════════════════════════════════════════
PR READY — Second Round Review Pending
═══════════════════════════════════════════════════════════════

## PR
{URL}

## Summary
{1-2 sentence description of what was implemented}

───────────────────────────────────────────────────────────────
PHASE-BY-PHASE REPORT
───────────────────────────────────────────────────────────────

### Phase 0: Clarification
- Questions asked: {number, or "None needed"}
- Key decisions made:
  {List any important decisions from Q&A, or "N/A"}

### Phase 1: Implementation
- Files created: {list}
- Files modified: {list}
- Key changes:
  {Bullet summary of what was implemented}

### Phase 2: Initial Commit
- Commit hash: {hash}
- Commit message: {first line}

### Phase 3: First Round Review
- Claude review: {Completed/Timed out/Failed}
  - Issues found: {BLOCKER: X, IMPORTANT: Y, POTENTIAL: Z}
  - Output file: {path}
- Codex review: {Completed/Timed out/Failed}
  - Issues found: {BLOCKER: X, IMPORTANT: Y, POTENTIAL: Z}
  - Output file: {path}

### Phase 4: Consolidation
- Total unique issues: {number}
- From both agents: {number}
- From Claude only: {number}
- From Codex only: {number}
- Consolidated file: {path}

### Phase 5: Validation (Main Thread)
- Confirmed (✅): {number}
- False positives (❌): {number}
- Uncertain (❓): {number}

### Phase 6: Parallel Fixes
- Fix agents spawned: {number}
- Issues per bucket: {breakdown}
- BLOCKERS fixed: {number}
- IMPORTANT fixed: {number}
- POTENTIAL fixed: {number}
- Skipped: {number}
- Fix commit hash: {hash, or "No fixes needed"}

### Phase 7: PR Creation
- PR number: #{number}
- Target branch: {branch}
- Merge conflicts: {Yes/No}

### Phase 8: Final Verification
- Merge conflict check: ✅ Clean
- Type-check: ✅ Pass
- Lint: ✅ Pass ({X} warnings)
- Tests: ✅ {X} passed, {Y} skipped, {Z} failed

───────────────────────────────────────────────────────────────
TESTING DETAILS
───────────────────────────────────────────────────────────────

### Quick Tests (during implementation)
- Type-check runs: {number}
- Lint runs: {number}
- Targeted test runs: {number}
  - Test patterns used: {list of --testPathPattern values}

### Full Test Runs
- Total full test suite runs: {number}
- Final test results:
  - Total tests: {number}
  - Passed: {number}
  - Skipped: {number}
  - Failed: {number}

### Test Failures Encountered & Fixed
{List any test failures that occurred and how they were resolved, or "None"}

───────────────────────────────────────────────────────────────
NOTES & RECOMMENDATIONS
───────────────────────────────────────────────────────────────

### Deferred Items
{Collect all items from code reviews that were:}
- Out of scope for this PR
- Too complicated / would require significant refactoring
- Lower priority / nice-to-have
- Skipped POTENTIAL issues

{List each with brief description and source (Phase 3 review, Phase 10 review, etc.)}

### Follow-Up Prompt
{If there are deferred items, offer to generate a prompt:}

Would you like me to generate a follow-up prompt to address these deferred items?
- If YES and multiple items: Write prompt to `notes/follow-up-<branch-name>.md`
- If YES and single item: Write prompt to `notes/follow-up-<branch-name>.md`

{Example prompt format:}
```markdown
# Follow-Up: <brief description>

## Context
This follows PR #XX which implemented <summary>.

## Deferred Items to Address
1. <item 1 with details>
2. <item 2 with details>
...

## Relevant Files
- <files that would need changes>

## Notes
<any context from the original implementation that would help>
```

### Manual Testing Recommended
{List any manual verification steps the reviewer should perform}

### Potential Risks
{Any concerns or edge cases to watch for}

═══════════════════════════════════════════════════════════════
```

---

### Context Checkpoint (MANDATORY)

**STOP. Before continuing, you MUST:**
1. **Verify Phases 1-8 are complete** in TodoWrite
2. Mark Phase 8 complete
3. Re-read `~/.claude/commands/ship.md` if needed for full workflow context
4. Continue executing Phase 9 through Phase 11

The second round review is the final quality gate — do not skip it.

---

## Phase 9: Second Round Review (async)

**Before starting:** Verify Phases 1-8 are ALL complete in TodoWrite. Mark Phase 9 as in_progress.

After outputting the final report, run one more sanity check in the background. This catches anything missed and provides extra confidence.

### 9.1 Generate Review Prompt Files

Same approach as Phase 3, but reviewing the complete PR diff against dev.

```bash
# Generate timestamp and paths
POST_REVIEW_TS=$(date +%Y%m%d-%H%M)
POST_DIFF_FILE="/tmp/ship-post-review-diff-${POST_REVIEW_TS}.txt"
POST_CLAUDE_PROMPT="/tmp/ship-post-review-prompt-claude-${POST_REVIEW_TS}.md"
POST_CODEX_PROMPT="/tmp/ship-post-review-prompt-codex-${POST_REVIEW_TS}.md"
POST_CLAUDE_OUTPUT="notes/ship-post-review-claude-${POST_REVIEW_TS}.md"
POST_CODEX_OUTPUT="notes/ship-post-review-codex-${POST_REVIEW_TS}.md"

# Save the full diff against dev
git diff origin/dev...HEAD > "$POST_DIFF_FILE"
```

```bash
# Create Claude prompt file
cat <<EOF > "$POST_CLAUDE_PROMPT"
# Final Sanity Check

Review the complete PR diff for any issues that may have been missed.

## Diff to Review
Read the diff from: $POST_DIFF_FILE

## Focus Areas
- Anything that looks obviously wrong
- Security concerns
- Breaking changes that might have been missed
- Logic errors

## Output
Write findings to: $POST_CLAUDE_OUTPUT

Categorize issues as: BLOCKER / IMPORTANT / POTENTIAL

If no issues found, write a brief "clean bill of health" confirmation.
EOF
```

```bash
# Create Codex prompt file
cat <<EOF > "$POST_CODEX_PROMPT"
# Final Sanity Check

Review the complete PR diff for any issues that may have been missed.

## Diff to Review
Read the diff from: $POST_DIFF_FILE

## Focus Areas
- Anything that looks obviously wrong
- Security concerns
- Breaking changes that might have been missed
- Logic errors

## Output
Write findings to: $POST_CODEX_OUTPUT

Categorize issues as: BLOCKER / IMPORTANT / POTENTIAL

If no issues found, write a brief "clean bill of health" confirmation.
EOF
```

### 9.2 Launch Reviews in Parallel

**Claude Review:**
```bash
claude -p "Read $POST_CLAUDE_PROMPT and follow the instructions." --dangerously-skip-permissions
```

**Codex Review:**
```bash
codex exec --full-auto --skip-git-repo-check "Read $POST_CODEX_PROMPT and follow the instructions."
```

**How to run in parallel:** Use `run_in_background: true`, NOT `&` in the command. Launch both in a single message.

**⚠️ ACKNOWLEDGE BACKGROUND TASKS (REQUIRED):** After background tasks complete, you MUST call `TaskOutput(task_id, block: false)` for EACH task to formally close it out. Do this even if you already read the output files. Skipping this step causes the session to hang waiting for acknowledgment.

**Verify output:** After each agent completes, check that the output file exists and has content.

### 9.3 Consolidate & Validate

After reviews complete, consolidate findings (same as Phase 4) and validate (same as Phase 5).

### 9.4 Fix Issues (Higher Threshold)

Only fix issues that meet this higher bar:
- **BLOCKER (✅):** Always fix
- **IMPORTANT (✅):** Fix only if clearly correct and low-risk
- **POTENTIAL:** Skip unless trivially obvious

If fixes are made:
```bash
git add -A
git commit -m "fix: post-ship review corrections

Co-Authored-By: Claude <noreply@anthropic.com>"
git push
npm run type-check && npm run lint && npm test
```

### 9.5 Update Progress

Mark Phase 9 complete in TodoWrite after reviews finish and any issues are addressed.
3. Add to Artifacts table:
   - `| 9 | Claude Post-Review | {file path} |`
   - `| 9 | Codex Post-Review | {file path} |`
   - `| 9 | Post-Review Fixes Commit | {hash} |` (if any fixes made)
4. **Add any new issues to the Issues Tracker** with "[Round 2]" prefix
5. Check off "Phase 9: Second Round Review"
6. Update "Last Updated" timestamp

**Only proceed to Phase 10 when ALL Phase 9 sub-checkboxes are checked.**

---

## Phase 10: Second Round Summary

### 10.1 Review Results

Output the second round review results:

```
───────────────────────────────────────────────────────────────
SECOND ROUND REVIEW COMPLETE
───────────────────────────────────────────────────────────────

Reviews: Claude ✅, Codex ✅
Issues found: {BLOCKER: X, IMPORTANT: Y, POTENTIAL: Z}
Issues fixed: {number}
Issues deferred: {number}

{If any issues were fixed:}
Additional commit: {hash}

{If no issues found:}
✅ Clean bill of health — no additional issues found.

───────────────────────────────────────────────────────────────
```

### 10.2 Consolidated Deferred Items

Merge deferred items from all phases (First Round + Second Round). Present the complete list:

```
───────────────────────────────────────────────────────────────
DEFERRED ITEMS (all phases)
───────────────────────────────────────────────────────────────

{Numbered list of all deferred items with source:}
1. [Phase 3] <description>
2. [Phase 9] <description>
...

───────────────────────────────────────────────────────────────
```

### 10.3 Follow-Up Prompt

If there are deferred items, ask:

```
Would you like me to write a follow-up prompt to address these {N} item(s)?
```

Use `AskUserQuestion` with options:
1. **Yes, write follow-up prompt** — generates `notes/follow-up-<branch-name>.md`
2. **No thanks** — skip

If yes, write a prompt containing all deferred items with context from the implementation.

### 10.4 Final Questions (Combined)

Ask all wrap-up questions in a **single `AskUserQuestion` call** with up to 3 questions:

```
AskUserQuestion with questions:

1. "Mark Linear ticket as Ready for Review?" (header: "Linear")
   - "Yes, mark Ready for Review"
   - "No, leave as is"

2. "Who should review this PR?" (header: "Reviewer")
   - "Polly"
   - "Anubhav"
   - "Atin"
   - "No one"

3. [Only if --worktree was used] "Clean up worktree?" (header: "Worktree")
   - "Remove worktree(s)"
   - "Keep for now"
```

**⚠️ CRITICAL STATUS DISTINCTION:**
- **"Ready for Review"** = PR is complete, waiting for a human to pick it up (CORRECT)
- **"In Review"** = A human is actively reviewing right now (WRONG — never set this automatically)

**NEVER use "In Review"** — that status is set by the human reviewer when they start reviewing. Agents always use "Ready for Review".

**Reviewer Labels (NOT assignee — we ADD a label to indicate who should review):**

| Reviewer | Label Name | Label ID |
|----------|------------|----------|
| Atin | R:Atin | `fb695371-2ee9-415b-bf7b-d023e7ecf18f` |
| Anubhav | R:Anubhav | `e0cc7480-1410-4ec4-8258-0337636b5f7e` |
| Polly | R:Polly | `99f4f77b-a768-436c-bdff-ccc5d2d73ed3` |

**Important:** The reviewer is set via a LABEL (e.g., "R:Anubhav"), NOT by changing the assignee. The assignee remains whoever is working on the ticket.

**After user responds, execute all actions:**

1. If "Yes, mark Ready for Review" (with or without reviewer):
   ```
   mcp__linear__update_issue:
   - id: <ticket-id>
   - state: "Ready for Review"  # NOT "In Review"!
   - labels: ["<existing-labels>", "<reviewer-label-id>"]  # Add reviewer label if selected
   ```

   **Note:** The `labels` parameter REPLACES all labels. First fetch existing labels, then include them plus the new reviewer label.

2. If "Remove worktree(s)":
   ```bash
   git worktree remove "$WORKTREE_PATH" --force
   ```

   **⚠️ BEFORE RUNNING:** Stop and think. Verify `$WORKTREE_PATH` is the correct path. This is destructive — be 100% certain before executing. Never use raw `rm -rf` on worktrees.

   (Branch remains available via `git checkout <branch-name>`)

---

## Phase 11: Cleanup

### 11.1 Update Progress (Final)

Mark all remaining phases complete in TodoWrite (Phase 10, Phase 11).

### 11.2 Metadata File Cleanup

After successful completion (PR merged or ready for review), the metadata file can be deleted:

```bash
rm -f notes/ship-{identifier}.md
```

**⚠️ BEFORE RUNNING:** Stop and think. Verify you have the correct file path. `rm -f` is destructive — be 100% certain before executing.

**Rationale:** The PR itself is the permanent record. The metadata file served its purpose during the ship process.

**Alternative:** If you want an audit trail, move to `notes/archive/`:
```bash
mkdir -p notes/archive
mv notes/ship-{identifier}.md notes/archive/
```

**Note:** For batch cleanup of old worktrees across multiple ship runs, use `/ship-cleanup`.

---

## Failure Handling

- **Implementation unclear:** Ask for clarification using `AskUserQuestion` before proceeding
- **Tests fail repeatedly:** Summarize attempts and ask for help
- **Single-agent issue:** Still valid — validate it yourself and fix if confirmed
- **Uncertain items (❓):** Ask user for guidance before spawning fix agents
- **Fix agent fails:** Main thread picks up the issue and fixes it directly
- **Can't validate an issue:** Mark as ❓ Uncertain and ask user
- **Review takes long time:** Reviews may take 5-10+ minutes. Wait for completion. Check output files periodically.
- **Merge conflicts:** Resolve them, or ask for help if complex
- **Context compaction:** Check TodoWrite FIRST to see which phases are complete. Read `notes/ship-{identifier}.md` for artifacts and issue tracking. Then re-read `~/.claude/commands/ship.md` if needed. Continue from the first incomplete phase. NEVER skip phases or treat the PR as "complete" without finishing all phases. TodoWrite is your source of truth for phase progress.

---

Now begin. Ship it.
