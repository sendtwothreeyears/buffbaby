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

- [x] Brainstorm diff delivery approach — text-only (Approach A) chosen over diff-to-PNG
  - Brainstorm: `docs/brainstorms/2026-02-26-phase-5-diffs-brainstorm.md`
  - Plan: `docs/plans/2026-02-26-feat-whatsapp-code-diffs-plan.md`

- [x] Implement text diff pipeline — VM collects `git diff HEAD`, relay formats as monospace WhatsApp messages
  - VM: `collectDiffs()` in `vm/vm-server.js` — runs after every `/command`
  - Relay: `formatDiffMessage()` + `truncateAtFileBoundary()` in `server.js`
  - Error path: diffs preserved on error/timeout responses

- [ ] *(Deferred to Phase 5b/16)* Diff-to-PNG rendering for large diffs

## Notes

- **Recommended rendering approach:** `diff2html` (mature library for rendering diffs as HTML) + Playwright screenshot of the HTML page. This avoids adding native dependencies (Cairo, Pango for node-canvas) and reuses the Playwright browser already in the container.
- **Reuse the warm Playwright browser instance** from Phase 4. Don't launch a new Chromium per diff — reuse the running instance to minimize latency.
- For PNG rendering: use PNG format (sharp text rendering), not JPEG (blurry on code).
- **WhatsApp text limit:** 4096 chars per message. Diffs exceeding this should be split across messages or rendered as PNG images.
- **Triggering mechanism:** The API wrapper (Option 2 from the original plan) is the most robust approach. After each `claude -p` execution completes, the wrapper runs `git diff` and `git diff --cached`. If there are changes, it pipes each file's diff through the renderer. This keeps the triggering deterministic — no parsing of Claude Code's free-text output needed.
- The diff pipeline should be a standalone module that can be tested independently (input: diff text string → output: PNG buffer). This makes it easy to unit test and reuse.

## Review

**Status:** PASS
**Reviewed:** 2026-02-27

### Validation Results

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Command that changes code → monospace text diff in WhatsApp | PASS | `collectDiffs()` at `vm/vm-server.js:47-71` runs `git diff HEAD --no-color` after every `/command`. `formatDiffMessage()` at `server.js:105-125` wraps in triple-backtick code blocks. |
| Diffs on success, error, and timeout paths | PASS | All three `close` handler paths (`vm/vm-server.js:154-195`) include `diffs`/`diffSummary`. Relay error handler (`server.js:243-249`) extracts diffs from `err.data`. |
| No diff when no files change | PASS | `collectDiffs()` returns null when diff is empty (`vm/vm-server.js:56`). Relay skips formatting when diffs is null (`server.js:107`). |
| Truncation with summary at file boundaries | PASS | `truncateAtFileBoundary()` splits on `diff --git` headers (`server.js:90-103`). Summary line from `git diff HEAD --stat` appended (`server.js:122`). |
| Overflow to separate message when text > 4096 | PASS | `server.js:215-225` truncates text, sends with images, then sends diff as follow-up. |
| No git repo → silent failure | PASS | `collectDiffs()` catch block returns null (`vm/vm-server.js:68-70`). |
| `git diff HEAD --no-color` used | PASS | `vm/vm-server.js:49` and `vm/vm-server.js:58`. Prevents ANSI codes in WhatsApp. |
| 2-second timeout guard on diff collection | PASS | `timeout: 2000` at `vm/vm-server.js:51,60`. |
| 512KB buffer cap on diff output | PASS | `maxBuffer: 512 * 1024` at `vm/vm-server.js:52`. |
| `busy` flag cleared after response sent | PASS | `try/finally` pattern (`vm/vm-server.js:151-199`) — `finally` runs after `res.json()`. |
| Triple-backtick code blocks (no language tag) | PASS | `server.js:109-110`. |
| Visual separator (`--- Changes ---`) | PASS | `server.js:108`. |
| Truncation at file boundaries, not mid-hunk | PASS | `truncateAtFileBoundary()` splits on `"diff --git "`. Char-level fallback only when first file exceeds budget. |
| Error path diffs preserved through relay | PASS | `data: errBody` on thrown error (`server.js:279`). `err.data?.diffs` in catch (`server.js:244`). |
| End-to-end WhatsApp delivery | MANUAL | Requires live Twilio Sandbox. Code-level verification passes. |

### Code Quality

**Correctness:** The implementation precisely matches the plan. Three clean commits: VM diff collection (`3ad5928`), relay formatting (`c40d28a`), error path fix (`f0fa1ca`). The `collectDiffs()` helper is deterministic — `git diff HEAD --no-color` captures both staged and unstaged changes. The relay's budget management correctly handles all permutations: fits-in-one-message, overflow-to-second-message, text-exceeds-limit, and diffs-only (no text). The `try/finally` pattern for `busy` flag timing is correct and prevents race conditions.

**Institutional learnings applied:**
- **Buffer caps** (`docs/solutions/developer-experience/docker-vm-claude-code-headless-setup-20260225.md`): 512KB maxBuffer on `execSync` prevents OOM from massive diffs.
- **Drain on all exit paths** (`docs/solutions/integration-issues/mms-screenshot-compression-pipeline-20260226.md`): Diffs included on success, error, and timeout paths — consistent with the pattern established for `pendingImages`.
- **Transport abstraction** (`docs/solutions/developer-experience/web-chat-dev-tool-twilio-bypass-20260226.md`): `forwardToVM()` is unchanged — diff collection is VM-side, formatting is relay-side.

**No new dependencies.** No Playwright involvement. No PNG rendering. Pure text, zero overhead.

### Issues Found

- **(P3) Untracked brainstorm and plan docs.** `docs/brainstorms/2026-02-26-phase-5-diffs-brainstorm.md` and `docs/plans/2026-02-26-feat-whatsapp-code-diffs-plan.md` are not committed. Should be tracked in git.
- **(P3) Phase file task checkboxes stale.** The two tasks in the phase file (`[ ] Build standalone diff-to-PNG rendering tool` and `[ ] Integrate diff renderer with the API wrapper`) reflect the original scope before brainstorming. The brainstorm explicitly chose text-only (Approach A) and deferred PNG to Phase 5b/16. Task descriptions should be updated to reflect actual scope.

### Tech Debt

- **PNG rendering deferred.** Diff-to-PNG rendering for large diffs deferred to Phase 5b/16. Text-only approach is sufficient for now — users can ask "show me the full diff for file.ts" for details beyond truncation.
- **Working directory assumption.** `git diff HEAD` runs in VM server's `process.cwd()` (`/app`), not Claude Code's working directory. If Claude clones repos into subdirectories and works there, diffs won't be captured. Acceptable for Phase 5 — primary use case is a project mounted at `/app`.
- **Manual WhatsApp testing.** End-to-end delivery via Twilio Sandbox has not been validated. Requires live infrastructure (ngrok, Twilio Console webhook URL, sandbox join code).

### Next Steps

Phase complete. Next: **Phase 6 — End-to-End Local** (`06-phase-e2e-local.md`) — start with `/workflow:brainstorm` or `/workflow:plan`.
