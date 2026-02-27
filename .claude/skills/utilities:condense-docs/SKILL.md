---
name: utilities:condense-docs
description: Condense documents for specified phases into a single summary file per directory, archive the originals. Use when you want to compress completed phase documentation while preserving the full originals.
argument-hint: "[phase range] [dir1, dir2, ...] — e.g. '1-8 [docs/plans, docs/brainstorms]'"
---

# Condense Phase Documentation

Replace all documents for completed phases with **one summary file per directory**, archiving the full originals for reference.

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
2. Reads every document and synthesizes a **single summary file per directory**
3. Moves all originals to `archive/<directory-name>/`
4. Writes one summary file in each source directory (replacing all the individual files)

## Execution Flow

### Step 1: Parse Arguments

**Parse the phase range** into a list of phase numbers. Support formats:
- Range: `1-8` (phases 1 through 8)
- List: `1,3,5` (specific phases)
- Mixed: `1-4,6,8` (range plus individual)
- Single: `3` (one phase)

**Parse document locations** from the bracket-delimited list. If absent, use defaults (`docs/brainstorms`, `docs/plans`).

### Step 2: Inventory Documents

Scan each specified directory (and its subdirectories) for documents related to the specified phases.

**Matching rules (applied per directory):**
- Match by frontmatter `phase:` field
- Match by filename containing `phase-N`, `phase-NN`, or the phase topic keyword
- Match by `NN-phase-*.md` naming pattern (e.g., `01-phase-echo.md`)
- For root-level feature plans: cross-reference with a phase overview file if one exists

Present the inventory to the user for confirmation before proceeding:
> "I found N documents across M directories for phases X-Y. Here's what I'll condense: [list by directory]. Proceed?"

### Step 3: Create Archive Directories

Mirror the source directory structure under `archive/`:

```
archive/<dir-name>/          # e.g., archive/brainstorms/, archive/plans/
archive/<dir-name>/<subdir>/ # if subdirs exist
```

### Step 4: Read All Documents

Read every document across all directories. Group by directory.

### Step 5: Generate One Summary Per Directory

For each directory, produce **one markdown file** that covers all phases in the range.

**Output filename:** `phases-<range>-<dir-name>.md` (e.g., `phases-1-8-brainstorms.md`, `phases-1-8-plans.md`)

**Summary format:**

```markdown
---
phases: <range>
condensed: true
originals: archive/<dir-name>/
---

# Phases N–M: <Dir Type> Summary

[1-2 sentence overview of what this collection covers]

---

## Phase X: [Title]

[Dense paragraph summarizing the phase: what was built/explored, key decisions, key outcomes. 3-8 sentences. Include specific technical details — names, numbers, patterns — not vague summaries.]

## Phase Y: [Title]

[Same format...]

---

## General: [Topic] (if non-phase docs exist)

[Same dense paragraph format for docs not tied to a specific phase]
```

**Writing guidelines:**
- **Dense paragraphs, not bullet lists.** Each phase gets one paragraph with the essential technical details packed in.
- **Preserve specifics.** Include port numbers, file names, LOC counts, env var names, dependency choices, and rationale. A future reader should understand *what was decided and why* without reading the original.
- **Order by phase number.** Group non-phase docs at the end under "General."
- **One file replaces many.** All individual files in that directory are deleted after the summary is written.

### Step 6: Move Originals and Clean Up

For each directory:
1. Move all original files to `archive/<dir-name>/` (preserve filenames)
2. Delete the individual files from the source directory
3. The only file remaining in each source directory is the summary

### Step 7: Update Cross-References

Check if any remaining docs reference the moved files. Update paths to note that condensed versions are in place and originals are in `archive/`.

**Do NOT update:** Any overview/index files (e.g., `00-overview.md`).

### Step 8: Summary Report

```
Condensed N documents into M summary files for phases X-Y.

Per directory:
  <dir1>: A files → phases-X-Y-<dir1>.md (archived to archive/<dir1>/)
  <dir2>: B files → phases-X-Y-<dir2>.md (archived to archive/<dir2>/)

Total: N originals archived, M summary files created.
```

## Guardrails

- **Always confirm** the document inventory with the user before making changes
- **Never delete** originals — always archive them
- **One summary per directory** — not one per file
- **Skip already-condensed** directories (check for existing `phases-*` summary with `condensed: true`)
- **Keep overview/index files** untouched (e.g., `00-overview.md`)
