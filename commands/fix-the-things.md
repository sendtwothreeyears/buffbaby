# Automated Development Environment Fix-All

## Goal
Automatically fix ALL test failures, type errors, and linting issues to create a pristine development environment with zero technical debt.

## Architecture

This command uses a **parallel detection → sequential fixing** approach to avoid agents stepping on each other:

1. **Phase 1 (Parallel):** Three agents detect issues simultaneously
2. **Phase 2 (Sequential):** Fix each category one at a time, using parallel agents within each category

---

## Step 1: Save Current Work

```bash
git status
```

If uncommitted changes exist:
```bash
git add -A && git commit -m "WIP: Save work before automated fix-all"
```

---

## Step 2: Parallel Issue Detection

Launch THREE agents in parallel to detect issues:

### Agent 1: Lint Detection
```
Run `npm run lint` and capture all errors/warnings.
Output a structured list of files with lint issues.
Do NOT fix anything - detection only.
Write results to /tmp/fix-all-lint-issues.json
```

### Agent 2: Type Detection
```
Run `npm run typecheck` (or `npx tsc --noEmit`) and capture all errors.
Output a structured list of files with type errors.
Do NOT fix anything - detection only.
Write results to /tmp/fix-all-type-issues.json
```

### Agent 3: Test Detection
```
Run `npm test` and capture all failures.
Output a structured list of failing test files.
Do NOT fix anything - detection only.
Write results to /tmp/fix-all-test-issues.json
```

Wait for all three agents to complete.

---

## Step 3: Analyze & Plan

Read all three detection results and create a fix plan:

1. **Count issues by category:**
   - Lint issues: X issues in Y files
   - Type errors: X errors in Y files
   - Test failures: X tests in Y files

2. **Check for overlap:**
   - Identify files that appear in multiple categories
   - These files need careful sequencing

3. **Determine fix order:**
   - Fix LINT first (formatting/style changes are safest)
   - Fix TYPES second (may change signatures that tests depend on)
   - Fix TESTS last (tests validate the fixed code)

---

## Step 4: Fix Lint Issues (Parallel Within Category)

If lint issues exist:

1. **Auto-fix what's possible:**
   ```bash
   npm run lint -- --fix
   ```

2. **For remaining issues, spawn parallel agents:**
   - Group files into buckets (up to 10 agents)
   - Each agent handles a disjoint set of files
   - No two agents touch the same file

3. **Verify lint is clean:**
   ```bash
   npm run lint
   ```

4. **Commit lint fixes:**
   ```bash
   git add -A && git commit -m "fix: Auto-fix lint issues"
   ```

---

## Step 5: Fix Type Errors (Parallel Within Category)

If type errors exist:

1. **Analyze error patterns:**
   - Missing types
   - Type mismatches
   - Import errors

2. **Spawn parallel agents:**
   - Group files into buckets (up to 10 agents)
   - Each agent handles a disjoint set of files
   - Agent prompt includes:
     - The specific files to fix
     - The error messages for those files
     - Instruction to NOT touch other files

3. **Verify types are clean:**
   ```bash
   npm run typecheck
   ```
   If errors remain, run another fixing round (max 3 iterations).

4. **Commit type fixes:**
   ```bash
   git add -A && git commit -m "fix: Resolve type errors"
   ```

---

## Step 6: Fix Test Failures (Parallel Within Category)

If test failures exist:

1. **IMPORTANT:** First determine if failures indicate prod bugs or test bugs:
   - If test logic is wrong → fix the test
   - If prod code is wrong → STOP and report to user

2. **Spawn parallel agents:**
   - Group test files into buckets (up to 10 agents)
   - Each agent handles a disjoint set of test files
   - Agent prompt includes:
     - The specific test files to fix
     - The failure messages
     - The source files being tested (read-only reference)
     - Instruction: "Only modify test files, not source files"

3. **Verify tests pass:**
   ```bash
   npm test
   ```
   If failures remain, run another fixing round (max 3 iterations).

4. **Commit test fixes:**
   ```bash
   git add -A && git commit -m "fix: Resolve test failures"
   ```

---

## Step 7: Final Verification

Run all checks in sequence to confirm zero issues:

```bash
npm run lint && npm run typecheck && npm test
```

If ANY check fails, return to the appropriate step (max 2 full cycles).

---

## Step 8: Final Summary

Display comprehensive summary:

```
════════════════════════════════════════════════════════════════
🚀 FIX-THE-THINGS COMPLETE
════════════════════════════════════════════════════════════════

DETECTION PHASE (Parallel)
├── Lint agent:     Found X issues in Y files
├── Type agent:     Found X errors in Y files
└── Test agent:     Found X failures in Y files

FIXING PHASE (Sequential by category, parallel within)
├── Lint fixes:     X issues fixed using Y agents
├── Type fixes:     X errors fixed using Y agents
└── Test fixes:     X tests fixed using Y agents

VERIFICATION
├── Lint:           ✅ Clean
├── Typecheck:      ✅ Clean
└── Tests:          ✅ X passed, Y skipped

COMMITS CREATED
├── <hash> fix: Auto-fix lint issues
├── <hash> fix: Resolve type errors
└── <hash> fix: Resolve test failures

════════════════════════════════════════════════════════════════
```

---

## Parallel Agent Guidelines

When spawning parallel fix agents:

1. **File Disjointness:** Each agent gets a unique set of files. No overlap.
2. **Bucket by Complexity:** Don't just split by count; consider error complexity.
3. **Max 10 Agents:** More agents = more coordination overhead.
4. **Clear Boundaries:** Agent prompt must explicitly list which files it owns.
5. **No Cross-Category Parallelism:** Never run lint+type or type+test agents simultaneously.

Example agent prompt for type fixing:
```
You are fixing TypeScript errors in these specific files ONLY:
- src/services/auth.ts (3 errors)
- src/services/user.ts (2 errors)

Do NOT modify any other files. Here are the errors:
[paste errors]

Fix these errors and report what you changed.
```

---

## Failure Handling

- **Lint won't auto-fix:** Manual agent intervention per file
- **Type errors persist after 3 rounds:** Report and ask for help
- **Test failures indicate prod bugs:** STOP, report to user, do not "fix" by weakening tests
- **Agent conflicts detected:** Abort parallel round, fall back to sequential

---

## Success Criteria

- Zero TypeScript errors
- 100% tests passing
- Zero linting warnings/errors
- Clean git working directory
- Atomic commits per category

---

Now begin. Fix all the things.
