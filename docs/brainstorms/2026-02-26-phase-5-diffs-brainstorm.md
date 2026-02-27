---
date: 2026-02-26
topic: phase-5-diffs
phase: 5
condensed: true
original: archive/brainstorms/2026-02-26-phase-5-diffs-brainstorm.md
---

# Phase 5: Code Diffs via WhatsApp (Condensed)

## Summary

Explored how to deliver code diffs to users via WhatsApp after Claude Code modifies files. Three approaches were evaluated: text-only diffs, text + PNG fallback, and text + message splitting. Text-only was chosen for speed and simplicity, deferring image rendering to a future phase.

## Key Decisions

- **Text-only, no PNG rendering**: Monospace diffs via triple-backtick code blocks. diff2html/Playwright deferred to Phase 5b/16.
- **Auto-detect via `git diff HEAD`**: VM server runs diff after every `/command` completion -- no reliance on Claude Code outputting diffs.
- **4096-char budget with truncation**: Diff appended to Claude's response; overflow goes to a second message; large diffs truncated with a summary line (e.g., "...and 3 more files (+78/-34 lines)").
- **VM server owns diff logic**: `vm-server.js` runs diff, parses per-file, formats monospace, returns `diffs` field in JSON response. Relay handles formatting/truncation.
- **Per-file diffs combined into one message**: Each file is a separate block but sent together (not one message per file).

## Outcomes

- Zero new dependencies required for Phase 5
- PNG rendering deferred but available as upgrade path if text proves insufficient
- All design questions resolved during brainstorm -- no open items carried forward

## Status

Completed / Implemented in Phase 5
