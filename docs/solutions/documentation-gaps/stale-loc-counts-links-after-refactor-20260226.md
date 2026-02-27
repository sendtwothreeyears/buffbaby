---
module: Documentation
date: 2026-02-26
problem_type: documentation_gap
component: docs
symptoms:
  - "Relay server LOC count reported as 64 in docs, actually 68 after /health endpoint added"
  - "References to Playwright MCP remained after codebase refactored to Playwright CLI"
  - "Total LOC estimate ~220 in CONTRIBUTING.md, actually ~225"
  - "Stale external link to Authentic's Agentic Engineering Techniques in PRD"
root_cause: "Documentation was not updated in sync with incremental code changes; without a review gate that cross-checks docs against code at merge time, stale content accumulates silently"
resolution_type: documentation_update
severity: low
tags: [documentation, stale-references, loc-count, playwright, open-source, drift, docs-maintenance, phase-2]
---

# Troubleshooting: Stale Documentation References After Code Refactors

## Problem

Five documentation files contained stale values after two code refactors — a `/health` endpoint addition and a Playwright MCP-to-CLI migration. The drift was only caught during a manual re-review for open-source release preparation, not at the time of the original changes.

## Environment

- **Module:** Documentation
- **Component:** README.md, ARCHITECTURE.md, CLAUDE.md, CONTRIBUTING.md, PRD
- **Date:** 2026-02-26
- **Phase:** 2 (Docker) — discovered during open-source release re-review
- **Triggering commits:** `5556258` (added /health endpoint, +4 LOC), `177f86f` (Playwright MCP → CLI refactor)

## Symptoms

- README, ARCHITECTURE, and CLAUDE.md all claimed relay server was "64 LOC" — actually 68
- ARCHITECTURE.md and PRD referenced "Playwright MCP" — tool had been refactored to Playwright CLI
- CONTRIBUTING.md claimed "~220 LOC across two servers" — actually ~225
- PRD contained stale link to "Authentic's Agentic Engineering Techniques"

## What Didn't Work

**Direct solution:** The drift was identified and fixed on the first attempt via `grep -r` across all docs. No failed approaches — the problem was detection, not repair.

## Solution

After the refactoring commits, grep across all documentation files for the old values and update them:

```bash
# Find stale LOC references
grep -rn "64 LOC" docs/ CLAUDE.md ARCHITECTURE.md README.md CONTRIBUTING.md

# Find stale tool references
grep -rn "Playwright MCP" docs/ CLAUDE.md ARCHITECTURE.md README.md

# Update all hits in the same commit
```

**Files updated (commit `8642ea6`):**

| File | Old Value | New Value |
|------|-----------|-----------|
| README.md | `server.js` (64 LOC) | `server.js` (68 LOC) |
| ARCHITECTURE.md | `server.js` (64 LOC) | `server.js` (68 LOC) |
| CLAUDE.md | `server.js`, 64 LOC | `server.js`, 68 LOC |
| CONTRIBUTING.md | ~220 LOC | ~225 LOC |
| CLAUDE.md | Playwright MCP | Playwright |
| ARCHITECTURE.md | Playwright MCP | Playwright |
| PRD | Authentic's Agentic Engineering Techniques | Accurate internal reference |

## Why This Works

1. **ROOT CAUSE:** Two commits modified code without triggering corresponding documentation updates. The /health endpoint added 4 LOC to the relay server, and the Playwright refactor renamed the integration — but neither commit touched the docs that referenced these values.

2. **Why the solution works:** Mechanically grepping for old values across all markdown files catches every stale reference. The fix is simple search-and-replace, but the discipline of doing it after every structural change is what prevents accumulation.

3. **Underlying issue:** LOC counts, component names, and external URLs in documentation are "soft references" — the toolchain has no way to know they're stale. This makes them a category of technical debt that is easy to introduce (any refactor) and invisible until a reader or reviewer notices.

## Prevention

### Documentation Integrity Checklist

Before merging any PR that renames, removes, or significantly changes a component:

- [ ] `grep -r "OldName" docs/ CLAUDE.md ARCHITECTURE.md README.md` — update all hits
- [ ] If LOC counts are referenced and files were changed, verify counts are still accurate
- [ ] External links are still valid (spot-check changed areas)
- [ ] CLAUDE.md key files table matches actual repo contents

### PR Template Addition

```markdown
- [ ] Documentation updated to reflect this change
- [ ] No hardcoded metrics (LOC counts, file counts) left stale
- [ ] All tool/service references match the current implementation
```

### Patterns

**"Change the name in one place, grep for the rest."** Whenever a component is renamed or replaced, the first action after the code change is `grep -r "OldName" .` — treat any doc hit as a required fix, not optional cleanup.

**"Reference by role, not by implementation detail."** Prefer "Playwright handles screenshot capture" over "Playwright MCP v1.3.2 handles screenshot capture via the mcp__playwright__screenshot tool." The first survives refactors; the second doesn't.

**"Docs review is part of code review."** If a PR adds an endpoint and CLAUDE.md's key files table wasn't touched, that's a code review comment — not optional feedback.

### Consider: Avoid Hardcoded LOC Counts

LOC counts go stale on every commit. Consider replacing them with descriptions of responsibility instead:

- Instead of: "Relay server (`server.js`, 68 LOC)"
- Write: "Relay server (`server.js`) — receives Twilio webhooks, authenticates, sends WhatsApp messages"

If LOC counts are genuinely useful, generate them via script rather than hardcoding in prose.

## Related Issues

- See also: [Docker VM with Claude Code Headless Setup](../developer-experience/docker-vm-claude-code-headless-setup-20260225.md) — Phase 2 primary solution doc (includes documentation sync prevention notes)
- See also: [Docker Compose Memory Limit Ignored](../developer-experience/docker-compose-mem-limit-ignored-swarm-only-20260226.md) — discovered during the same re-review
