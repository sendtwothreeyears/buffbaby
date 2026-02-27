---
date: 2026-02-26
topic: phase-5-diffs
---

# Phase 5: Code Diffs via WhatsApp

## What We're Building

After Claude Code executes a command that changes code, the user automatically receives a monospace text diff in WhatsApp showing exactly what changed. The VM server detects uncommitted git changes after each `/command` execution and includes formatted diff output in the response. No images, no rendering pipeline — pure text, optimized for speed.

## Why This Approach

Three approaches were considered:

### Approach A: Text-only diffs (chosen)

Monospace text diffs sent as WhatsApp messages using triple-backtick code blocks. If the total response (Claude's text + diff) exceeds 4096 chars, the diff overflows into a second message. Diffs that are too large get truncated with a summary line.

**Pros:** Fastest feedback loop, zero new dependencies, simplest implementation, no Playwright/browser overhead.
**Cons:** No syntax highlighting, large diffs get truncated.

### Approach B: Text + PNG fallback (deferred)

Small diffs as text, large diffs rendered as syntax-highlighted PNG images via diff2html + Playwright.

**Pros:** Beautiful diffs for large changes.
**Cons:** Adds diff2html dependency, requires Playwright rendering (latency), warm browser management complexity. Overkill for a phone-screen use case.

### Approach C: Text + message splitting (rejected)

Split large diffs across multiple WhatsApp messages to deliver the full diff.

**Pros:** User gets every line.
**Cons:** WhatsApp doesn't guarantee display order for rapid-fire messages. A diff split mid-hunk across bubbles is confusing. Splitting logic (where to break hunks) adds complexity for little value on a phone screen.

**Why Approach A wins:** The core product thesis is WhatsApp as a control interface, not a full IDE. Speed of feedback matters most. Users can always ask Claude "show me the full diff for server.js" if truncated output isn't enough. PNG rendering can be added in Phase 5b/16 if text proves insufficient — but it likely won't.

## Key Decisions

- **Text-only, no PNG rendering:** Defer diff2html/Playwright to Phase 5b/16. No new dependencies needed.
- **Auto-detect always:** VM server runs `git diff HEAD` after every `/command` completion. This captures both staged and unstaged changes in one call. Deterministic — no reliance on Claude Code remembering to output diffs.
- **Appended to response with 4096-char budget:** Diff is appended to Claude's text response in the same WhatsApp message. The relay calculates remaining budget (`4096 - len(claude_text)`) and fits as much diff as possible. If the diff exceeds the remaining budget, it's truncated with a summary like `"...and 3 more files (+78/-34 lines)"`. If Claude's response alone exceeds 4096, the diff goes in a separate follow-up message (truncated if needed).
- **VM server owns diff logic:** `vm-server.js` runs `git diff HEAD` after each `/command`, parses per-file, formats as monospace text, and includes a new `diffs` field in the JSON response. Relay handles formatting and truncation.
- **Per-file diffs:** Each changed file's diff is a separate block in the output, but they're combined into one message (or truncated) — not one message per file.
- **No-change case:** If `git diff HEAD` returns empty, the `diffs` field is omitted or empty. No extra message sent.

## Open Questions

None — all design decisions resolved during brainstorming.

## Next Steps

> `/workflow:plan` for implementation details
