---
name: archive:team-three-review
description: "Team Three Review: Six-Agent Code Review using Claude, Codex, and Gemini"
disable-model-invocation: true
---

# Team Three Review: Six-Agent Code Review

Run parallel code reviews using Claude, Codex, and Gemini — each provider runs both a standard review and a critical review.

**Usage:**
- `/archive:team-three-review` — Review current branch with all six agents
- `/archive:team-three-review [context]` — Review with additional context: `$ARGUMENTS`

---

## Architecture

The main agent (Opus 4.5) handles all deterministic work once, then passes context to six review agents: three standard reviews and three critical (adversarial) reviews.

```
Main Agent (Opus 4.5)
├── Git operations (once)
├── Test suite (once)
├── Generate context document
├── Generate standard prompt
├── Generate critical prompt
└── Launch 6 agents
         │
    ┌────┴────┬────────────┬────────────┬────────────┬────────────┐
    ▼         ▼            ▼            ▼            ▼            ▼
  Claude    Claude       Codex       Codex       Gemini      Gemini
 (standard) (critical)  (standard)  (critical)  (standard)  (critical)
```

---

## Agent Configuration

| Agent | Type | Model | Command |
|-------|------|-------|---------|
| Claude | Standard | Opus 4.5 | `claude -p "Read notes/.tmp/team-review-standard.md and follow the instructions." --dangerously-skip-permissions` |
| Claude | Critical | Opus 4.5 | `claude -p "Read notes/.tmp/team-review-critical.md and follow the instructions." --dangerously-skip-permissions` |
| Codex | Standard | GPT-5 | `codex exec --full-auto --skip-git-repo-check "Read notes/.tmp/team-review-standard.md and follow the instructions." 2>&1 \| tee notes/.tmp/codex-standard.log` |
| Codex | Critical | GPT-5 | `codex exec --full-auto --skip-git-repo-check "Read notes/.tmp/team-review-critical.md and follow the instructions." 2>&1 \| tee notes/.tmp/codex-critical.log` |
| Gemini | Standard | Gemini 3 Pro | `gemini -m gemini-3-pro-preview --yolo "Read notes/.tmp/team-review-standard.md and follow the instructions." 2>&1 \| tee notes/.tmp/gemini-standard.log` |
| Gemini | Critical | Gemini 3 Pro | `gemini -m gemini-3-pro-preview --yolo "Read notes/.tmp/team-review-critical.md and follow the instructions." 2>&1 \| tee notes/.tmp/gemini-critical.log` |

**IMPORTANT:** All prompt files MUST be written inside the workspace (e.g., `notes/.tmp/`) — NOT `/tmp/`. Gemini CLI sandboxes file reads to workspace directories only and cannot read `/tmp/`. Using workspace-relative paths ensures all three CLIs can reliably read the prompt files.

**Note:** Codex ignores stdin, so all agents use the file reference approach for consistency.

---

## Instructions

### Phase 1: Gather All Context (Main Agent Does This Once)

Run these commands to build the complete context:

```bash
# Branch info
git branch --show-current
git fetch origin dev
git merge-base HEAD origin/dev

# Commits on this branch
git log --oneline origin/dev..HEAD

# Full diff (not just stat)
git diff origin/dev...HEAD

# File change summary
git diff origin/dev...HEAD --stat
```

Extract STORY_ID from branch name (pattern: `aut-123` or `AUT-123`, uppercase it).

### Phase 2: Run Test Suite (Main Agent Does This Once)

Run sequentially, capture all output:

```bash
npm run type-check 2>&1
npm run lint 2>&1
npm test 2>&1
```

Store results including:
- Pass/fail status for each
- Error counts and messages
- Any blockers identified

### Phase 3: Generate Context Document

First, create the workspace temp directory:
```bash
mkdir -p notes/.tmp
```

Write `notes/.tmp/team-review-context.md` with all gathered information:

```markdown
# Code Review Context

## Branch Information
- **Branch:** {branch name}
- **Story ID:** {STORY_ID}
- **Base:** origin/dev at {merge-base hash}
- **Latest Commit:** {HEAD hash}

## Commits on This Branch
{git log output}

## Test Results

### Type Check
**Status:** {PASS/FAIL}
{output if relevant, especially errors}

### Lint
**Status:** {PASS/FAIL}
{output if relevant, especially errors}

### Unit Tests
**Status:** {PASS/FAIL}
{summary: X passed, Y failed}
{failure details if any}

## Files Changed
{git diff --stat output}

## Full Diff
```diff
{complete git diff output}
```
```

### Phase 4: Build the Review Prompts

Concatenate the canonical review skills with the context document. This keeps the review criteria skills as the single source of truth.

```bash
# Standard prompt = canonical skill + context
cat .claude/skills/review-criteria/code-review/SKILL.md > notes/.tmp/team-review-standard.md
echo -e "\n\n---\n\n**Additional Context:** $ARGUMENTS\n\n---\n\n# CONTEXT DOCUMENT\n" >> notes/.tmp/team-review-standard.md
cat notes/.tmp/team-review-context.md >> notes/.tmp/team-review-standard.md

# Critical prompt = canonical skill + context
cat .claude/skills/review-criteria/code-review-critical/SKILL.md > notes/.tmp/team-review-critical.md
echo -e "\n\n---\n\n**Additional Context:** $ARGUMENTS\n\n---\n\n# CONTEXT DOCUMENT\n" >> notes/.tmp/team-review-critical.md
cat notes/.tmp/team-review-context.md >> notes/.tmp/team-review-critical.md
```

Note: The canonical skills specify output filenames:
- Standard: `CR-{STORY_ID}-{Model}-Standard-{timestamp}.md`
- Critical: `CR-{STORY_ID}-{Model}-Critical-{timestamp}.md`

### Phase 5: Generate Timestamp

```bash
date +%Y%m%d-%H%M
```

Save for synthesis report filename.

### Phase 6: Launch All Six Agents

Launch each with `run_in_background: true`. Use file reference approach (Codex ignores stdin):

**Claude (Standard):**
```bash
claude -p "Read notes/.tmp/team-review-standard.md and follow the instructions." --dangerously-skip-permissions
```

**Claude (Critical):**
```bash
claude -p "Read notes/.tmp/team-review-critical.md and follow the instructions." --dangerously-skip-permissions
```

**Codex (Standard):**
```bash
codex exec --full-auto --skip-git-repo-check "Read notes/.tmp/team-review-standard.md and follow the instructions." 2>&1 | tee notes/.tmp/codex-standard.log
```

**Codex (Critical):**
```bash
codex exec --full-auto --skip-git-repo-check "Read notes/.tmp/team-review-critical.md and follow the instructions." 2>&1 | tee notes/.tmp/codex-critical.log
```

**Gemini (Standard):**
```bash
gemini -m gemini-3-pro-preview --yolo "Read notes/.tmp/team-review-standard.md and follow the instructions." 2>&1 | tee notes/.tmp/gemini-standard.log
```

**Gemini (Critical):**
```bash
gemini -m gemini-3-pro-preview --yolo "Read notes/.tmp/team-review-critical.md and follow the instructions." 2>&1 | tee notes/.tmp/gemini-critical.log
```

**Tell the user:**
> "Context prepared. Test results: {type-check: PASS/FAIL, lint: PASS/FAIL, tests: PASS/FAIL}
>
> Launched 6 review agents:
> - Claude (Standard): task ID {id}
> - Claude (Critical): task ID {id}
> - Codex (Standard): task ID {id}
> - Codex (Critical): task ID {id}
> - Gemini (Standard): task ID {id}
> - Gemini (Critical): task ID {id}
>
> You can continue working. I'll synthesize when complete."

### Phase 7: Wait and Collect

Use `TaskOutput` with `block: true` for each agent.

Find review files:
```bash
# Standard reviews
ls -t notes/CR-$STORY_ID-Claude-Standard-*.md | head -1
ls -t notes/CR-$STORY_ID-Codex-Standard-*.md | head -1
ls -t notes/CR-$STORY_ID-Gemini-Standard-*.md | head -1

# Critical reviews
ls -t notes/CR-$STORY_ID-Claude-Critical-*.md | head -1
ls -t notes/CR-$STORY_ID-Codex-Critical-*.md | head -1
ls -t notes/CR-$STORY_ID-Gemini-Critical-*.md | head -1
```

Read each file.

### Phase 8: Write Synthesized Report

Write to `notes/team-review-{branch}-{TIMESTAMP}.md`:

```markdown
# Team Code Review: {branch}

**Reviewed:** {date}
**Agents:** Claude, Codex, Gemini (each ran Standard + Critical)
**Test Results:** type-check {P/F}, lint {P/F}, tests {P/F}

## Executive Summary

{2-3 sentence overview: Is this ready to merge? What are the top concerns?}

## Synthesis

### High Confidence Issues
{Issues identified by 3+ agents (across both review types) — very high signal}

### Standard Review Consensus
{Issues multiple standard reviews agreed on}

### Critical Review Findings
{Issues the critical reviews surfaced — failure modes, edge cases, security concerns}

### Worth Investigating
{Issues only one agent flagged — needs human judgment}

### Contradictions
{Any disagreements between agents}

## Combined Issues

### Blockers
{Merged and deduplicated — must fix before merge}

### Important
{Should fix — merged from all reviews}

### Consider
{Nice-to-have — merged suggestions}

## Action Items

```markdown
- [ ] {Item 1} (`file:line`) — found by: {agent(s)}, type: {standard/critical/both}
- [ ] {Item 2} (`file:line`) — found by: {agent(s)}, type: {standard/critical/both}
- [ ] DECISION: {Items needing product/team input}
```

---

<details>
<summary>Full Claude (Standard) Review</summary>

{paste}

</details>

<details>
<summary>Full Claude (Critical) Review</summary>

{paste}

</details>

<details>
<summary>Full Codex (Standard) Review</summary>

{paste}

</details>

<details>
<summary>Full Codex (Critical) Review</summary>

{paste}

</details>

<details>
<summary>Full Gemini (Standard) Review</summary>

{paste}

</details>

<details>
<summary>Full Gemini (Critical) Review</summary>

{paste}

</details>
```

---

## Fallback

If an agent fails or isn't available, proceed with successful agents. Note failures in the report.

---

Now begin. Prepare context, run tests, and orchestrate the six-agent review.
