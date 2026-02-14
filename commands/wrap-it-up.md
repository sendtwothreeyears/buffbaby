# Wrap It Up

Finalize work with quad-agent code review, smart deduplication, parallel fixes, and a final sanity check.

**Usage:** `/wrap-it-up` — Review, fix, commit, PR, and verify the current branch

---

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Phase 1: Quad Review                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │  Claude  │  │  Codex   │  │  Claude  │  │  Codex   │        │
│  │ (normal) │  │ (normal) │  │(critical)│  │(critical)│        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
│       └──────────────┴──────────────┴──────────────┘            │
│                              │                                   │
│                              ▼                                   │
│                    Phase 2: Summarizer                          │
│                    (dedupe + prioritize)                        │
│                              │                                   │
│                              ▼                                   │
│                    Phase 3: Validation                          │
│                    (research, set aside NEEDS INPUT)            │
│                              │                                   │
│                              ▼                                   │
│                    Phase 4: Parallel Fixes                      │
│                    (multiple sub-agents)                        │
│                              │                                   │
│                              ▼                                   │
│                    Phase 5: Commit & Push                       │
│                    (includes review files)                      │
│                              │                                   │
│                              ▼                                   │
│                    Phase 6: Open/Update PR                      │
│                              │                                   │
│                              ▼                                   │
│                    Phase 7: Final Sanity Check                  │
│                    (clear Claude review)                        │
│                              │                                   │
│                              ▼                                   │
│                    Phase 8: Resolve NEEDS INPUT                 │
│                    (ask user via AskUserQuestion)               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 0: Setup & Commit

### 0.1 Verify Branch

```bash
git branch --show-current
```

**Guard rails:**
- If on `main` or `dev`, STOP and ask user which branch to work on
- Extract STORY_ID from branch name (pattern: `aut-123` or `AUT-123` → uppercase to `AUT-123`)
- If no STORY_ID pattern found, use `AskUserQuestion` to ask:
  ```
  "I couldn't find a story ID in the branch name '{branch}'. What story ID should I use for the review files?"
  ```
  Accept their input and use it as STORY_ID (or use branch name if they say none)

### 0.2 Sync with Remote

```bash
git fetch origin
git fetch origin dev
```

This ensures origin/dev is current for accurate diffs.

### 0.3 Commit Uncommitted Work

Check for uncommitted changes:
```bash
git status --porcelain
```

If there are changes:
1. Stage everything: `git add -A`
2. Run quick validation: `npm run type-check && npm run lint`
3. If validation passes, commit:
   ```bash
   git commit -m "$(cat <<'EOF'
   wip: checkpoint before wrap-it-up review

   Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
   EOF
   )"
   ```
4. If validation fails, STOP and inform user of the issues

### 0.4 Run Test Suite (Baseline)

```bash
npm run type-check
npm run lint
npm test
```

Capture results. Any failures are noted but don't block the review — reviewers should see the current state.

### 0.5 Gather Context (Once, for All Agents)

Collect all git context that agents will need:
```bash
git log --oneline origin/dev..HEAD
git diff origin/dev...HEAD --stat
git diff origin/dev...HEAD
```

**Large diff handling:**
Check the diff size:
```bash
git diff origin/dev...HEAD | wc -l
```

- If **under 2000 lines**: embed the full diff in the context document
- If **2000+ lines**: write diff to `/tmp/wrap-review-diff.txt` and reference it in the context document instead of embedding

### 0.6 Write Context Document

Write `/tmp/wrap-review-context.md`:

```markdown
# Code Review Context

## Branch Information
- **Branch:** {branch name}
- **Story ID:** {STORY_ID}
- **Base:** origin/dev at {merge-base hash}
- **Latest Commit:** {HEAD hash}

## Test Results (Baseline)
- Type check: {PASS/FAIL}
- Lint: {PASS/FAIL}
- Tests: {PASS/FAIL} ({X passed, Y failed})

## Commits on This Branch
{git log output}

## Files Changed
{git diff --stat output}

## Full Diff
{If diff is small: embed here}
{If diff is large: "The diff is {N} lines. Read it from /tmp/wrap-review-diff.txt"}
```

This context document is passed to all four review agents so they don't need to run git commands themselves.

---

## Phase 1: Quad Code Review

Launch FOUR code reviews in parallel using clear agents.

**Important:** All git operations and test runs were completed in Phase 0. Agents receive pre-gathered context and should focus purely on analysis. They can read additional files for context but should NOT re-run git fetch, git pull, or the test suite.

### 1.1 Generate Review Prompt Files

Write prompt files for all four agents. Each references the context document from Phase 0.

**Normal Review Prompt:**
```bash
cat <<'EOF' > /tmp/wrap-review-normal-prompt.md
# Code Review Task

Read the context document at: /tmp/wrap-review-context.md

You are a senior software engineer conducting a code review. The context contains branch info, test results, and the complete diff.

**Important:** Git sync and tests have already been run. Results are in the context. Do NOT re-run git fetch, git pull, or the test suite. You may run git blame or read files for additional context.

## Your Task

1. **Understand the Changes** — Trace the logic flow through the changed code.

2. **Review at Two Levels:**

   **Architectural**: Does this solution address the root cause or work around a deeper issue? Are there better patterns?

   **Tactical**: Evaluate the specific implementation:
   - Test coverage adequacy
   - Security (auth, data exposure, input validation)
   - Performance (re-renders, memory, query efficiency)
   - TypeScript quality and pattern consistency

3. **Write the Review** to the output file specified in your task, using this format:

```markdown
## Code Review
- **Date:** [UTC timestamp]
- **Model:** [your model]
- **Branch:** [from context]
- **Commit:** [from context]
---

[Your review content]

### Blockers — must fix before merge
[Numbered list with file:line references]

### Important — should fix, not blocking
[Numbered list]

### Potential — nice-to-have or uncertain
[Numbered list]
```

4. **Validation Pass** — Re-read each Blocker and Important item. Verify it exists AND is part of this branch's changes.

Be specific with file names and line numbers. Flag security or data loss risks as blockers.
EOF
```

**Critical Review Prompt:**
```bash
cat <<'EOF' > /tmp/wrap-review-critical-prompt.md
# Critical Code Review Task

Read the context document at: /tmp/wrap-review-context.md

You are a jaded, critical senior engineer who has seen too many production incidents caused by "working" code. You trust nothing. Your job is to find the problems others miss.

Git sync and tests have already been run — do NOT re-run them. You may read additional files for context.

## Your Review Style
- Assume bugs exist until proven otherwise
- Question every assumption in the code
- Look for edge cases the author didn't consider
- Check for race conditions, state inconsistencies, and error handling gaps
- Be suspicious of "clever" code — it's usually hiding something
- Look for what's NOT there (missing validation, missing error handling, missing tests)

## Output Format
Write your review to the output file specified in your task:

```markdown
## Critical Code Review
- **Date:** [UTC timestamp]
- **Model:** [your model]
- **Branch:** [branch]
- **Commit:** [hash]
---

### What Could Go Wrong
[List specific failure scenarios]

### Hidden Assumptions
[What is this code assuming that might not be true?]

### Missing Pieces
[What should exist but doesn't?]

### Trust Issues
[Where is validation missing?]

---

### Blockers — will cause problems
[Numbered list with file:line references]

### Important — likely to cause problems
[Numbered list]

### Suspicious — worth investigating
[Numbered list]
```

Validate each finding. Strike through false positives. Be harsh but accurate.
EOF
```

### 1.2 Launch Four Reviews

Generate timestamp for output files:
```bash
REVIEW_TS=$(date +%Y%m%d-%H%M)
```

**Claude Normal:**
```bash
claude -p "Read /tmp/wrap-review-normal-prompt.md and follow the instructions. Write your review to notes/CR-${STORY_ID}-Claude-Normal-${REVIEW_TS}.md" --dangerously-skip-permissions
```

**Codex Normal:**
```bash
codex exec --full-auto --skip-git-repo-check "Read /tmp/wrap-review-normal-prompt.md and follow the instructions. Write your review to notes/CR-${STORY_ID}-Codex-Normal-${REVIEW_TS}.md"
```

**Claude Critical:**
```bash
claude -p "Read /tmp/wrap-review-critical-prompt.md and follow the instructions. Write your review to notes/CR-${STORY_ID}-Claude-Critical-${REVIEW_TS}.md" --dangerously-skip-permissions
```

**Codex Critical:**
```bash
codex exec --full-auto --skip-git-repo-check "Read /tmp/wrap-review-critical-prompt.md and follow the instructions. Write your review to notes/CR-${STORY_ID}-Codex-Critical-${REVIEW_TS}.md"
```

Launch all four with `run_in_background: true`. Timeout after 5 minutes per agent.

---

## Phase 2: Summarize

Once all four reviews complete, launch a summarizer agent.

**Generate summarizer prompt:**
```bash
cat <<'EOF' > /tmp/wrap-summarize-prompt.md
# Review Consolidation Task

You are a review consolidator. Your job is to read multiple code review outputs and produce ONE deduplicated, prioritized list.

## Input
Read the four review files in notes/:
- CR-*-Claude-Normal-*.md
- CR-*-Codex-Normal-*.md
- CR-*-Claude-Critical-*.md
- CR-*-Codex-Critical-*.md

## Process
For each unique issue found:
1. Merge duplicates (same issue found by multiple reviewers)
2. Note consensus (issues found by 2+ reviewers are higher confidence)
3. Preserve file:line references
4. Keep the clearest description of each issue

## Output
Write a JSON file to `/tmp/wrap-issues.json`:
```json
{
  "blockers": [
    {
      "id": 1,
      "title": "Brief title",
      "description": "Full description",
      "location": "path/to/file.ts:123",
      "found_by": ["Claude-Normal", "Claude-Critical"],
      "consensus": true
    }
  ],
  "important": [...],
  "potential": [...]
}
```

Also write a human-readable summary to `/tmp/wrap-summary.md`.

Be thorough. Every unique issue from every review should appear exactly once.
EOF
```

**Launch summarizer:**
```bash
claude -p "Read /tmp/wrap-summarize-prompt.md and follow the instructions." --dangerously-skip-permissions
```

---

## Phase 3: Validation (Main Thread)

Read `/tmp/wrap-issues.json` and `/tmp/wrap-summary.md`.

For each issue in blockers and important:

1. **Deep research** — Read the actual code at the referenced location
2. **Trace the logic** — Understand why the reviewer flagged it
3. **Verify validity** — Is this a real problem? Does it apply to our context?
4. **Assess risk** — What's the actual impact if unfixed?
5. **Determine fix approach** — How should it be fixed? Multiple options?

Build a validated issue list:
- ✅ **VALID** — Real issue, needs fix
- ❌ **FALSE POSITIVE** — Not an issue (explain why)
- ⬇️ **DOWNGRADE** — Valid but lower priority than flagged
- ❓ **NEEDS INPUT** — Uncertain, set aside for user decision

**NEEDS INPUT handling:**
- Do NOT block on these items
- Set them aside in a separate list
- Continue with VALID issues through Phases 4-7
- After the final sanity check, present all NEEDS INPUT items to the user via `AskUserQuestion`

For VALID issues, determine:
- Can this be fixed in isolation? (safe for parallel agent)
- Does this touch shared code? (must be sequential)
- Is this architecturally complex? (handle in main thread)

---

## Phase 4: Parallel Fixes

Group validated issues into fix buckets based on dependencies.

**Guiding principles:**
- Issues touching the same file → same bucket
- Issues with shared dependencies → same bucket
- Simple isolated fixes → can parallelize
- Complex or uncertain fixes → main thread

Launch sub-agents for each bucket using Task tool with `subagent_type: "general-purpose"`:

```
For each bucket, provide:
- The specific issues to fix (with full context)
- The files involved
- The approach to take
- Run type-check/lint/test after fixing
```

Monitor all agents. Collect their results.

If any fix fails validation (tests break), handle in main thread.

---

## Phase 5: Commit & Push

Once all fixes are applied and validated:

1. Stage all changes INCLUDING review files:
   ```bash
   git add -A
   git add notes/CR-${STORY_ID}-*.md
   ```

2. Run final validation:
   ```bash
   npm run type-check && npm run lint && npm test
   ```

3. Commit with comprehensive message:
   ```bash
   git commit -m "$(cat <<'EOF'
   fix: address code review findings from quad review

   Blockers fixed:
   - [List each blocker that was fixed]

   Important issues fixed:
   - [List each important issue]

   Review files added:
   - notes/CR-{STORY_ID}-Claude-Normal-*.md
   - notes/CR-{STORY_ID}-Codex-Normal-*.md
   - notes/CR-{STORY_ID}-Claude-Critical-*.md
   - notes/CR-{STORY_ID}-Codex-Critical-*.md

   Reviewed by: Claude (normal + critical), Codex (normal + critical)
   Fixes validated and applied by: Claude Opus 4.5

   Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
   EOF
   )"
   ```

4. Push:
   ```bash
   git push -u origin HEAD
   ```

---

## Phase 6: Open or Update PR

### 6.1 Check for merge conflicts

```bash
git fetch origin dev
git merge origin/dev --no-commit --no-ff || echo "CONFLICTS"
git merge --abort 2>/dev/null || true
```

If conflicts detected, resolve them before proceeding.

### 6.2 Check for existing PR

```bash
gh pr list --head $(git branch --show-current) --json number,url --jq '.[0]'
```

- If PR exists: update the existing PR body with new review info
- If no PR: create a new one

### 6.3 Create or Update PR

**If creating new PR:**
```bash
gh pr create --title "[STORY_ID] {concise description}" --body "$(cat <<'EOF'
## Summary
[Description of the branch's changes]

## Code Review Process
This PR underwent quad-agent code review:
- Claude (normal): see `notes/CR-{STORY_ID}-Claude-Normal-*.md`
- Codex (normal): see `notes/CR-{STORY_ID}-Codex-Normal-*.md`
- Claude (critical): see `notes/CR-{STORY_ID}-Claude-Critical-*.md`
- Codex (critical): see `notes/CR-{STORY_ID}-Codex-Critical-*.md`

### Issues Found & Fixed
**Blockers:** [count] found, [count] fixed
**Important:** [count] found, [count] fixed
**Potential:** [count] found, [count] addressed

## Test Plan
- [x] Type check passes
- [x] Lint passes
- [x] Unit tests pass

🤖 Generated with Claude Code (wrap-it-up command)
EOF
)"
```

**If updating existing PR:**
```bash
gh pr edit {PR_NUMBER} --body "$(cat <<'EOF'
[Same body format as above, noting this is an update]

---
_Updated by wrap-it-up command_
EOF
)"
```

### 6.4 Output the PR URL

---

## Phase 7: Final Sanity Check

Launch one final clear Claude review of the complete PR.

**Generate sanity check prompt:**
```bash
BRANCH=$(git branch --show-current)
SANITY_TS=$(date +%Y%m%d-%H%M)

cat <<EOF > /tmp/wrap-sanity-prompt.md
# Final Sanity Check Task

You are doing a final sanity check on a PR that has already been through extensive review.

## Steps

1. Get the PR diff by running: \`gh pr diff\`

2. Quick scan for:
   - Anything obviously wrong that slipped through
   - Debug code left in
   - Console.logs that shouldn't be there
   - Commented-out code
   - TODO comments that should be addressed
   - Anything that would embarrass us in production

3. If all clear, output:
   "✅ FINAL SANITY CHECK PASSED — Ready to merge"

4. If issues found, output:
   "⚠️ SANITY CHECK FOUND ISSUES:"
   [List each issue]

## Output
Write findings to: notes/sanity-check-${BRANCH}-${SANITY_TS}.md
EOF
```

**Launch sanity check:**
```bash
claude -p "Read /tmp/wrap-sanity-prompt.md and follow the instructions." --dangerously-skip-permissions
```

Wait for completion. Report result to user.

---

## Phase 8: Resolve NEEDS INPUT Items

If any issues were marked ❓ **NEEDS INPUT** during Phase 3, now present them to the user.

For each NEEDS INPUT item, use `AskUserQuestion` with:
- A clear description of the issue
- Why it's uncertain (what you couldn't determine)
- Options: "Fix it", "Skip it", "Let me explain more"

Based on user responses:
- **Fix it**: Apply the fix, commit, push (amend or new commit as appropriate)
- **Skip it**: Note in final output as "Deferred by user"
- **Let me explain more**: Get clarification, then re-evaluate

This step only runs if there are NEEDS INPUT items. Otherwise, skip to Final Output.

---

## Final Output

```
═══════════════════════════════════════════════════════════════
WRAP IT UP COMPLETE
═══════════════════════════════════════════════════════════════

## PR
{URL} {NEW or UPDATED}

## Review Summary
- Normal reviews: Claude ✅, Codex ✅
- Critical reviews: Claude ✅, Codex ✅
- Total unique issues: {count}
- Blockers fixed: {count}
- Important fixed: {count}
- False positives filtered: {count}

## Fix Summary
- Parallel fix agents: {count}
- Issues fixed by sub-agents: {count}
- Issues fixed in main thread: {count}

## Validation
- Type check: ✅
- Lint: ✅
- Tests: ✅ ({count} passed)

## Final Sanity Check
{PASSED or list of remaining issues}

## NEEDS INPUT Items
{If any were resolved in Phase 8:}
- {Issue}: {User decision - Fixed/Skipped}
{If none: "None"}

## Review Files Committed
- notes/CR-{STORY_ID}-Claude-Normal-{timestamp}.md
- notes/CR-{STORY_ID}-Codex-Normal-{timestamp}.md
- notes/CR-{STORY_ID}-Claude-Critical-{timestamp}.md
- notes/CR-{STORY_ID}-Codex-Critical-{timestamp}.md

═══════════════════════════════════════════════════════════════
```

---

## Error Handling

- **Agent timeout:** Use partial results, note in output
- **Agent failure:** Continue with remaining agents
- **Fix conflict:** Handle sequentially in main thread
- **Test failure after fix:** Investigate, may need to back out fix
- **Merge conflict:** Resolve or ask for help

---

Now begin. Wrap it up.
