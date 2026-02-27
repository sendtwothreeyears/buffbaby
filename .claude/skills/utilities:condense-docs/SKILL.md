---
name: utilities:condense-docs
description: Condense brainstorms and plans for specified phases into summaries, archive the originals. Use when you want to compress completed phase documentation while preserving the full originals.
argument-hint: "[phase range] [dir1, dir2, ...] — e.g. '1-8 [docs/plans, docs/brainstorms]'"
---

# Condense Phase Documentation

Replace documents for completed phases with condensed summaries, archiving the full originals for reference.

## Arguments

<arguments> #$ARGUMENTS </arguments>

**Format:** `<phase_range> [<dir1>, <dir2>, ...]`

- **Phase range** (required): Which phases to condense
- **Document locations** (optional): Bracket-delimited, comma-separated list of directories to scan

**If no phase range is provided:** Ask the user which phases to condense.
**If no document locations are provided:** Default to `[docs/brainstorms, docs/plans]`.

**Examples:**
- `1-8` — phases 1-8, default directories
- `1-8 [docs/plans, docs/brainstorms]` — phases 1-8, explicit directories
- `3,5-7 [docs/phases, docs/plans]` — specific phases, custom directories

## How It Works

For the specified phases and directories, this skill:
1. Finds all documents in the specified directories associated with those phases
2. Reads each document and generates a condensed summary
3. Moves the original to `archive/<directory-name>/` (mirroring the source structure)
4. Writes the condensed summary in place of the original

## Execution Flow

### Phase 1: Parse Arguments

**Parse the phase range** into a list of phase numbers. Support formats:
- Range: `1-8` (phases 1 through 8)
- List: `1,3,5` (specific phases)
- Mixed: `1-4,6,8` (range plus individual)
- Single: `3` (one phase)

**Parse document locations** from the bracket-delimited list. If absent, use defaults (`docs/brainstorms`, `docs/plans`).

### Phase 2: Inventory Documents

Scan each specified directory (and its subdirectories) for documents related to the specified phases.

**Matching rules (applied per directory):**
- Match by frontmatter `phase:` field
- Match by filename containing `phase-N`, `phase-NN`, or the phase topic keyword
- Match by `NN-phase-*.md` naming pattern (e.g., `01-phase-echo.md`)
- For root-level feature plans: cross-reference with a phase overview file if one exists

Present the inventory to the user for confirmation before proceeding:
> "I found N documents across M directories for phases X-Y. Here's what I'll condense: [list by directory]. Proceed?"

### Phase 3: Create Archive Directories

Mirror the source directory structure under `archive/`. For each source directory, create the corresponding archive path:

```
archive/<dir-name>/          # e.g., archive/brainstorms/, archive/plans/, archive/phases/
archive/<dir-name>/<subdir>/ # e.g., archive/plans/phases/ (if subdirs exist)
```

Create these directories if they don't exist.

### Phase 4: Condense Each Document

Process documents in parallel where possible (use Task tool with multiple agents).

**For each document:**

1. **Read** the full original
2. **Generate** a condensed summary using the format below
3. **Move** the original to the corresponding archive path (preserve filename)
4. **Write** the condensed summary to the original path in `docs/`

### Condensed Format

Choose the format based on the document type (detected from directory name or content):

#### Brainstorm Documents (directories containing "brainstorm")

```markdown
---
date: [original date]
topic: [original topic]
phase: [phase number]
condensed: true
original: archive/<dir-name>/[original-filename].md
---

# Phase N: [Title] (Condensed)

## Summary

[2-3 sentence summary of what was explored and why]

## Key Decisions

- **[Decision 1]**: [What was decided and why, in one line]
- **[Decision 2]**: [What was decided and why, in one line]
- ...

## Outcomes

- [Key outcome or conclusion, one line each]
- ...

## Status

[Completed / Implemented in Phase N / Superseded by X]
```

#### Plan / Phase Documents (directories containing "plan" or "phase")

```markdown
---
phase: [phase number]
condensed: true
original: archive/<dir-name>/[original-filename].md
---

# Phase N: [Title] (Condensed)

**Stage:** [Local Development / Production / etc.]
**Depends on:** [Dependencies]
**Done when:** [Completion criteria, one line]

## Summary

[2-3 sentence summary of what was built and the approach taken]

## Key Deliverables

- [Deliverable 1]
- [Deliverable 2]
- ...

## Key Technical Decisions

- **[Decision 1]**: [What was chosen and the 1-line rationale]
- **[Decision 2]**: [What was chosen and the 1-line rationale]
- ...

## Status

[Completed / In Progress / Planned]
```

#### Generic Documents (any other directory)

Use the Plan format above, adapting section headers as appropriate for the content.

### Phase 5: Update Cross-References

After condensation, check if any remaining docs reference the moved files. Update paths to note that condensed versions are in place and originals are in `archive/`.

**Do NOT update:** Any overview/index files (e.g., `00-overview.md`) — these should remain as-is.

### Phase 6: Summary Report

Present a summary:

```
Condensed N documents across M directories for phases X-Y.

Per directory:
  <dir1>: A files condensed, archived to archive/<dir1>/
  <dir2>: B files condensed, archived to archive/<dir2>/
  ...

Total: N files condensed, N originals archived.
```

## Guardrails

- **Always confirm** the document inventory with the user before making changes
- **Never delete** originals — always archive them
- **Preserve filenames** — condensed files keep the same name at the same path
- **Skip already-condensed** files (check for `condensed: true` in frontmatter)
- **Keep the phases/00-overview.md** untouched — it's the master index
