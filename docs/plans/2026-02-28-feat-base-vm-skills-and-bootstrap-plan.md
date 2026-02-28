---
title: "feat: Add base skills, global CLAUDE.md, and system tools to VM"
type: feat
status: completed
date: 2026-02-28
brainstorm: docs/brainstorms/2026-02-28-base-vm-skills-and-bootstrap-brainstorm.md
---

# feat: Add base skills, global CLAUDE.md, and system tools to VM

## Overview

When a user deploys their own textslash VM instance, Claude Code should be a batteries-included Discord dev assistant from the first message. Today the VM ships with zero Claude Code configuration — no skills, no CLAUDE.md (it's at `/app/CLAUDE.md` but invisible once a repo is cloned), and missing common tools like `gh`, deploy CLIs, and package managers.

This plan adds three things to the Docker image:

1. **System tools** — gh, pnpm, yarn, bun, flyctl, deploy CLIs, db clients, dev utilities
2. **Global base skills** — 13 flat `.md` files at `~appuser/.claude/skills/`
3. **Global CLAUDE.md** — full platform context at `~appuser/.claude/CLAUDE.md`

## Problem Statement

- Claude Code on the VM has **no skills** — users can't `/clone`, `/status`, `/preview`, etc.
- The VM's `CLAUDE.md` at `/app/CLAUDE.md` becomes **invisible** once CWD changes to `/data/repos/<name>` (Claude Code walks the directory tree from CWD, never reaching `/app/`)
- Missing tools: no `gh` (can't auth to GitHub), no deploy CLIs, no `jq`, no `pnpm`/`yarn`/`bun`
- The relay's help text and skill listing don't show base skills — only repo skills

## Proposed Solution

Bake everything into the Docker image at build time. No runtime bootstrap script needed.

### Dockerfile changes

```
vm/Dockerfile (modified)
vm/base-skills/*.md (13 new files)
vm/global-claude.md (new — replaces vm/CLAUDE.md)
```

### Skill scanner changes

```
vm/skills.js (modified — merge base + repo skills)
```

### Relay changes

```
relay-core.js (modified — show base skills in help even with no repo)
```

## Implementation Phases

### Phase 1: System Tools in Dockerfile

Add new packages to `vm/Dockerfile`. Insert after the existing `apt-get` block (line 23) and `npm install -g` (line 29).

#### 1a. New apt packages

```dockerfile
# Dev utilities, database clients, git-lfs
RUN apt-get update && apt-get install -y --no-install-recommends \
    jq \
    ripgrep \
    tree \
    htop \
    tmux \
    rsync \
    nano \
    sqlite3 \
    postgresql-client \
    redis-tools \
    git-lfs \
    && rm -rf /var/lib/apt/lists/*
```

#### 1b. GitHub CLI (requires apt repo)

```dockerfile
# GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    > /etc/apt/sources.list.d/github-cli.list \
    && apt-get update && apt-get install -y gh \
    && rm -rf /var/lib/apt/lists/*
```

#### 1c. npm global packages

```dockerfile
# Package managers + deploy CLIs
RUN npm install -g pnpm yarn bun vercel netlify-cli @railway/cli wrangler
```

#### 1d. Fly CLI

```dockerfile
# Fly.io CLI
RUN curl -fsSL https://fly.io/install.sh | sh
ENV PATH="/root/.fly/bin:$PATH"
```

**Gotcha:** Fly CLI installs to `~/.fly/bin` for the current user. Since this runs as root during build, it goes to `/root/.fly/bin`. Need to either:
- Install to a shared location (`FLYCTL_INSTALL=/usr/local`), or
- Copy the binary to `/usr/local/bin/` after install

**Recommended:** `RUN curl -fsSL https://fly.io/install.sh | FLYCTL_INSTALL=/usr/local sh`

#### Ordering in Dockerfile

```
FROM node:22

# [Existing] System deps for Chromium/Playwright
RUN apt-get update && apt-get install -y ... (existing block)

# [NEW] Dev utilities, db clients, git-lfs
RUN apt-get update && apt-get install -y ... (1a)

# [NEW] GitHub CLI
RUN ... (1b)

# [Existing] Skip Playwright browser download
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# [Existing] Claude Code + Playwright
RUN npm install -g @anthropic-ai/claude-code playwright

# [NEW] Package managers + deploy CLIs
RUN npm install -g pnpm yarn bun vercel netlify-cli @railway/cli wrangler (1c)

# [NEW] Fly CLI
RUN curl -fsSL ... (1d)

# [Existing] Create appuser
RUN useradd -m -s /bin/bash appuser

# ... rest of Dockerfile
```

**Acceptance criteria:**
- [x] All tools available on PATH inside the container
- [x] `gh --version`, `flyctl version`, `pnpm --version`, `bun --version` all succeed
- [x] `jq --version`, `rg --version`, `sqlite3 --version` all succeed
- [x] Docker image builds successfully

---

### Phase 2: Base Skills

Create `vm/base-skills/` directory with 13 flat `.md` skill files.

#### File list

```
vm/base-skills/
├── clone.md
├── auth-gh.md
├── status.md
├── session.md
├── preview.md
├── diff.md
├── ship.md
├── deploy.md
├── help.md
├── keys.md
├── logs.md
└── install.md
```

Each file is a lightweight plain-English instruction set. Skills tell Claude Code what to do — they're prompts, not code. Example format:

```markdown
---
name: clone
description: "Clone a GitHub repo, install dependencies, and start the dev server"
---

# /clone <repo-url> [branch]

Clone a GitHub repository into this VM's workspace.

## Steps

1. Clone the repo to /data/repos/<name>
2. Detect project type (package.json → Node.js, requirements.txt → Python, etc.)
3. Install dependencies based on detected type
4. If a `dev` script exists in package.json, start the dev server
5. Report back: repo name, branch, file count, dev server URL (if started)

## Examples

- `/clone https://github.com/user/my-app`
- `/clone https://github.com/user/my-app feat/new-feature`

## Notes

- Uses `gh repo clone` (authenticated via GITHUB_TOKEN)
- After cloning, the VM's working directory switches to the cloned repo
```

#### The `/install` skill — special considerations

The VM runs as `appuser` (non-root). Cannot use `apt-get`. On-demand tools must use user-space install methods:

| Tool | Install method |
|------|---------------|
| AWS CLI v2 | `curl` + unzip to `~/bin` |
| gcloud SDK | `curl` + extract to `~/google-cloud-sdk` |
| Azure CLI | `pip install --user azure-cli` |
| Docker CLI | `curl` binary to `~/bin` |

The `install.md` skill should instruct Claude Code to:
1. Download/install to user-space paths (`~/bin`, `~/tools`, etc.)
2. Add to PATH if needed (`export PATH="$HOME/bin:$PATH"`)
3. Verify the install succeeded
4. Report the installed version

**Persistence note:** On-demand tools live in the container filesystem. They survive VM restarts (Fly machines keep their rootfs) but are lost on redeploy (new image). The `/data` volume persists across redeploys, so an alternative is installing to `/data/tools/` — but this adds complexity. Start simple: container-local installs, lost on redeploy, user reinstalls if needed.

#### Dockerfile additions (after user creation, before final USER appuser)

```dockerfile
# Global Claude Code config: base skills + CLAUDE.md
COPY base-skills/ /home/appuser/.claude/skills/
COPY global-claude.md /home/appuser/.claude/CLAUDE.md
RUN chown -R appuser:appuser /home/appuser/.claude
```

**Acceptance criteria:**
- [x] 12 `.md` files exist in `vm/base-skills/`
- [x] Files are copied to `/home/appuser/.claude/skills/` in Docker image
- [x] Claude Code discovers skills when running: `claude -p "list your available skills" --dangerously-skip-permissions`
- [x] Each skill has `name` and `description` in YAML frontmatter

---

### Phase 3: Global CLAUDE.md

Create `vm/global-claude.md` to replace the current `vm/CLAUDE.md`. This becomes the user-level CLAUDE.md at `/home/appuser/.claude/CLAUDE.md`.

#### Content sections

1. **Identity & Platform Context**
   - "You are a development assistant running inside a Docker container, accessed via Discord."
   - Discord-specific constraints (embeds, threads, message formatting)
   - The user interacts through text messages and slash commands

2. **VM Tools** (migrated from current `vm/CLAUDE.md`)
   - Screenshot capture: `curl -s -X POST http://localhost:3001/screenshot`
   - Progress reporting: `::progress::` and `::approval::` markers

3. **Available Skills Overview**
   - Brief list of base skills with one-line descriptions
   - Note that users can override with repo-level skills

4. **Behavioral Guidance**
   - Keep responses concise — they're read on Discord
   - Use progress markers for multi-step tasks
   - Always emit `::approval::` before creating PRs
   - Use code blocks with syntax highlighting

#### Remove old CLAUDE.md from /app

Update `vm/Dockerfile` line 46:
```dockerfile
# Before:
COPY *.js CLAUDE.md ./

# After:
COPY *.js ./
```

The `CLAUDE.md` at `/app/` is no longer needed since the global one at `~appuser/.claude/CLAUDE.md` is always discovered.

**Acceptance criteria:**
- [x] `vm/global-claude.md` exists with all four content sections
- [x] Copied to `/home/appuser/.claude/CLAUDE.md` in Docker image
- [x] Old `/app/CLAUDE.md` no longer copied
- [x] Claude Code references platform context when responding

---

### Phase 4: Skill Scanner Update

Extend `vm/skills.js` to merge base skills from `~appuser/.claude/skills/` with repo-level skills.

#### Current behavior (`vm/skills.js`)

```javascript
// Only scans: <repoPath>/.claude/skills/*.md
const skillsDir = path.join(repoPath, ".claude", "skills");
```

#### New behavior

```javascript
// 1. Scan base skills: /home/appuser/.claude/skills/*.md
// 2. Scan repo skills: <repoPath>/.claude/skills/*.md
// 3. Merge: repo skills override base skills on name collision
```

Implementation:

```javascript
const BASE_SKILLS_DIR = path.join(os.homedir(), ".claude", "skills");

async function scanSkills(repoPath, options = {}) {
  const baseSkills = scanDir(BASE_SKILLS_DIR);
  const repoSkills = repoPath ? scanDir(path.join(repoPath, ".claude", "skills")) : [];

  // Merge: repo overrides base on name collision
  const merged = new Map();
  for (const skill of baseSkills) merged.set(skill.name, { ...skill, source: "base" });
  for (const skill of repoSkills) merged.set(skill.name, { ...skill, source: "repo" });

  return Array.from(merged.values());
}
```

Add a `source` field (`"base"` or `"repo"`) so the relay can distinguish them in help text.

**Acceptance criteria:**
- [x] `scanSkills()` returns base skills even when no repo is cloned
- [x] Repo skills override base skills when names match
- [x] Each skill includes a `source` field (`"base"` or `"repo"`)
- [x] Cache invalidation works for both base and repo skills

---

### Phase 5: Relay Help Text Update

Update `relay-core.js` help command to show base skills.

#### Current behavior (relay-core.js:353-376)

Help text is a static string of "Core Commands" followed by "Project Skills" (from repo skill cache). If no repo is cloned, no skills appear.

#### New behavior

- Always show base skills under "Base Skills" heading
- Show repo-specific skills under "Project Skills" if a repo is cloned
- If a repo skill overrides a base skill, only show the repo version

```
Core Commands:
  clone <url>     - Clone a repo and set up workspace
  status          - Check VM state
  help            - Show this help message

Base Skills:
  /clone          - Clone a GitHub repo, install dependencies, and start the dev server
  /preview        - Capture screenshots at mobile/desktop viewports
  /ship           - Implement, test, commit, push, and create PR
  ...

Project Skills (my-app):
  /test           - Run the test suite
  /lint           - Run linter and auto-fix
```

**Acceptance criteria:**
- [x] Base skills always appear in help text
- [x] Repo skills appear when a repo is cloned
- [x] No duplicate entries when repo overrides a base skill
- [x] Discord formatting looks clean

---

## Technical Considerations

### Docker image size

Estimated +150MB from new packages. Current image is ~2GB (mostly Chromium). This is a ~7.5% increase — acceptable.

### Dockerfile layer caching

New RUN blocks are added before user creation and app copy. This means:
- System tool installs are cached unless the Dockerfile changes
- Skill file changes only invalidate the COPY layer (fast rebuild)
- App code changes don't trigger tool reinstalls

### Skill precedence

Claude Code's native skill discovery: **project > user > global**. Base skills at `~/.claude/skills/` are user-level, so project-level skills in a cloned repo's `.claude/skills/` naturally take precedence. No special logic needed on the Claude Code side.

The VM's skill scanner (`skills.js`) needs its own merge logic since it's a separate discovery mechanism used for the relay UI.

### On-demand installs persistence

Tools installed via `/install` live in the container filesystem. They persist across VM restarts (Fly machines keep rootfs) but are lost on **redeploy** (new Docker image). This is acceptable for V1 — heavy cloud CLIs aren't needed frequently, and reinstall is fast via the same `/install` skill.

Future improvement: install to `/data/tools/` (Fly Volume) for persistence across redeploys.

### User-specific cache paths

**Gotcha from learnings:** Packages that write to `~/.cache/`, `~/.local/`, or `~/.npm/` must be installed as the runtime user. For npm global installs during Docker build (pnpm, yarn, bun, deploy CLIs), these run as root and install to system paths — this is fine. The issue only applies to per-user tools like Playwright (already handled correctly).

`bun` may write to `~/.bun/` — verify during implementation that the bun binary is accessible to appuser.

## Dependencies & Risks

| Risk | Mitigation |
|------|-----------|
| Docker image build time increases | Separate RUN layers for caching. Tools only rebuild when Dockerfile changes. |
| bun binary not accessible to appuser | Test after build. If needed, install bun as appuser or symlink. |
| Fly CLI installs to root's home | Use `FLYCTL_INSTALL=/usr/local` to install to shared path. |
| Skill file format mismatch | All base skills use consistent YAML frontmatter with `name` and `description`. |
| npm global install failures | Pin versions if needed. Use `--ignore-scripts` for problematic packages. |

## References

### Internal
- Brainstorm: `docs/brainstorms/2026-02-28-base-vm-skills-and-bootstrap-brainstorm.md`
- Roadmap: `docs/roadmap/base-vm-skills-and-bootstrap.md`
- Dockerfile: `vm/Dockerfile`
- Skill scanner: `vm/skills.js`
- VM server: `vm/vm-server.js`
- Relay: `relay-core.js`
- Existing CLAUDE.md: `vm/CLAUDE.md`

### Learnings applied
- `docs/solutions/developer-experience/playwright-chromium-user-mismatch-dockerfile-20260227.md` — user-specific caches must match runtime user
- `docs/solutions/runtime-errors/volume-mount-enoent-relay-20260227.md` — volume mounts overlay Dockerfile dirs (confirmed `/home/appuser/` is safe)
- `docs/solutions/developer-experience/docker-vm-claude-code-headless-setup-20260225.md` — non-root user mandatory
