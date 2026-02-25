---
name: utilities:investigate
description: "Deep bug investigation using multiple agents (Claude, Codex, Gemini) for diverse perspectives"
argument-hint: "[bug description or symptom]"
---

# Investigate

Deep bug investigation using multiple agents for diverse perspectives.

**Usage:** `/utilities:investigate [bug description or symptom]`

**Example:** `/utilities:investigate push notifications not arriving for follow request approvals`

---

## Phase 1: Prepare Context

1. Read `$ARGUMENTS` - the bug description
2. Search codebase for relevant files based on the bug description
3. Write context document to `/tmp/investigate-context.md` with:
   - Bug description
   - Relevant code snippets
   - Any error messages or logs mentioned
   - Key file paths identified

---

## Phase 2: Parallel Investigation

### 2A: Generate Investigation Prompt

Write a prompt file that all agents will read:

```bash
cat <<'EOF' > /tmp/investigate-prompt.md
# Bug Investigation Task

## Bug Description
[from $ARGUMENTS]

## Context
Read the context file at: /tmp/investigate-context.md

## Your Task
1. Trace code paths that could cause this issue
2. Identify potential root causes
3. Look for recent changes that might have introduced this
4. Find similar patterns elsewhere that work correctly

## Output
Write your findings to the output file specified below. Use markdown with:
- Likely root cause
- Confidence level (high/medium/low)
- Evidence supporting your hypothesis
- Files and line numbers to check
- Suggested fix approach
EOF
```

### 2B: Launch Three Agents

Launch three agents in parallel. Each reads the prompt file and writes to a separate output.

**Agent 1 - Claude:**
```bash
claude -p "Read /tmp/investigate-prompt.md and follow the instructions. Write your findings to /tmp/investigate-claude.md" --dangerously-skip-permissions
```

**Agent 2 - Codex:**
```bash
codex exec --full-auto --skip-git-repo-check "Read /tmp/investigate-prompt.md and follow the instructions. Write your findings to /tmp/investigate-codex.md"
```

**Agent 3 - Gemini:**
```bash
gemini -m gemini-3-pro-preview --yolo "Read /tmp/investigate-prompt.md and follow the instructions. Write your findings to /tmp/investigate-gemini.md"
```

### 2C: Handle Failures

For each agent, check if output is valid:
- If agent failed or returned empty output, note the cause:
  - Timeout
  - Command not found
  - Crash/error
  - Empty response

Include failures in the final report with:
- What failed and why
- Suggestion for preventing this in future invocations

Example suggestions:
- Timeout → "Reduce context size or increase timeout"
- Command not found → "Ensure [tool] is installed and in PATH"
- Empty response → "Check if tool requires authentication or configuration"

---

## Phase 3: Synthesis

Launch a clear Claude agent to synthesize findings (saves main thread tokens):

```bash
CLAUDECODE= claude -p "Read the investigation reports:
- /tmp/investigate-claude.md
- /tmp/investigate-codex.md
- /tmp/investigate-gemini.md

Synthesize into a unified analysis covering:
- Root cause consensus (what 2+ agents agree on)
- High confidence findings
- Individual findings with confidence levels
- Recommended fix approach
- Files to modify (with line numbers if available)
- Verification steps
- Any agent failures and how to prevent them

Write the synthesis to /tmp/investigate-synthesis.md" --dangerously-skip-permissions
```

---

## Phase 4: Present Results

Read `/tmp/investigate-synthesis.md` and present to user:

```
════════════════════════════════════════════════════════════════
BUG INVESTIGATION COMPLETE
════════════════════════════════════════════════════════════════

[Contents of synthesis]

════════════════════════════════════════════════════════════════

What would you like to do?
1. Proceed with recommended fix
2. Investigate a specific area further
3. Save report and exit
```

---

Now begin the investigation.
