---
phase: 5
condensed: true
original: archive/plans/2026-02-26-feat-whatsapp-code-diffs-plan.md
---

# Phase 5: WhatsApp Code Diffs (Condensed)

**Stage:** Local Development
**Depends on:** Phase 4 (Screenshots)
**Done when:** After a `/command` that modifies files, a monospace diff appears in the WhatsApp response, truncated at file boundaries with summary stats when exceeding 4096 chars.

## Summary

Added automatic git diff delivery to WhatsApp after every Claude Code command. The VM server runs `git diff HEAD --no-color` after `/command` execution and returns raw diff + summary stats. The relay server formats diffs in monospace code blocks, manages a 4096-char budget, truncates at file boundaries, and sends overflow diffs as follow-up messages.

## Key Deliverables

- `collectDiffs()` helper in VM server using `execSync` with 2s timeout and 512KB buffer cap
- Diffs returned on success, error, and timeout response paths
- `formatDiffMessage()` and `truncateAtFileBoundary()` helpers in relay server
- Budget-aware message sending: inline diffs when they fit, follow-up messages when they overflow
- Visual separator (`--- Changes ---`) between Claude's text and diff output

## Key Technical Decisions

- **Text-only diffs (no PNG rendering)**: Monospace code blocks in WhatsApp are readable on phone screens and require no new dependencies
- **`git diff HEAD --no-color`**: Prevents ANSI escape codes; runs against HEAD so uncommitted changes are captured
- **Truncation at file boundaries**: Avoids cutting mid-hunk; falls back to char limit if even the first file doesn't fit
- **Diffs on error/timeout paths**: Claude Code can modify files before failing; user needs visibility into partial changes
- **`busy` flag moved after `res.json()`**: Prevents race condition where new command arrives during diff collection

## Status

Completed
