---
title: "feat: WhatsApp Code Diffs (Phase 5)"
type: feat
status: completed
date: 2026-02-26
brainstorm: docs/brainstorms/2026-02-26-phase-5-diffs-brainstorm.md
---

# feat: WhatsApp Code Diffs (Phase 5)

## Overview

After Claude Code executes a command that changes code, the user automatically receives a monospace text diff in WhatsApp showing exactly what changed. The VM server detects uncommitted git changes via `git diff HEAD --no-color` after each `/command` execution and includes formatted diff output in the JSON response. The relay server handles WhatsApp-specific formatting, 4096-char budget management, and truncation.

## Problem Statement / Motivation

Users currently have no visibility into what code changes Claude Code made. They see Claude's text response ("I added error handling to server.js") but not the actual diff. This forces users to ask follow-up questions like "show me the changes" or blindly trust that the changes are correct. For a WhatsApp-based development cockpit, immediate diff feedback after every command is essential — it closes the inspect-approve loop without requiring a laptop.

## Proposed Solution

Text-only diffs appended to WhatsApp messages. Two components change:

1. **VM server** (`vm/vm-server.js`) — runs `git diff HEAD --no-color` after every `/command` completion, returns raw diff + summary stats in the JSON response.
2. **Relay server** (`server.js`) — formats diffs with monospace code blocks, manages the 4096-char budget, handles truncation with summary, and sends overflow diffs as follow-up messages.

No new dependencies. No PNG rendering. No Playwright involvement.

## Technical Approach

### VM Server Changes (`vm/vm-server.js`)

**Insertion point:** After `child.on("close")` fires (line 117), before `res.json()` (line 156). Also update the import on line 2 to include `execSync`: `const { spawn, execSync } = require("child_process");`

#### New: `collectDiffs()` helper function

```javascript
// vm/vm-server.js — new helper
async function collectDiffs() {
  try {
    const diff = execSync("git diff HEAD --no-color", {
      cwd: process.cwd(),
      timeout: 2000,       // 2s guard — don't block response if git hangs
      maxBuffer: 512 * 1024, // 512KB cap on diff output
      encoding: "utf-8",
    });

    if (!diff.trim()) return null;

    const summary = execSync("git diff HEAD --stat --no-color", {
      cwd: process.cwd(),
      timeout: 2000,
      maxBuffer: 64 * 1024,
      encoding: "utf-8",
    });

    // Extract the summary line (last non-empty line of --stat output)
    const summaryLine = summary.trim().split("\n").pop()?.trim() || "";

    return { diff: diff, summary: summaryLine };
  } catch {
    // No git repo, empty repo (no HEAD), permission error, timeout — all treated as "no diffs"
    return null;
  }
}
```

**Key design decisions:**
- `execSync` with 2-second timeout — git diff is fast (<100ms typically), but a timeout guard prevents hangs from blocking the response
- `--no-color` — prevents ANSI escape sequences in output (would render as garbage in WhatsApp)
- `process.cwd()` — runs in the VM server's working directory (`/app`). If no git repo exists there, `git diff HEAD` fails and `catch` returns null
- `512KB` max buffer — prevents OOM from massive diffs (institutional learning: cap output buffers)
- Separate `--stat` call — provides clean truncation summary data without parsing diff syntax

#### Modified: Response JSON structure

The three `close` handler response paths (success, error, timeout) include diffs. The spawn `error` event (line 103) is a separate path where no code has run — no diffs needed there:

```javascript
// Success path (currently line 156)
const diffResult = await collectDiffs();
res.json({
  text: textOut,
  images,
  diffs: diffResult?.diff || undefined,
  diffSummary: diffResult?.summary || undefined,
  exitCode: 0,
  durationMs,
});

// Error path (currently lines 139-150) — same pattern
// Timeout path (currently lines 126-137) — same pattern
```

**Why include diffs on error/timeout paths:** Claude Code can modify files and then fail (e.g., edits code, runs tests, tests fail with exit code 1). The files are changed but without diffs on the error path, the user has no idea what changed.

#### Modified: `busy` flag timing

Move `busy = false` to AFTER `res.json()` (currently at line 119, before response). This prevents a race condition where a new `/command` arrives during diff collection.

```javascript
child.on("close", async (code) => {
  // ... existing logic ...
  const diffResult = await collectDiffs();
  // ... res.json() ...
  busy = false;      // Move here — command not truly done until response sent
  activeChild = null;
});
```

#### Modified: `close` handler becomes async

The `close` callback needs to be `async` to `await collectDiffs()`. Wrap the handler body in try/catch to prevent unhandled promise rejections (Node.js async event handler caveat).

### Relay Server Changes (`server.js`)

**Insertion point:** Lines 150-155, the current truncation + send logic.

#### New: `formatDiffMessage()` helper function

```javascript
// server.js — new helper
function formatDiffMessage(diffs, diffSummary, budget) {
  if (!diffs) return null;

  const SEPARATOR = "\n\n--- Changes ---\n";
  const CODE_OPEN = "```\n";
  const CODE_CLOSE = "\n```";
  const OVERHEAD = SEPARATOR.length + CODE_OPEN.length + CODE_CLOSE.length;

  // Reserve space for potential truncation summary
  const TRUNCATION_RESERVE = 60; // "...and N more files (X insertions, Y deletions)"
  const availableBudget = budget - OVERHEAD - TRUNCATION_RESERVE;

  if (availableBudget <= 0) return null; // No room for any diff content

  if (diffs.length <= availableBudget) {
    // Full diff fits
    return SEPARATOR + CODE_OPEN + diffs + CODE_CLOSE;
  }

  // Truncate at the last complete file boundary that fits
  const truncatedDiff = truncateAtFileBoundary(diffs, availableBudget);
  const summaryText = diffSummary
    ? `\n${diffSummary}`
    : "";

  return SEPARATOR + CODE_OPEN + truncatedDiff + CODE_CLOSE + summaryText;
}
```

#### New: `truncateAtFileBoundary()` helper

```javascript
// server.js — new helper
function truncateAtFileBoundary(diff, maxChars) {
  // Split on "diff --git" file boundaries
  const FILE_HEADER = "diff --git ";
  const files = diff.split(FILE_HEADER).filter(Boolean);

  let result = "";
  let includedFiles = 0;

  for (const file of files) {
    const entry = FILE_HEADER + file;
    if (result.length + entry.length > maxChars) break;
    result += entry;
    includedFiles++;
  }

  return result || diff.substring(0, maxChars); // Fallback: cut at char limit if even first file doesn't fit
}
```

#### Modified: Message sending logic (lines 150-155)

Replace the current truncation logic with diff-aware budget management:

```javascript
if (data.text || data.diffs) {
  const MAX_MSG = 4096;
  let responseText = data.text || "";
  const diffs = data.diffs;
  const diffSummary = data.diffSummary;

  // Case 1: Claude's text fits within limit — try to append diffs
  if (responseText.length <= MAX_MSG && diffs) {
    const diffBudget = MAX_MSG - responseText.length;
    const diffFormatted = formatDiffMessage(diffs, diffSummary, diffBudget);

    if (diffFormatted && responseText.length + diffFormatted.length <= MAX_MSG) {
      // Diff fits in same message
      responseText += diffFormatted;
    } else if (diffFormatted) {
      // Diff overflows — send as follow-up
      const truncatedResponse = responseText.length > MAX_MSG
        ? responseText.substring(0, MAX_MSG - 22) + "\n\n[Response truncated]"
        : responseText;
      await sendMessage(from, truncatedResponse, mediaUrls);
      const overflowDiff = formatDiffMessage(diffs, diffSummary, MAX_MSG);
      if (overflowDiff) {
        await sendMessage(from, overflowDiff.substring(0, MAX_MSG));
      }
      return; // Already sent both messages
    }
  }

  // Case 2: Claude's text alone exceeds limit — truncate text, send diff separately
  if (responseText.length > MAX_MSG) {
    responseText = responseText.substring(0, MAX_MSG - 22) + "\n\n[Response truncated]";
    await sendMessage(from, responseText, mediaUrls);
    if (diffs) {
      const overflowDiff = formatDiffMessage(diffs, diffSummary, MAX_MSG);
      if (overflowDiff) {
        await sendMessage(from, overflowDiff.substring(0, MAX_MSG));
      }
    }
    return;
  }

  // Case 3: No diffs or everything fits in one message
  await sendMessage(from, responseText, mediaUrls);
}
```

### Edge Cases Handled

| Edge Case | Behavior |
|-----------|----------|
| No git repo | `git diff HEAD` fails → `collectDiffs()` returns null → no diffs sent |
| Empty repo (no commits) | `git diff HEAD` fails (`unknown revision 'HEAD'`) → same as above |
| Binary files | `git diff` outputs `"Binary files differ"` line → safe for WhatsApp |
| Huge diff (>512KB) | `maxBuffer` cap → `collectDiffs()` catches error → no diffs (user asks for specific file diff) |
| Claude commits changes | `git diff HEAD` returns empty → no diffs (correct — changes are committed) |
| Merge conflicts | `git diff HEAD` shows conflict markers → useful for user |
| WhatsApp formatting chars in diff | Triple backtick code blocks prevent formatting interpretation |
| `git diff` hangs | 2-second timeout → `collectDiffs()` returns null → response sent without diffs |
| No changes made | `diffs` field omitted → relay sends Claude's text only |
| Claude's text > 4096 | Text truncated in message 1, diffs in message 2 |

## Acceptance Criteria

- [x] After a `/command` that modifies files, the WhatsApp response includes a monospace diff showing changes
- [x] Diffs appear on success, error (non-zero exit), and timeout paths
- [x] When no files change, no diff section is added to the message
- [x] When combined text + diff exceeds 4096 chars, diff is truncated with a summary (e.g., `"3 files changed, 78 insertions(+), 34 deletions(-)"`)
- [x] When Claude's text alone exceeds 4096, diff is sent as a separate follow-up message
- [x] When no git repo exists, diff collection fails silently (no error, no diff section)
- [x] `git diff HEAD --no-color` is used (prevents ANSI codes in output)
- [x] Diff collection has a 2-second timeout guard
- [x] Diff output is capped at 512KB buffer
- [x] `busy` flag is not cleared until after response is sent
- [x] Diffs are wrapped in triple-backtick code blocks (no language tag)
- [x] A visual separator (`--- Changes ---`) divides Claude's text from the diff
- [x] Truncation occurs at file boundaries, not mid-hunk

## Files to Modify

| File | Changes |
|------|---------|
| `vm/vm-server.js` | Add `execSync` to import, add `collectDiffs()` helper, call on all `close` handler exit paths, add `diffs`/`diffSummary` to response JSON, fix `busy` flag timing, make `close` handler async |
| `server.js` | Add `formatDiffMessage()` and `truncateAtFileBoundary()` helpers, replace truncation logic with diff-aware budget management |

## Dependencies & Risks

**Dependencies:** None — git is already in the container, no new npm packages needed.

**Risks:**
- **Working directory assumption:** `git diff HEAD` runs in the VM server's `process.cwd()` (`/app`), not Claude Code's working directory. If Claude Code clones repos into subdirectories and works there, the VM server's cwd doesn't follow — diffs won't be captured unless `/app` itself is a git repo containing the changes. This is acceptable for Phase 5 — the primary use case is a project mounted at `/app`. Future phases can pass Claude Code's cwd back in the response to use for diff collection.
- **WhatsApp message ordering:** When diffs overflow to a second message, WhatsApp doesn't guarantee display order for rapid-fire messages. Acceptable risk — two messages (text + diff) are far less confusing than multi-message splits.

## Success Metrics

- Users receive diffs in <200ms additional latency after command completion
- Diffs are readable on phone screens (monospace code blocks render correctly)
- No error states introduced (all git failures handled silently)

## References

- Brainstorm: `docs/brainstorms/2026-02-26-phase-5-diffs-brainstorm.md`
- Architecture: `ARCHITECTURE.md` (lines 56-66, 94)
- VM server insertion point: `vm/vm-server.js:117-156`
- Relay insertion point: `server.js:150-155`
- Response JSON contract: `vm/vm-server.js:156` → extends to `{ text, images, diffs, diffSummary, exitCode, durationMs }`
- WhatsApp constraints: 4096-char limit, 1 media per message, triple-backtick monospace support
