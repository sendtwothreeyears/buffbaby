# Phase 5: Diffs

**Stage:** Local Development
**Depends on:** Phase 4 (Screenshots — image pipeline must already work)
**Done when:** You text a command that changes code (e.g., "add a console.log to index.ts"), you receive a syntax-highlighted diff image on your phone.

## What You Build

A diff-to-PNG rendering pipeline inside the Docker container. When Claude Code makes code changes, the API wrapper detects uncommitted changes (via `git status`), generates syntax-highlighted PNG images of the diffs, and includes them in the response's `images` array. The relay sends the diff images via Twilio MMS.

This phase adds one new capability: **code changes are visible as images**.

Deliverables:
- Standalone diff-to-PNG rendering tool inside the Docker container (input: diff text, output: PNG file saved via ImageStore)
- Integration with the API wrapper: after each `/command` execution, the wrapper checks for uncommitted changes and auto-generates diff PNGs
- Diff images served via the existing `images` array in the structured JSON response
- Images are high-resolution (2x retina, ~750px wide minimum) and readable when pinch-to-zoomed on a phone
- Each changed file gets its own diff image. Composite images for large diffs (> 5 files) deferred to Phase 16.

## Tasks

- [ ] Build standalone diff-to-PNG rendering tool — input: diff text, output: syntax-highlighted PNG
  - Brainstorm: `/workflow:brainstorm diff-to-PNG rendering approaches — what tool/library renders syntax-highlighted diffs as images?`
  - Plan: `/workflow:plan standalone diff-to-PNG renderer — git diff to syntax-highlighted PNG`
  - Ship: `/workflow:ship docs/plans/YYYY-MM-DD-feat-diff-renderer-plan.md`

- [ ] Integrate diff renderer with the API wrapper — auto-detect code changes after each command, generate diff PNGs, include in structured response
  - Plan: `/workflow:plan diff pipeline integration — API wrapper auto-generates diff images after code changes`
  - Ship: `/workflow:ship docs/plans/YYYY-MM-DD-feat-diff-integration-plan.md`

## Notes

- **Recommended rendering approach:** `diff2html` (mature library for rendering diffs as HTML) + Playwright screenshot of the HTML page. This avoids adding native dependencies (Cairo, Pango for node-canvas) and reuses the Playwright browser already in the container.
- **Reuse the warm Playwright browser instance** from Phase 4. Don't launch a new Chromium per diff — reuse the running instance to minimize latency.
- Diff images must use PNG format (sharp text rendering), not JPEG (blurry on code).
- **Image size limits:** A single-file diff of a large file could exceed the 1MB MMS limit as a PNG. Strategy: truncate long diffs with a "... N more lines" indicator, or split into multiple images. Cap at ~200 lines per diff image.
- **Triggering mechanism:** The API wrapper (Option 2 from the original plan) is the most robust approach. After each `claude -p` execution completes, the wrapper runs `git diff` and `git diff --cached`. If there are changes, it pipes each file's diff through the renderer. This keeps the triggering deterministic — no parsing of Claude Code's free-text output needed.
- The diff pipeline should be a standalone module that can be tested independently (input: diff text string → output: PNG buffer). This makes it easy to unit test and reuse.
