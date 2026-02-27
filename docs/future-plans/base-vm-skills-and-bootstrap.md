# Future Plan: Base VM Skills & Bootstrap Script

**Created:** 2026-02-27
**Status:** Deferred — MVP is single-user local dev. This is needed for multi-user provisioning.
**Depends on:** Phase 7 deploy complete, multi-user onboarding architecture designed

## Why

When a new user signs up and gets a VM provisioned automatically, that VM needs to be usable immediately — git configured, GitHub authenticated, base skills installed, Claude Code verified. Without a bootstrap script and base skills, the user's first WhatsApp message would hit a blank, unconfigured environment.

The base skills also define the "out of the box" experience. A user who signs up and sends "clone my-app" should get a working response without configuring anything. The skills are the product's UX layer on top of raw Claude Code.

## What

### 1. Base `.claude/skills/` (Pre-Installed on Every VM)

These are platform-provided skills. Users can override them with their own skills of the same name.

#### Bootstrap Skills (VM setup & auth)

| Skill | Command | What it does |
|-------|---------|-------------|
| **clone** | `/clone <repo> [branch]` | Clone a GitHub repo into the VM workspace. Installs dependencies (`npm install`, `pip install`, etc.) based on detected project type. Starts dev server if a `dev` script exists. Reports back: repo name, branch, file count, dev server URL. |
| **auth-gh** | `/auth-gh` | Configure GitHub authentication using the user's OAuth token (injected during provisioning). Sets git credential helper, configures `user.name` and `user.email` from GitHub profile. Verifies with `gh auth status`. |
| **status** | `/status` | Report current VM state: active project (repo + branch), dev server health (up/down + port), git status (clean/dirty, uncommitted files), recent PRs, disk usage, uptime. Single WhatsApp message response. |
| **session** | `/session start <repo> [branch]` | Start a working session. Clones repo if not already present, checks out branch, installs deps, starts dev server. Sends app screenshot when ready. |
| | `/session stop` | Stop current session. Stashes or commits uncommitted work, stops dev server, reports final state. |
| | `/session resume [repo]` | Resume last session (or named repo). Restarts dev server, reports current state. |

#### Development Skills (daily workflow)

| Skill | Command | What it does |
|-------|---------|-------------|
| **preview** | `/preview [url-or-page]` | Capture screenshots of the running app at mobile (390px) and desktop (1440px) viewports. Sends as WhatsApp media. Default: dev server root. Accepts relative paths or full URLs. |
| **diff** | `/diff [file]` | Render current uncommitted changes as syntax-highlighted diff images. If no file specified, shows all changed files. Sends as WhatsApp media (composite image if >5 files). |
| **ship** | `/ship <description>` | End-to-end workflow: implement the described change, run tests, self-review, fix issues, commit, push, create PR. Sends progress updates at each milestone. Requests approval before PR creation. |
| **deploy** | `/deploy [target]` | Deploy using the user's own credentials. Auto-detects target from project config (Fly.io `fly.toml`, Vercel `vercel.json`, Railway `railway.toml`). Falls back to asking user. Sends deployment URL and screenshot when done. |

#### Utility Skills (housekeeping)

| Skill | Command | What it does |
|-------|---------|-------------|
| **help** | `/help` | List all available skills (base + user-provided) with one-line descriptions. Group by category. |
| **keys** | `/keys list` | Show which API keys are configured (names only, not values). |
| | `/keys set <service> <key>` | Update an API key. Supported services: `claude`, `codex`, `gemini`, `flyio`, `github`. Encrypts and stores. Confirms update. |
| **logs** | `/logs [n]` | Show the last N lines (default 50) of Claude Code output. Useful for debugging when a command fails or produces unexpected results. |

### 2. Bootstrap Script

Runs automatically when a new VM is provisioned during user signup.

#### Sequence

```
1. VM starts from Docker base image
   (Claude Code, Playwright, Chromium, Node.js, git already installed)

2. Inject credentials via Fly.io secrets
   - ANTHROPIC_API_KEY
   - GITHUB_TOKEN (OAuth)
   - OPENAI_API_KEY (optional — for Codex)
   - GOOGLE_API_KEY (optional — for Gemini)
   - FLY_API_TOKEN (optional — for user's own deploys)

3. Run bootstrap.sh:
   a. Configure git identity
      - Fetch GitHub profile: `gh api user`
      - Set `git config --global user.name` and `user.email`

   b. Configure GitHub authentication
      - Write GITHUB_TOKEN to git credential store
      - Verify: `gh auth status`

   c. Install base .claude/skills/
      - Copy platform skills to /home/appuser/.claude/skills/
      - These are the default skills listed above

   d. Write base CLAUDE.md
      - VM-specific instructions (screenshot endpoints, progress markers)
      - Platform context (WhatsApp constraints, image pipeline)
      - Pointer to /help for available skills

   e. Write base .mcp.json
      - Playwright MCP server pre-configured
      - Any other platform MCP servers

   f. Verify Claude Code CLI
      - Run: `claude -p "respond with OK" --dangerously-skip-permissions`
      - Expect: "OK" in stdout, exit code 0

   g. Verify Playwright/Chromium
      - Run: capture a test screenshot
      - Expect: image file created successfully

   h. Report ready
      - POST to relay: { phone, status: "ready" }
      - Relay sends welcome WhatsApp message

4. VM is live. User's first message will be routed here.
```

#### Error Handling

| Step | Failure mode | Action |
|------|-------------|--------|
| Credential injection | Missing required key (ANTHROPIC_API_KEY) | Abort provisioning. Notify user via WhatsApp: "Setup failed — missing Claude API key. Visit textslash.dev/settings to fix." |
| Git config | GitHub API unreachable | Retry 3x with backoff. Fall back to generic identity. |
| Claude Code verify | CLI fails to respond | Retry 3x. If still failing, notify user: "Your VM is having trouble starting. We're looking into it." Alert ops. |
| Playwright verify | Screenshot fails | Non-fatal. Log warning. Skills that need screenshots will fail gracefully with text fallback. |

### 3. User-Provided Skills (Merge Strategy)

Users bring their own `.claude/skills/` via their repos. The merge order:

```
Priority (highest first):
1. User's repo .claude/skills/     ← wins if same name
2. User's personal config repo     ← optional, cloned during setup
3. Platform base skills            ← lowest priority, always present
```

**How it works:**
- Base skills are installed to `/home/appuser/.claude/skills/` during bootstrap
- When a user clones a repo with `.claude/skills/`, those skills are available in that project context
- Claude Code's native skill resolution handles the precedence (project > user > global)

**Personal config repo (optional):**
- During onboarding, user can specify a "config repo" (e.g., `github.com/user/my-claude-config`)
- Bootstrap clones it and symlinks `.claude/skills/` to the user's home directory
- Gives users a way to bring their entire Claude Code setup to the cloud VM

## Why Not Now

1. **MVP is single-user.** The current setup uses `.env` files with hardcoded credentials. No signup flow, no automated provisioning, no multi-user routing. Bootstrap is manual (copy `.env`, `docker compose up`).
2. **Base skills need real usage to design well.** Building skills before users have tried the WhatsApp workflow risks designing the wrong abstractions. Ship MVP, watch how people actually use it, then codify patterns into skills.
3. **Bootstrap script depends on provisioning pipeline.** The Fly.io Machines API integration for automated VM creation doesn't exist yet. Bootstrap runs after provisioning — can't build it until provisioning exists.

## Key Decisions

### 1. Where do base skills live in the repo?

**Option A:** `vm/base-skills/` in the TextSlash repo, copied into the Docker image at build time.
- Pro: Version-controlled with the platform. Updated on every deploy.
- Con: Skill updates require a Docker image rebuild and redeploy of all VMs.

**Option B:** Hosted in a separate `textslash/base-skills` repo, cloned during bootstrap.
- Pro: Skills can be updated independently of the VM image. Hot-update possible.
- Con: Extra dependency. Bootstrap is slower (clone step). Version pinning needed.

**Recommendation:** Option A for V1. Skills are small text files — including them in the Docker image is simple and reliable. Move to Option B only if skill update frequency justifies it.

### 2. Should base skills use Claude Code's native skill format or be simpler?

**Option A:** Full Claude Code skills (SKILL.md with metadata, phases, subagent references).
- Pro: Users who know Claude Code skills will recognize the format. Can leverage the full skill system.
- Con: Overkill for simple operations like `/status` or `/help`.

**Option B:** Lightweight wrappers — each skill is a short SKILL.md that tells Claude Code what to do in plain English.
- Pro: Simple to write, easy to understand, easy for users to override.
- Con: Less structured, harder to maintain consistency.

**Recommendation:** Option B. Base skills should be as simple as possible. The user's own skills can be as complex as they want. Platform skills are thin wrappers.

### 3. How does the user update their API keys after initial setup?

**Option A:** `/keys set claude sk-ant-xxx` via WhatsApp → VM updates the env var.
- Pro: Never leave WhatsApp. Consistent with the product thesis.
- Con: API keys in WhatsApp message history (security concern — WhatsApp is E2E encrypted, but still visible in the thread).

**Option B:** Visit textslash.dev/settings in a browser, update keys there.
- Pro: More secure (HTTPS form, not in chat history). Familiar pattern.
- Con: Leaves WhatsApp. Requires a settings page.

**Recommendation:** Both. Option B for initial setup (onboarding website). Option A as a convenience shortcut for users who want to stay in WhatsApp. Warn users that keys will appear in their chat history.

## When to Revisit

- Phase 7 deploy is complete and working
- Multi-user provisioning pipeline is designed (Fly.io Machines API integration)
- At least 3 real WhatsApp development sessions completed (to inform skill design)
- Onboarding website exists (signup form, GitHub OAuth, key entry)

## Research Sources

- Current VM setup: `vm/Dockerfile`, `vm/vm-server.js`
- Existing skill format: `.claude/skills/` (20 skills in the repo)
- VM bootstrap reference: `docs/solutions/developer-experience/docker-vm-claude-code-headless-setup-20260225.md`
- Fly.io Machines API: https://fly.io/docs/machines/api/
- Claude Code skills docs: https://code.claude.com/docs/en/skills
