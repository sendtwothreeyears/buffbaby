---
title: "feat: Mobile Development Cockpit"
type: feat
status: active
date: 2026-02-27
brainstorm: docs/brainstorms/2026-02-27-mobile-dev-cockpit-brainstorm.md
---

# Mobile Development Cockpit

## Overview

Transform the WhatsApp/Discord/Telegram interface from a raw Claude Code terminal into a comprehensive phone-first development experience. Engineers clone repos, run project-specific skills, and view output properly — all from their phone, no laptop needed.

Three interlocking systems:

1. **Command Routing + Core VM Skills** — hybrid routing (relay handles meta-commands, VM handles action-commands), baked-in skills (clone, switch, repos, status, help), CWD tracking, SQLite persistence
2. **Smart Output Rendering + Web Views** — output type detection, platform-tailored formatting, web view escape hatches for long content
3. **Project Skill Discovery** — auto-discover `.claude/skills/` from cloned repos, Discord slash command registration, dynamic help output

## Deployment Model

**Critical context:** This is open-source, self-hosted software. Each team:
- Clones the textslash repo
- Deploys their own relay + VM to their own Fly.io account
- Connects their own Discord bot / Telegram bot / WhatsApp number
- Everyone in the channel shares ONE VM — same repos, same cwd, same filesystem

There is **one VM, one relay, one team**. "Multi-user" means teammates in the same channel issuing commands to the same VM. There is no centralized infrastructure managing multiple teams' VMs.

Implications:
- **CWD is per-VM, not per-user** — one working directory for the whole team
- **No user identity mapping needed** — everyone in the channel is authorized
- **Global command queue** — FIFO across all users, not per-user silos
- **SQLite stores VM state** — not per-user sessions

## Problem Statement

Today, the system is a raw pipe: user text goes to Claude Code, output comes back. This has three major limitations:

1. **No repo management from phone** — can't clone, switch repos, or check status without sending freeform prompts that may or may not work
2. **No output intelligence** — a 500-line diff dumps inline. A test run with 3 failures shows the full log. No summaries, no links to rendered views
3. **No state persistence** — VM restart loses the working directory. No command history. No skill cache. Start from scratch every time

## Proposed Solution

### Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Command routing | **Hybrid** | Relay handles meta-commands (help, skills) that need adapter context. VM handles action-commands (clone, switch, repos, status) via new endpoints. Freeform text goes to Claude Code as today. |
| VM model | **Single-team, single-VM** | One deployment per team. Shared cwd, global command queue. Matches the open-source self-hosted model. |
| Skill reporting | **Embedded in response** | Clone/switch responses include `skills[]`. Relay caches and updates adapters. `GET /skills` as fallback. |
| Persistence | **SQLite on Fly volume** | `better-sqlite3` — single-file, no server process, atomic writes, queryable. Fits single-VM model. |
| Long output | **Summarize + link** | Smart summaries in-channel, web view links for full content. 90% of the value at 10% of a full web dashboard. |
| Web view security | **UUID + TTL** | Unguessable URLs, 30-minute expiry. Acceptable for self-hosted alpha. HMAC-signed URLs for production later. |
| Command vs. natural language | **Exact match + pattern match** | Single-word exact match (`help`, `status`, `repos`). Pattern match with required args (`clone <url>`, `switch <name>`). Everything else → Claude Code. |

### Command Routing Flow

```
User sends message
  → Adapter → onMessage(userId, text)
    → Relay Core
      ├─ Is it approve/reject/cancel? → Handle approval flow (existing)
      ├─ Is it a relay meta-command? (help, skills)
      │    → Handle locally, respond immediately, no VM call
      ├─ Is it a VM action-command? (clone <url>, switch <name>, repos, status)
      │    → Call specific VM endpoint (POST /clone, POST /switch, GET /repos, GET /status)
      │    → clone/switch responses include skills[] → cache and update adapters
      └─ Everything else → forwardToVM() as today (Claude Code)
```

**Command recognition rules:**
- `help` / `skills` — exact match → relay meta-command (needs adapter context + skill cache)
- `status` — exact match → VM action-command (needs repo/git info from filesystem)
- `repos` — exact match → VM action-command
- `clone <url>` — starts with "clone " + HTTPS URL pattern → VM action-command (SSH URLs like `git@github.com:...` not matched in MVP — use HTTPS + GITHUB_TOKEN)
- `switch <name>` — starts with "switch " → VM action-command
- `cancel` / `approve` / `reject` — existing relay keywords (state-dependent)
- Everything else → Claude Code via `POST /command`

**Anti-collision:** `help me debug this` does NOT trigger help (not exact match). `clone the navbar` does NOT trigger clone (no URL argument). Discord slash commands bypass text matching entirely (unambiguous by design).

### Project Skill Invocation

**Project skills are invoked via Claude Code, not the command router.** When a user types a project skill name like "brainstorm" or "ship," it falls through to `freeform` and is sent to Claude Code via `POST /command`. Since Claude Code spawns with `cwd` set to the repo, it natively discovers `.claude/skills/` and handles the invocation — no dedicated skill invocation layer needed.

The command router only discovers and *displays* project skills (in `help`, Discord slash commands). Invocation is Claude Code's job. This is by design — Claude Code already has sophisticated skill parsing, argument handling, and context management that would be wasteful to replicate.

## Technical Approach

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Relay Server                                            │
│                                                         │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Adapters │  │ Command      │  │ Skill Cache      │  │
│  │ (WA/DC/  │→ │ Router       │  │ (in-memory,      │  │
│  │  TG)     │  │ (meta/action/│  │  from VM response)│  │
│  └──────────┘  │  freeform)   │  └──────────────────┘  │
│                └──────┬───────┘                         │
│                       │                                 │
│  ┌────────────────────┼──────────────────────────────┐  │
│  │ Web View Proxy     │   GET /view/:id → VM proxy   │  │
│  └────────────────────┼──────────────────────────────┘  │
└───────────────────────┼─────────────────────────────────┘
                        │ HTTP
┌───────────────────────┼─────────────────────────────────┐
│ VM Server             ▼                                 │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Action       │  │ Claude Code  │  │ Web View     │  │
│  │ Endpoints    │  │ Spawner      │  │ Renderer     │  │
│  │ /clone       │  │ /command     │  │ /view/:id    │  │
│  │ /switch      │  │ (with cwd)   │  │ (HTML+CSS+   │  │
│  │ /repos       │  │              │  │  highlight.js)│  │
│  │ /status      │  │              │  │              │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘  │
│         │                 │                             │
│  ┌──────┴─────────────────┴──────────────────────────┐  │
│  │ SQLite (/data/cockpit.db)                         │  │
│  │ Tables: config, commands, skills_cache, artifacts │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Fly Volume (/data)                                │  │
│  │  /data/cockpit.db    — SQLite database            │  │
│  │  /data/images/       — screenshots (existing)     │  │
│  │  /data/repos/        — cloned repositories        │  │
│  │  /data/views/        — web view HTML artifacts    │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### SQLite Schema

```sql
-- Schema version tracked via PRAGMA user_version

-- VM-level config (replaces per-user sessions)
CREATE TABLE IF NOT EXISTS config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);
-- Keys: 'cwd', 'last_repo', 'agent_preference'

-- Command history (who sent what, from where)
CREATE TABLE IF NOT EXISTS commands (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL,           -- e.g. "discord:123" — who sent it
  input      TEXT NOT NULL,
  output_summary TEXT,                -- first 200 chars or extracted signal
  channel    TEXT NOT NULL,           -- "whatsapp" | "discord" | "telegram"
  duration_ms INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Discovered project skills (cached per repo)
CREATE TABLE IF NOT EXISTS skills_cache (
  repo_path  TEXT PRIMARY KEY,
  skills     TEXT NOT NULL,           -- JSON array of { name, description }
  scanned_at TEXT DEFAULT (datetime('now'))
);

-- Web view artifacts (tracks generated HTML pages)
CREATE TABLE IF NOT EXISTS artifacts (
  id         TEXT PRIMARY KEY,        -- UUID
  type       TEXT NOT NULL,           -- "diff" | "code" | "log" | "general"
  file_path  TEXT NOT NULL,           -- path on disk
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
```

**Migration strategy:** `PRAGMA user_version` for schema versioning. On startup, check version and run migrations sequentially. Each migration is a function. Start at version 1.

### Implementation Phases

#### Phase 1: Command Routing + Core VM Skills + SQLite

**Goal:** Users can clone repos, switch between them, check status, and get help — all via text commands. VM state survives restarts.

**Skill boundary:** Phase 1 builds the skill scanning infrastructure (`vm/skills.js`) because `clone`/`switch` responses include `skills[]`. But Phase 1's `help` just lists them plainly. Phase 3 adds Discord slash commands, skill cache TTL, refresh logic, and enhanced help formatting.

##### Relay Changes (`relay-core.js`)

```
relay-core.js changes:
├─ Add commandRouter() — classifies input as meta/action/freeform
├─ Add meta-command handlers (help, skills)
├─ Add action-command forwarding (clone, switch, repos, status → specific VM endpoints)
├─ Fix global command queue (drain across all users, not just current user)
├─ Add skill cache (in-memory Map, populated from VM responses)
└─ Update sendVMResponse to check for skills[] in response and cache
```

**Command router pseudocode:**

```javascript
function classifyCommand(text) {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // Exact-match relay meta-commands
  if (lower === 'help' || lower === 'skills') return { type: 'meta', command: lower };

  // Exact-match VM action-commands
  if (lower === 'repos') return { type: 'action', command: 'repos' };
  if (lower === 'status') return { type: 'action', command: 'status' };

  // Pattern-match VM action-commands (require arguments)
  // Note: match against original text to preserve URL/name casing
  const cloneMatch = trimmed.match(/^clone\s+(https?:\/\/\S+)/i);
  if (cloneMatch) return { type: 'action', command: 'clone', args: { url: cloneMatch[1] } };

  const switchMatch = trimmed.match(/^switch\s+(\S+)/i);
  if (switchMatch) return { type: 'action', command: 'switch', args: { name: switchMatch[1] } };

  // Everything else → Claude Code
  return { type: 'freeform' };
}
```

**Global queue fix:** Currently `processQueue()` is called per-user after their command completes. Change to a global VM queue: when the VM finishes any command, drain the next command from the global FIFO regardless of which user sent it.

##### VM Changes (`vm/vm-server.js`)

```
vm/vm-server.js changes:
├─ Add SQLite initialization (better-sqlite3)
├─ Add migration runner (PRAGMA user_version)
├─ Store/restore cwd from config table
├─ Pass cwd to spawn() for Claude Code
├─ Pass cwd to collectDiffs()
├─ Pass cwd to /approve endpoint
├─ New endpoints:
│   POST /clone   { url } → git clone, set cwd, scan skills, return { text, skills }
│   POST /switch  { name } → set cwd, scan skills, return { text, skills }
│   GET  /repos   → list /data/repos/*, return { repos[] }
│   GET  /status  → current repo, branch, changed files, return { text }
│   GET  /skills  → return cached skills for current repo
└─ Create /data/repos/ on startup (volume mount gotcha)
```

**New files:**
- `vm/db.js` — SQLite initialization, migration runner, query helpers
- `vm/skills.js` — scan `.claude/skills/` directory, parse skill metadata (name from filename, description from frontmatter or first line)

##### Dockerfile Changes

```dockerfile
# Add better-sqlite3 build dependencies
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
# Or use prebuilt: npm install better-sqlite3 --build-from-source=false
```

##### Acceptance Criteria

- [ ] `help` responds with list of core commands + any discovered project skills
- [ ] `clone <url>` clones repo to `/data/repos/<name>`, sets cwd, scans skills
- [ ] `switch <name>` changes cwd to `/data/repos/<name>`, scans skills
- [ ] `repos` lists all cloned repos with current one marked
- [ ] `status` shows current repo, branch, changed files count
- [ ] After `clone`/`switch`, subsequent Claude Code commands run in the correct cwd
- [ ] CWD survives VM restart (SQLite persistence)
- [ ] Commands from any user in the channel work (global queue)
- [ ] `help me debug this` does NOT trigger help (anti-collision)
- [ ] `clone the navbar` does NOT trigger clone (no URL argument)
- [ ] Existing approve/reject/cancel flow still works unchanged

#### Phase 2: Smart Output Rendering + Web Views

**Goal:** Long output gets summarized in-channel with a link to a rendered web view. Short output stays inline with better formatting.

##### Output Type Detection

New module (`vm/output-classifier.js` or inline in vm-server.js):

```javascript
function classifyOutput(text, diffs) {
  if (diffs && diffs.length > 0) return 'diff';

  // Heuristic: build/test output
  if (/(\d+\s+(passed|failed|errors?|warnings?)|PASS|FAIL|✓|✗|BUILD)/i.test(text))
    return 'build';

  // Heuristic: code file content (syntax patterns)
  if (/^(import |from |const |function |class |def |export )/m.test(text))
    return 'code';

  return 'general';
}
```

##### Rendering Rules

| Output Type | Short (<30 lines) | Long (>=30 lines) |
|------------|-------------------|-------------------|
| **diff** | Inline diff summary ("Changed 3 files, +45/-12") + truncated diff | Summary + "View full diff →" link |
| **code** | Inline with syntax markers | First 15 lines + "View full file →" link |
| **build** | Extract signal ("12 passed, 3 failed" + failure messages) | Signal + "View full log →" link |
| **general** | Full text inline | First ~20 lines + "View full output →" link |

##### Web View System

**VM-side** (`vm/web-views.js`):

```
vm/web-views.js:
├─ generateView(type, content, metadata) → { id, filePath }
│   ├─ Renders HTML from template + data
│   ├─ Writes to /data/views/<uuid>.html
│   ├─ Inserts into artifacts table with 30-min expiry
│   └─ Returns artifact id
├─ HTML templates:
│   ├─ diff.html — collapsible per-file diffs, green/red highlighting
│   ├─ code.html — syntax highlighted, line numbers, copy button
│   ├─ log.html — full log output, monospace, auto-scroll anchor
│   └─ base.html — shared layout, mobile-optimized, responsive
├─ Uses highlight.js (CDN link, no bundling needed)
└─ Mobile-first CSS: large fonts, wide tap targets, dark/light
```

**VM endpoint:**

```
GET /view/:id → serves /data/views/<id>.html
  - Checks artifacts table for existence + expiry
  - Returns 410 Gone with friendly "expired" page if past TTL
  - Returns 404 for unknown IDs
```

**Relay proxy:**

```
GET /view/:id → proxies to VM's GET /view/:id
  - Same UUID validation pattern as /images/:filename
  - Public URL: https://<relay-host>/view/<uuid>
```

**Artifact cleanup:** Extend existing 5-minute TTL cleanup to also handle `/data/views/` using the `artifacts` table `expires_at` column.

##### Adapter Changes

Each adapter's `sendVMResponse()` updated to:

1. Receive output type classification from VM response (`{ type: 'diff' | 'code' | 'build' | 'general' }`)
2. If a `viewUrl` is present in the response, append platform-appropriate link
3. Platform-specific formatting:

| Platform | Link Format | Long Output |
|----------|------------|-------------|
| **Discord** | `[View full diff →](url)` in embed | Embed with summary + link |
| **WhatsApp** | Raw URL (auto-previews) | Summary text + URL on new line |
| **Telegram** | Inline link in HTML | Summary + `<a href>` link |

##### Acceptance Criteria

- [ ] Short output (<30 lines) renders inline as today (no regression)
- [ ] Long diffs show summary + clickable link to syntax-highlighted web view
- [ ] Long code output shows first 15 lines + link to full file view
- [ ] Build/test output extracts signal (pass/fail counts, failure messages)
- [ ] Web view pages are mobile-optimized (responsive, readable on phone)
- [ ] Web view URLs expire after 30 minutes with friendly "expired" page
- [ ] Artifact cleanup runs alongside existing image cleanup
- [ ] All three adapters format links correctly for their platform

#### Phase 3: Project Skill Discovery + Discord Slash Commands

**Goal:** When users clone a repo that has `.claude/skills/`, those skills appear in help and as Discord slash commands.

##### Skill Scanning (`vm/skills.js`)

```javascript
function scanSkills(repoPath) {
  const skillsDir = path.join(repoPath, '.claude', 'skills');
  if (!fs.existsSync(skillsDir)) return [];

  return fs.readdirSync(skillsDir)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const content = fs.readFileSync(path.join(skillsDir, f), 'utf-8');
      const name = f.replace('.md', '').replace(/^workflow:/, '');
      // Extract description from YAML frontmatter or first paragraph
      const descMatch = content.match(/description:\s*"?([^"\n]+)/);
      const desc = descMatch ? descMatch[1] : name;
      return { name, description: desc, filename: f };
    });
}
```

**Trigger points:**
- After `clone` completes → scan new repo
- After `switch` completes → scan (check cache first)
- Cache in SQLite `skills_cache` table with `scanned_at`
- Cache TTL: 5 minutes (skills rarely change mid-session)
- Manual rescan: `skills --refresh` command

##### Skills Embedded in Response

The VM's `/clone` and `/switch` endpoints already return `{ text, skills }`. The relay caches this:

```javascript
// In relay-core.js, after receiving VM response
if (data.skills) {
  skillCache = data.skills;  // Module-level variable
  // Notify Discord adapter to update slash commands
  const discordAdapter = adapters.get('discord');
  if (discordAdapter?.updateSlashCommands) {
    discordAdapter.updateSlashCommands(data.skills);
  }
}
```

##### Discord Slash Command Registration

```
adapters/discord.js additions:
├─ On startup: register core slash commands (help, status, clone, switch, repos)
├─ updateSlashCommands(skills[]) → register/deregister project-specific commands
├─ Handle interactionCreate event (separate from messageCreate)
│   ├─ Slash command → extract command + options → onMessage(userId, reconstructed text)
│   ├─ Defer reply (>3s VM work) → followUp with response
│   └─ Autocomplete for switch command (list repos)
└─ On relay startup: reconcile — fetch existing commands, remove stale, add missing
```

**Rate limit awareness:** Discord allows 200 command creates/updates per day per guild. Track count, warn if approaching limit. Core commands (5) + project skills (typically <20) = well within limits.

##### Help Command Enhancement

```
help output:

📋 Core Commands
  clone <url>  — Clone a repo to the VM
  switch <name> — Switch to a different repo
  repos        — List all cloned repos
  status       — Current repo, branch, changed files
  help         — Show this help
  cancel       — Cancel running command
  approve      — Approve pending changes
  reject       — Reject pending changes

🔧 Project Skills (from .claude/skills/ in current repo)
  brainstorm   — Explore what to build
  plan         — Structure how to build it
  ship         — Implement + review + PR
  ...

Everything else is sent directly to Claude Code.
```

##### Acceptance Criteria

- [ ] After `clone`, project skills from `.claude/skills/` appear in `help`
- [ ] After `switch`, skills update to reflect new repo's skills
- [ ] Discord slash commands registered for core commands on startup
- [ ] Discord slash commands dynamically updated when project skills change
- [ ] Slash commands work with deferred reply pattern (>3s VM work)
- [ ] `switch` autocomplete shows available repos in Discord
- [ ] Skills cached in SQLite, refreshed on clone/switch or every 5 minutes
- [ ] `skills --refresh` forces rescan
- [ ] Stale Discord slash commands cleaned up on relay startup

#### Phase 4: Polish + Additional Capabilities

**Goal:** Round out the experience with commonly needed development workflows.

##### PR Lifecycle Commands

| Command | Action | Implementation |
|---------|--------|---------------|
| `pr create` | Create PR from current branch | VM endpoint → `gh pr create` |
| `pr status` | Show CI status, review state | VM endpoint → `gh pr status` |
| `pr merge` | Merge current PR | VM endpoint → `gh pr merge` |

These are VM action-commands routed via relay, same pattern as `clone`/`switch`.

##### Branch Management

| Command | Action |
|---------|--------|
| `branch` | List branches |
| `checkout <name>` | Switch branch |
| `checkout -b <name>` | Create + switch |

##### Onboarding Flow

On first interaction (no repos cloned, no cwd set):

```
👋 Welcome to your development cockpit!

Get started:
  clone <repo-url>  — Clone a repository
  help              — See all commands

Your VM is ready at /data/repos/. Clone a repo to begin.
```

Triggered when: `config` table has no `cwd` key, or cwd points to non-existent directory.

##### Acceptance Criteria

- [ ] `pr create`, `pr status`, `pr merge` work from phone
- [ ] `branch`, `checkout` commands work
- [ ] First-time users see onboarding message
- [ ] Onboarding only shows once (persisted in config)

## Alternative Approaches Considered

### A. Claude Code Handles Everything (No Command Routing)

**Approach:** Don't add command routing. Let Claude Code handle `clone`, `switch`, etc. as natural language prompts. Claude is smart enough to run `git clone` when asked.

**Why rejected:** Unreliable — Claude might interpret "clone" differently, might not update CWD tracking, can't embed skills in responses. Structured commands need structured handling. The relay can't update Discord slash commands if it doesn't know what happened on the VM.

### B. Full Command Routing in Relay

**Approach:** Relay parses ALL commands and calls specific VM endpoints for each.

**Why rejected:** Over-centralizes logic. The relay doesn't need to know about git internals or repo state. VM is the right place for action-commands since it has filesystem access. Relay should stay thin — routing + adapter management.

### C. Web Dashboard Instead of Web Views

**Approach:** Build a full web app with terminal emulator, file browser, diff viewer.

**Why rejected (for now):** The brainstorm correctly identified this as over-engineered. Summarize + link gives 90% of the value. A full dashboard can be Phase 5+ if the "link out" pattern proves insufficient.

### D. Redis Instead of SQLite

**Approach:** Use Redis/Upstash for persistence instead of SQLite.

**Why rejected:** Adds external dependency. SQLite is file-based, lives on the Fly volume, requires no server process, and is perfect for the single-VM model. Redis would make sense for multi-VM distributed state, but that's not the architecture.

## Acceptance Criteria

### Functional Requirements

- [ ] All 7 core commands work across WhatsApp, Discord, and Telegram
- [ ] Project skills discovered and shown in help after clone/switch
- [ ] Discord slash commands dynamically registered per repo
- [ ] Long output shows summary + web view link instead of wall of text
- [ ] Web views render correctly on mobile phones
- [ ] CWD and skill cache survive VM restarts
- [ ] Multiple channel users can issue commands (global queue, FIFO)
- [ ] Existing Claude Code freeform prompts still work unchanged

### Non-Functional Requirements

- [ ] Command routing adds <10ms latency to message processing
- [ ] Web views load in <2s on mobile connection
- [ ] SQLite operations are synchronous (better-sqlite3) — no async complexity
- [ ] Web view artifacts auto-expire (30-minute TTL)
- [ ] No regression in existing WhatsApp/Discord/Telegram adapter behavior

### Quality Gates

- [ ] All core commands tested manually on each adapter
- [ ] Web view rendering tested on iOS Safari and Android Chrome
- [ ] SQLite migration tested: fresh install + upgrade from no-DB state
- [ ] Cold start still works: clone → restart VM → cwd restored → commands work

## Dependencies & Prerequisites

| Dependency | Required By | Notes |
|-----------|-------------|-------|
| `better-sqlite3` | Phase 1 | Native addon, needs build tools in Dockerfile |
| `highlight.js` | Phase 2 | CDN link in HTML templates (no npm install needed) |
| Discord `applications.commands` scope | Phase 3 | Bot OAuth2 must include this scope |
| `/data` volume on Fly.io | Phase 1 | Already exists, used for images |
| `GITHUB_TOKEN` env var on VM | Phase 1 (private repos) | Already in `vm/.env.example`. Required for `git clone` of private repos. Public repos work without it. |

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `better-sqlite3` native build fails in Docker | Medium | Blocks Phase 1 | Use prebuilt binaries or `sql.js` (pure JS) as fallback |
| Discord slash command rate limits | Low | Blocks frequent repo switching | Track count, warn at 150/200 per day, batch updates |
| Web view URLs leaked/shared | Medium | Code exposure | UUID + 30-min TTL acceptable for self-hosted alpha. HMAC-signed URLs later. |
| Command routing false positives | Low | User frustration | Strict matching (exact + pattern with required args). Easy to adjust rules. |
| SQLite corruption on VM crash | Very Low | State reset | `better-sqlite3` uses WAL mode by default. Worst case: recreate DB, lose history but repos still on disk. |
| Fly volume full | Low | Writes fail | Monitor disk usage. Web view cleanup runs every 5 minutes. Repos are the main space consumer — document recommended limits. |

## Future Considerations

- **Identity linking across adapters** — if a user works from both WhatsApp and Discord, their commands go to the same VM but appear as different userIds in command history. Not a problem for single-team model, but worth noting.
- **HMAC-signed web view URLs** — for teams with sensitive code, UUID-only security may not be enough. Add signed URLs with cryptographic expiry.
- **Notifications** — CI failed, PR approved, deploy done. Webhook listeners that push alerts to the channel proactively (not user-initiated).
- **Media input** — send a screenshot from your phone camera, Claude analyzes it. Adapter downloads media, passes image path to Claude Code (already multimodal).
- **Multi-VM routing** — if teams grow and need per-user VMs, the relay would need a VM router. Not needed for the current model.

## Documentation Plan

| Document | Update Needed |
|----------|--------------|
| `ARCHITECTURE.md` | Add command routing layer, SQLite persistence, web view system |
| `README.md` | Add core commands reference, Discord slash command setup |
| `.env.example` | No changes expected (VM already has all needed config) |
| `CLAUDE.md` | Add lessons learned from implementation |
| `docs/phases/00-overview.md` | Add Mobile Dev Cockpit as new stage |

## References & Research

### Internal References

- Brainstorm: `docs/brainstorms/2026-02-27-mobile-dev-cockpit-brainstorm.md`
- Relay core (state machine): `relay-core.js:13-19` (userState Map), `relay-core.js:91-134` (onMessage handler)
- VM command endpoint: `vm/vm-server.js:94-254` (POST /command)
- Claude Code spawn: `vm/vm-server.js:119` (no cwd option — needs change)
- Diff collection: `vm/vm-server.js:54-78` (uses process.cwd() — needs cwd param)
- Adapter contract: `adapters/whatsapp.js`, `adapters/discord.js`, `adapters/telegram.js`
- Shared utils: `adapters/utils.js` (chunkText, truncateAtFileBoundary)
- Image pipeline: `vm/vm-server.js:400-433` (TTL cleanup pattern to reuse for web views)
- Flycast port gotcha: `docs/solutions/integration-issues/flycast-port-relay-callback-url-20260227.md`
- Volume mount gotcha: `docs/solutions/runtime-errors/volume-mount-enoent-relay-20260227.md`

### Institutional Learnings Applied

- **Volume mount dirs:** Create `/data/repos/` and `/data/views/` at startup, not in Dockerfile (from volume-mount-enoent lesson)
- **Non-root user:** `better-sqlite3` and new modules must work as `appuser` (from docker-vm-claude-code lesson)
- **Process group kill:** Any new long-running subprocess (e.g., `git clone`) must use `detached: true` + negative PID kill (from headless-setup lesson)
- **Budget-aware formatting:** Reuse truncateAtFileBoundary pattern for web view summaries (from text-diff-pipeline lesson)
- **Reset→Accumulate→Drain:** Apply to skill scanning and web view artifact tracking (from screenshot-pipeline lesson)

### Known Gotchas

- Fly volume overlay wipes Dockerfile-created dirs → `mkdirSync` at startup
- Flycast URLs must NOT include port → always use port 80
- `better-sqlite3` needs Python + make + g++ for native compilation in Docker
- Discord slash commands persist on Discord's side after relay restart → need reconciliation
- Twilio sandbox has 1600-char limit (stricter than WhatsApp's 4096) → web view links help here
