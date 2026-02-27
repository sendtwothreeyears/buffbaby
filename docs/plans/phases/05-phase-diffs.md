# Phase 5: Diffs

**Stage:** Local Development
**Depends on:** Phase 4 (Screenshots — image pipeline must already work)
**Done when:** You send a command that changes code (e.g., "add a console.log to index.ts"), you receive a monospace text diff on your phone via WhatsApp.

## What You Build

A diff rendering pipeline inside the Docker container. When Claude Code makes code changes, the API wrapper detects uncommitted changes (via `git status`) and includes diff content in the response. For small diffs, monospace text is sent directly as WhatsApp messages (WhatsApp supports triple-backtick code blocks). For large diffs (50+ lines), a diff-to-PNG rendering pipeline generates images.

This phase adds one new capability: **code changes are visible**.

Deliverables:
- **Primary:** Monospace text diffs sent as WhatsApp messages (triple-backtick formatting)
- **Secondary (large diffs):** Standalone diff-to-PNG rendering tool inside the Docker container (input: diff text, output: PNG file saved via ImageStore). Deferred to Phase 5b/16 if monospace diffs prove sufficient.
- Integration with the API wrapper: after each `/command` execution, the wrapper checks for uncommitted changes and auto-generates diff output
- Diff content served via the existing structured JSON response
- Each changed file gets its own diff. Composite images for large diffs (> 5 files) deferred to Phase 16.

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
- For PNG rendering: use PNG format (sharp text rendering), not JPEG (blurry on code).
- **WhatsApp text limit:** 4096 chars per message. Diffs exceeding this should be split across messages or rendered as PNG images.
- **Triggering mechanism:** The API wrapper (Option 2 from the original plan) is the most robust approach. After each `claude -p` execution completes, the wrapper runs `git diff` and `git diff --cached`. If there are changes, it pipes each file's diff through the renderer. This keeps the triggering deterministic — no parsing of Claude Code's free-text output needed.
- The diff pipeline should be a standalone module that can be tested independently (input: diff text string → output: PNG buffer). This makes it easy to unit test and reuse.
