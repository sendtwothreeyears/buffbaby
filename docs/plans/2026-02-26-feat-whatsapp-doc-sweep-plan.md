---
title: "Phase 4.3: WhatsApp-Only Documentation Sweep"
type: feat
status: active
date: 2026-02-26
brainstorm: docs/brainstorms/2026-02-26-phase-4.3-whatsapp-doc-update-brainstorm.md
---

# Phase 4.3: WhatsApp-Only Documentation Sweep

## Overview

Eliminate all SMS/MMS references from documentation across the repo. The source code is already clean (zero SMS/MMS refs). This is a docs-only sweep — no runtime changes, no code edits.

The brainstorm inventoried ~414 references across ~20 files. Research confirmed **~20 files actually need changes** (several files listed in the brainstorm were already cleaned during Phase 4.2). The actual reference count is ~300+ across those 20 files.

## Problem Statement

The app is WhatsApp-only, but documentation still contains hundreds of SMS/MMS references from the original SMS-first design. Readers see "SMS" in Phase 1 docs and "WhatsApp" in Phase 4 docs and wonder which is correct. SMS-specific constraints (160-char segments, 1MB MMS ceiling, A2P 10DLC, carrier testing) appear in acceptance criteria and graduation gates throughout the phase plans.

## Proposed Solution

Single-batch sweep. Update every file in one pass. All changes are documentation with zero runtime risk.

### Substitution Rules

| Pattern | Replacement | Notes |
|---------|-------------|-------|
| `SMS echo` / `SMS Echo Server` | `WhatsApp echo` / `WhatsApp Echo Server` | Titles and headings |
| `SMS Agentic Development Cockpit` / `SMS Agentic Cockpit` | `WhatsApp Agentic Development Cockpit` | Product name |
| `sends SMS` / `send SMS` / `sent via SMS` / `via SMS` | `sends WhatsApp message` / `send WhatsApp message` / `via WhatsApp` | Action descriptions |
| `via MMS` / `sends MMS` / `MMS image` / `MMS delivery` | `via WhatsApp` / `sends WhatsApp media` / `WhatsApp media` | Media delivery |
| `sendSMS(` / `sendMMS(` (in code blocks) | `sendMessage(` | Pseudocode function names |
| `SMS/MMS` | `WhatsApp` | Compound references |
| `1MB MMS carrier limit` / `1MB ceiling` / `1MB MMS` | Remove or replace with `16MB WhatsApp limit` | Constraint refs |
| `160-char segments` / `1600 chars` / `1500 chars` | `4096-char WhatsApp limit` | Truncation limits |
| `A2P 10DLC` / `toll-free verification` / `carrier testing` | Remove or replace with `WhatsApp Sandbox (dev) / Business API (prod)` | Compliance refs |
| `AT&T, T-Mobile, Verizon` / carrier-specific content | Remove entirely | Carrier testing |
| `out-of-order delivery` / `carrier delivery issues` | Remove (WhatsApp delivers in order) | Delivery model |

### Explicit Exclusions (Do NOT Change)

| Item | Reason |
|------|--------|
| `docs/PRD_WHATSAPP_AGENTIC_COCKPIT.md` (7 refs) | Comparative references ("~75% cheaper than SMS/MMS"). Correct as-is. |
| `docs/plans/2026-02-26-feat-whatsapp-only-pivot-plan.md` (95 refs) | Self-referential — this IS the pivot plan describing SMS→WhatsApp changes |
| `docs/brainstorms/2026-02-26-phase-4.3-whatsapp-doc-update-brainstorm.md` (42 refs) | Self-referential — this IS the brainstorm for this task |
| Twilio Console URLs containing `/sms/` | External URLs controlled by Twilio (e.g., `console.twilio.com/.../sms/...`) |
| Solution filenames (`sms-echo-server-...`, `mms-screenshot-...`) | Retain historical filenames to avoid breaking cross-references. Update display text only. |
| `notes/` directory | Gitignored, temporary working material |

### Link Path Safety Rule

When a file contains markdown links to solution files:
```markdown
- **SMS Echo Server Setup** (`docs/solutions/.../sms-echo-server-twilio-ngrok-setup-20260225.md`)
```
Update the **display text** ("SMS Echo Server" → "WhatsApp Echo Server") but preserve the **file path** unchanged. Mechanical find-replace of "SMS" would break these links.

## File Inventory (Verified via grep)

### Group A: Phase Plan Files (9 files, ~35 refs)

| File | Refs | Changes |
|------|------|---------|
| `docs/plans/phases/01-phase-echo.md` | ~10 | "SMS echo" → "WhatsApp echo", remove MMS test image refs, remove A2P 10DLC |
| `docs/plans/phases/03-phase-command.md` | ~13 | "SMS" → "WhatsApp", 160/1600 chars → 4096 chars, remove carrier refs |
| `docs/plans/phases/04-phase-screenshots.md` | ~2 | MMS-era constraint note, DPR fallback note |
| `docs/plans/phases/04.1-phase-web-chat.md` | ~10 | A2P/toll-free → WhatsApp Sandbox, SMS → WhatsApp throughout |
| `docs/plans/phases/06-phase-e2e-local.md` | ~2 | "SMS" → "WhatsApp" in state machine refs |
| `docs/plans/phases/08-phase-provisioning.md` | ~1 | Single "SMS" → "WhatsApp" |
| `docs/plans/phases/09-phase-onboarding.md` | ~2 | WhatsApp onboarding flow |
| `docs/plans/phases/13-phase-multi-agent.md` | ~3 | "SMS messages" → "WhatsApp messages" |
| `docs/plans/phases/14-phase-cicd.md` | ~3 | "SMS" → "WhatsApp" for build status |

### Group B: Completed Plan Files (7 files, ~150 refs)

| File | Refs | Changes |
|------|------|---------|
| `docs/plans/2026-02-25-feat-sms-echo-server-plan.md` | ~23 | SMS/MMS throughout title, code, verification |
| `docs/plans/2026-02-26-feat-connect-relay-to-vm-plan.md` | ~42 | **Heaviest file.** SMS in code blocks, `sendSMS` functions, diagrams, error handling |
| `docs/plans/2026-02-26-feat-phase-4-screenshots-plan.md` | ~27 | MMS delivery pipeline, `sendMMS` code samples |
| `docs/plans/2026-02-26-feat-web-chat-dev-tool-plan.md` | ~11 | SMS-as-bypass context |
| `docs/plans/2026-02-26-feat-whatsapp-channel-plan.md` | ~17 | Dual-channel → WhatsApp-only |
| `docs/plans/2026-02-26-feat-open-source-release-plan.md` | ~27 | Public-facing language, A2P, carrier refs |
| `docs/plans/2026-02-25-feat-docker-vm-image-plan.md` | ~3 | "SMS Agentic Cockpit" in description |

### Group C: Brainstorm Files (6 files, ~53 refs)

| File | Refs | Changes |
|------|------|---------|
| `docs/brainstorms/2026-02-26-nanoclaw-learnings-brainstorm.md` | ~9 | SMS → WhatsApp. Preserve solution file link paths. |
| `docs/brainstorms/2026-02-26-phase-4.2-whatsapp-pivot-brainstorm.md` | ~28 | **Careful edit** — discusses the pivot. Update textslash self-description, preserve comparative context describing what changed. |
| `docs/brainstorms/2026-02-25-docker-vm-image-brainstorm.md` | ~1 | Single "SMS Agentic Cockpit" |
| `docs/brainstorms/2026-02-26-open-source-release-brainstorm.md` | ~17 | **Strategic rewrite needed** — entire framing is SMS-first. Not just term substitution. |
| `docs/brainstorms/2026-02-26-phase-4-screenshots-brainstorm.md` | ~5 | MMS pipeline refs |
| `docs/brainstorms/2026-02-26-phase-3-command-brainstorm.md` | ~3 | SMS → WhatsApp |

### Group D: Root / Config Files (4 files, ~40 refs)

| File | Refs | Changes |
|------|------|---------|
| `CLAUDE.md` | ~2 | Line 22: update `PHASE_PLAN_SMS_AGENTIC_COCKPIT.md` ref → `docs/plans/phases/00-overview.md`. Line 175: remove "(vs 1MB for MMS)". |
| `CHANGELOG.md` | ~3 | "SMS Echo Server" → "WhatsApp Echo Server", update historical entries |
| `docs/COMPETITIVE_ANALYSIS_SMS_AGENTIC.md` | ~8 | Update textslash self-description. Preserve competitor/comparative refs (external blog titles, price comparisons). Consider renaming file → `COMPETITIVE_ANALYSIS_WHATSAPP_AGENTIC.md`. |
| `docs/PHASE_PLAN_SMS_AGENTIC_COCKPIT.md` | **DELETE** | Superseded by `00-overview.md`. Update all cross-references before deleting. |

### Cross-Reference Updates (from PHASE_PLAN deletion)

These files reference `PHASE_PLAN_SMS_AGENTIC_COCKPIT.md` by name and must be updated:

| File | Line | Change |
|------|------|--------|
| `CLAUDE.md` | ~22 | `docs/PHASE_PLAN_SMS_AGENTIC_COCKPIT.md` → `docs/plans/phases/00-overview.md` |
| `docs/plans/2026-02-26-feat-open-source-release-plan.md` | ~454 | Update reference to `00-overview.md` |
| `docs/plans/2026-02-26-feat-whatsapp-only-pivot-plan.md` | ~175, ~317 | Update references (this file is in the exclusion list — update only the cross-ref paths, not the surrounding SMS context) |

## Technical Considerations

### Parallelization Strategy

Files are independent (no shared state, no code). Split into **5 parallel buckets** by effort:

| Bucket | Files | ~Refs | Focus |
|--------|-------|-------|-------|
| 1 | Phase plans: 01, 03, 04, 04.1 | ~35 | Higher-density phase files |
| 2 | Phase plans: 06, 08, 09, 13, 14 | ~11 | Low-density phase files (quick) |
| 3 | Plans: sms-echo-server, connect-relay, phase-4-screenshots, docker-vm-image | ~95 | Heavy plan files with code blocks |
| 4 | Plans: web-chat, whatsapp-channel, open-source-release + Brainstorms: open-source-release, phase-4.2-whatsapp-pivot | ~100 | Medium plans + strategic rewrites |
| 5 | Brainstorms: nanoclaw, docker-vm, phase-4-screenshots, phase-3-command + Root files: CLAUDE.md, CHANGELOG.md, COMPETITIVE_ANALYSIS, PHASE_PLAN (delete) | ~40 | Mixed bag + file deletion + cross-ref updates |

### Files Requiring Manual Judgment (Not Mechanical Replacement)

These files need per-line review, not batch find-replace:

1. **`open-source-release-brainstorm.md`** — Entire strategic framing is SMS-first. Needs section rewrites.
2. **`phase-4.2-whatsapp-pivot-brainstorm.md`** — Discusses the pivot itself. Update self-description, preserve transition context.
3. **`COMPETITIVE_ANALYSIS_SMS_AGENTIC.md`** — Mix of textslash self-description (update) and competitor descriptions (preserve).
4. **`connect-relay-to-vm-plan.md`** — 42 refs including code blocks with `sendSMS` function names, architecture diagrams.
5. **`phase-4-screenshots-plan.md`** — MMS delivery pipeline descriptions with code samples.

## Acceptance Criteria

- [x] Zero SMS/MMS references in all updated files (per substitution rules above)
- [x] All markdown links to solution files still resolve (display text updated, paths preserved)
- [x] `docs/PHASE_PLAN_SMS_AGENTIC_COCKPIT.md` deleted; all cross-references redirected to `00-overview.md`
- [x] `CLAUDE.md` line 175 cleaned ("16MB media limit" without MMS comparison)
- [x] `CLAUDE.md` phase plan reference updated to `00-overview.md`
- [x] WhatsApp constraints used consistently: 4096-char limit, 16MB media, 24-hour session window, monospace code blocks
- [x] PRD comparative references untouched (7 refs remain intentionally)
- [x] Twilio Console URLs untouched
- [x] Solution filenames untouched
- [x] Verification grep passes (see below)

### Verification Command

```bash
# Post-sweep verification: find all remaining SMS/MMS references
grep -riwn "SMS\|MMS" --include="*.md" . \
  | grep -v "node_modules" \
  | grep -v "notes/" \
  | grep -v "PRD_WHATSAPP_AGENTIC_COCKPIT" \
  | grep -v "whatsapp-only-pivot-plan" \
  | grep -v "phase-4.3-whatsapp-doc-update-brainstorm" \
  | grep -v "console.twilio.com" \
  | grep -v "sms-echo-server-twilio-ngrok-setup" \
  | grep -v "mms-screenshot-compression-pipeline"
```

**Expected result:** Zero lines. Any remaining hits are either missed references or need to be added to the exclusion list with justification.

## Dependencies & Risks

**Dependencies:**
- None. All files are documentation. No code changes required.

**Risks:**
- **Low:** Breaking markdown links to solution files if file paths are accidentally modified during substitution
- **Low:** `COMPETITIVE_ANALYSIS_SMS_AGENTIC.md` rename could break external bookmarks (mitigate: rename in same commit as content update)
- **Minimal:** No runtime risk — all changes are `.md` files

## References

### Internal
- Brainstorm: `docs/brainstorms/2026-02-26-phase-4.3-whatsapp-doc-update-brainstorm.md`
- Phase overview: `docs/plans/phases/00-overview.md`
- PRD: `docs/PRD_WHATSAPP_AGENTIC_COCKPIT.md`

### Institutional Learnings Applied
- **Stale documentation after refactors** (`docs/solutions/documentation-gaps/stale-loc-counts-links-after-refactor-20260226.md`): Use grep mechanically to find all references. Batch all related updates into a single commit.
- **Transport abstraction** (`docs/solutions/developer-experience/`): The VM doesn't know or care about WhatsApp. Docs should emphasize the transport-agnostic `forwardToVM()` pattern.
