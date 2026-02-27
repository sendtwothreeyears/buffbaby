---
module: Relay
date: 2026-02-27
problem_type: best_practice
component: diff_pipeline
symptoms:
  - "User runs a command that modifies code but receives only Claude's text response"
  - "No visibility into what files were changed or what the diff looks like"
  - "Users must send follow-up messages to inspect changes"
root_cause: "VM-to-relay pipeline had no mechanism to capture and transmit git diffs after command execution"
resolution_type: code_fix
severity: medium
tags: [git-diff, whatsapp, truncation, formatting, error-paths, budget-aware, text-pipeline]
---

# Best Practice: Text-Based Diff Pipeline for WhatsApp

## Problem

Users had no visibility into code changes made by Claude Code when executing commands via WhatsApp. They received Claude's text response and screenshots, but the actual diff was invisible — forcing blind trust or follow-up questions like "what did you change?" Phase 5 implemented automatic git diff capture on the VM and WhatsApp-optimized formatting on the relay to close the inspect-approve loop.

## Environment

- Module: Relay Server (`server.js`) + VM Server (`vm/vm-server.js`)
- Affected Component: diff_pipeline (new)
- Date: 2026-02-27

## Symptoms

- User runs a command that modifies code (e.g., "fix the bug", "add logging")
- WhatsApp returns only the AI's text response and any screenshots
- No indication of which files were changed or what the changes look like
- User must ask "what did you change?" as a follow-up to inspect

## What Didn't Work

**Attempted: Text + PNG Rendering (Approach B)**
- Why it failed: Adds diff2html dependency, requires Playwright rendering (latency), introduces warm browser management complexity. Overkill for a phone-screen use case where monospace text is readable.

**Attempted: Text + Message Splitting (Approach C)**
- Why it failed: WhatsApp doesn't guarantee display order for rapid-fire messages. A diff split mid-hunk across bubbles is confusing. Splitting logic adds complexity for little product value on a phone screen.

**Attempted: Parse Claude Code output for diffs**
- Why it failed: Fragile — Claude Code might not include diffs, or users might run custom scripts. The VM server needs to detect diffs autonomously.

## Solution

**Approach chosen: Text-only diffs with smart truncation.** Two components, separated by concern: VM collects raw data, relay formats for transport.

### 1. VM Server: Autonomous Diff Collection

`collectDiffs()` runs `git diff HEAD --no-color` after every `/command` completion:

```javascript
// vm/vm-server.js:47-71
function collectDiffs() {
  try {
    const diff = execSync("git diff HEAD --no-color", {
      cwd: process.cwd(),
      timeout: 2000,
      maxBuffer: 512 * 1024,
      encoding: "utf-8",
    });

    if (!diff.trim()) return null;

    const summary = execSync("git diff HEAD --stat --no-color", {
      cwd: process.cwd(),
      timeout: 2000,
      maxBuffer: 64 * 1024,
      encoding: "utf-8",
    });

    const summaryLine = summary.trim().split("\n").pop()?.trim() || "";
    return { diff, summary: summaryLine };
  } catch {
    return null;
  }
}
```

Key decisions:
- `--no-color` strips ANSI escape sequences that render as garbage in WhatsApp
- 2-second timeout prevents blocking the response
- 512KB maxBuffer caps OOM risk from massive diffs
- Silent failure on all error paths (no git repo, empty repo, timeout)

Integrated on **all three exit paths** (success, error, timeout) inside `child.on("close")`:

```javascript
// vm/vm-server.js:151-199
try {
  const diffResult = collectDiffs();

  if (timedOut) {
    // ... includes diffs: diffResult?.diff, diffSummary: diffResult?.summary
  }
  if (code !== 0) {
    // ... includes diffs: diffResult?.diff, diffSummary: diffResult?.summary
  }
  // success path also includes diffs
} finally {
  busy = false;
  activeChild = null;
}
```

### 2. Relay Server: WhatsApp-Optimized Formatting

`truncateAtFileBoundary()` splits at semantic boundaries:

```javascript
// server.js:90-103
function truncateAtFileBoundary(diff, maxChars) {
  const FILE_HEADER = "diff --git ";
  const files = diff.split(FILE_HEADER).filter(Boolean);
  let result = "";
  for (const file of files) {
    const entry = FILE_HEADER + file;
    if (result.length + entry.length > maxChars) break;
    result += entry;
  }
  return result || diff.substring(0, maxChars);
}
```

`formatDiffMessage()` wraps in triple-backtick code blocks with budget awareness:

```javascript
// server.js:105-125
function formatDiffMessage(diffs, diffSummary, budget) {
  if (!diffs) return null;
  const SEPARATOR = "\n\n--- Changes ---\n";
  const CODE_OPEN = "```\n";
  const CODE_CLOSE = "\n```";
  const OVERHEAD = SEPARATOR.length + CODE_OPEN.length + CODE_CLOSE.length;
  const TRUNCATION_RESERVE = 60;
  const availableBudget = budget - OVERHEAD - TRUNCATION_RESERVE;

  if (availableBudget <= 0) return null;
  if (diffs.length <= availableBudget) {
    return SEPARATOR + CODE_OPEN + diffs + CODE_CLOSE;
  }
  const truncatedDiff = truncateAtFileBoundary(diffs, availableBudget);
  const summaryText = diffSummary ? `\n${diffSummary}` : "";
  return SEPARATOR + CODE_OPEN + truncatedDiff + CODE_CLOSE + summaryText;
}
```

Message flow logic (server.js:191-225):
- **Fits in one:** Claude's text + diff both under 4096 chars → single message
- **Overflow:** Text fits, text + diff exceeds → text in message 1, diff in message 2
- **Text too long:** Truncate text → message 1, diff → message 2
- **Error path:** Diffs from error/timeout responses sent as follow-up message

```javascript
// server.js:243-249 — error path preservation
if (err.data?.diffs) {
  const errorDiff = formatDiffMessage(err.data.diffs, err.data.diffSummary, MAX_MSG);
  if (errorDiff) {
    await sendMessage(from, errorDiff.substring(0, MAX_MSG));
  }
}
```

## Why This Works

1. **Speed:** ~50ms latency added. No Playwright, no image processing, no new dependencies.
2. **Simplicity:** Pure text in WhatsApp's native monospace format. Zero rendering overhead.
3. **Robustness:** Silent failure on all error paths. VM never blocks waiting for diffs.
4. **Autonomous:** VM captures diffs unconditionally — not reliant on Claude Code emitting them.
5. **Transport-agnostic collection:** VM returns raw data; relay owns WhatsApp-specific formatting.

## Prevention

### Reusable Patterns Established

**1. Deterministic Feature Detection (vs. Parsing Output)**
- Query the system directly (`git diff HEAD`) rather than parsing tool output
- Works across all exit paths without relying on well-formed subprocess output

**2. Drain Accumulated State on All Exit Paths**
- Reset on entry (`pendingImages = []`), drain on every exit (success, error, timeout)
- Use try/finally to guarantee cleanup
- Same pattern as `pendingImages` from Phase 4

**3. Defensive Subprocess Execution**
- Every `execSync()` gets: timeout (2s), maxBuffer (512KB), try-catch returning null
- Log failures but don't throw — user gets a response, diff is best-effort

**4. Transport-Layer Budget Awareness**
- Calculate `availableBudget = maxLimit - overhead - reserve` before formatting
- Truncate at semantic boundaries (file headers), not arbitrary positions
- Append summary metadata when truncating so users know what was cut

**5. Separate Collection from Formatting**
- VM collects raw data → relay formats for transport
- Decouples concerns; adding a new transport (Telegram, web) only changes relay formatting

**6. Include Partial Results on Error Paths**
- Claude often modifies files before failing (edits code → runs tests → tests fail)
- Without error-path diffs, users have no idea what changed before the failure

## Related Issues

- See also: [Screenshot Pipeline Architecture](../best-practices/screenshot-pipeline-architecture-playwright-relay-whatsapp-20260226.md) — Establishes the drain-on-all-exit-paths pattern for `pendingImages`, transport-agnostic API design, and relay proxy architecture
- See also: [MMS Screenshot Compression Pipeline](../integration-issues/mms-screenshot-compression-pipeline-20260226.md) — Covers error path handling for partial results, iterative quality cascade, and WhatsApp media constraints
- See also: [Docker VM Claude Code Headless Setup](../developer-experience/docker-vm-claude-code-headless-setup-20260225.md) — Process management patterns, stdout/stderr buffer caps, and path traversal protection
