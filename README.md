# Authentic's Agentic Engineering Techniques

How we use AI agents (Claude Code, Codex CLI, Gemini CLI) as first-class engineering teammates at [Authentic](https://authentic.app).

This repo contains our real configuration files, slash commands, and workflows — the system we've built to make multi-agent software development practical for a small startup team.

---

## The Core Idea

We treat AI agents not as autocomplete tools but as engineers with specific workflows, safety rails, and review processes. The system is built around three key principles:

1. **Layered context** — A hierarchy of CLAUDE.md files gives agents the right knowledge at the right scope
2. **Multi-agent review** — Parallel agents from different models catch different classes of bugs
3. **Self-improving codebase** — Agents are instructed to document what they learn, making the system smarter over time

---

## How Our Project Is Structured

Authentic is a mobile app with a React Native frontend and a Node.js backend. Each lives in its own git repo, and both sit inside a **workspace** — a parent directory that coordinates shared configuration across repos.

```
Engineering/
└── MainRepos/                    ← Workspace (its own git repo)
    ├── CLAUDE.md                 ← Workspace-level agent instructions
    ├── .claude/commands/         ← Workspace-level slash commands
    ├── Authentic_React/          ← Frontend repo (independent git repo)
    │   └── CLAUDE.md             ← Frontend-specific agent instructions
    └── Authentic_Backend/        ← Backend repo (independent git repo)
        └── CLAUDE.md             ← Backend-specific agent instructions
```

On top of this, there's a **global** layer (`~/.claude/CLAUDE.md`) that applies to every project on the machine — not just Authentic. This is where our most broadly useful patterns live: multi-model workflows, language overloading, parallelization strategies, safety conventions, and the meta-patterns for how agents should behave in general.

### The Three Layers

| Layer | Scope | What goes here |
|-------|-------|---------------|
| **Global** (`~/.claude/CLAUDE.md`) | Every project on this machine | Universal agent behaviors, multi-model workflows, language triggers, safety rails |
| **Workspace** (`./CLAUDE.md` at project root) | All repos in this project | Project conventions, git workflow, testing strategy, documentation hierarchy |
| **Repo-specific** (`child-repo/CLAUDE.md`) | One service or app | Tech stack, API patterns, deployment, caching, lessons learned |

Each layer adds context. An agent working in `Authentic_React/` sees all three layers: Global + Workspace + Frontend. Instructions in child files take precedence over parent files.

**For most people reading this repo**, the **global CLAUDE.md** will be the most immediately useful — it contains patterns that work regardless of what you're building. The workspace and repo-specific files are included as real-world examples of how we apply those patterns to a production app.

### What's In This Repo

```
Authentics-Agentic-Techniques-Public/
├── README.md
├── AGENTS.md Examples/           ← All CLAUDE.md / AGENTS.md files
│   ├── global.md                 ← Global layer (most universally useful)
│   ├── workspace.md              ← Workspace layer (real production example)
│   ├── frontend-example.md       ← Frontend layer (real, tech stack redacted)
│   ├── backend-example.md        ← Backend layer (real, tech stack redacted)
│   ├── frontend-template.md      ← Blank frontend template
│   └── backend-template.md       ← Blank backend template
├── commands/                     ← Slash commands (skills)
│   ├── code_review.md
│   ├── code_review_critical.md
│   ├── team_three_review.md
│   ├── meta-review.md
│   ├── ship.md
│   ├── compushar.md
│   ├── fix-the-things.md
│   ├── wrap-it-up.md
│   ├── investigate.md
│   ├── capture-skill.md
│   └── meta-learn.md
└── scripts/
    └── sync-commands-to-codex.sh  ← Claude ↔ Codex command sync
```

The **`AGENTS.md Examples/`** folder contains all our agent instruction files. The **examples** are our real production files with specific technologies, domains, and infrastructure details redacted (marked with `[REDACTED]`). The **templates** are blank fill-in-the-blank versions you can start from.

| File | What it is |
|------|-----------|
| [`global.md`](AGENTS.md%20Examples/global.md) | Our actual global CLAUDE.md — the universal patterns layer |
| [`workspace.md`](AGENTS.md%20Examples/workspace.md) | Our actual workspace CLAUDE.md — a real production example |
| [`frontend-example.md`](AGENTS.md%20Examples/frontend-example.md) | Our actual frontend CLAUDE.md with tech stack redacted |
| [`backend-example.md`](AGENTS.md%20Examples/backend-example.md) | Our actual backend CLAUDE.md with tech stack redacted |
| [`frontend-template.md`](AGENTS.md%20Examples/frontend-template.md) | Blank template for a frontend repo's CLAUDE.md |
| [`backend-template.md`](AGENTS.md%20Examples/backend-template.md) | Blank template for a backend repo's CLAUDE.md |

---

## Slash Commands (Skills)

Slash commands — also called **skills** in Claude Code — are reusable prompts stored as markdown files in `.claude/commands/`. Type `/command-name` in Claude Code to execute them. Like CLAUDE.md files, commands can live at three levels:

| Location | Scope | Example use |
|----------|-------|-------------|
| `~/.claude/commands/` | Global (all projects) | Code review, investigation, meta-learning |
| `.claude/commands/` (workspace) | This project | Ship workflow, fix-all, wrap-up |
| `child-repo/.claude/commands/` | One repo | Build scripts, repo-specific automation |

### Code Review

| Command | What it does |
|---------|-------------|
| [`/code_review`](commands/code_review.md) | Senior engineer-level review — architecture, patterns, correctness |
| [`/code_review_critical`](commands/code_review_critical.md) | Adversarial review — race conditions, failure modes, security holes |
| [`/team_three_review`](commands/team_three_review.md) | 6-agent parallel review: Claude + Codex + Gemini, each running normal AND critical review |
| [`/meta-review`](commands/meta-review.md) | Consolidate feedback from multiple review agents into one actionable list |

**`/team_three_review` is worth highlighting.** It spawns six agents in parallel — three different models, each running both a standard and critical review — all from within a single Claude Code terminal session. The result is a diverse set of perspectives that catches far more issues than any single model. It's probably our best example of multi-model intelligence working inside a unified interface.

### Workflow

| Command | What it does |
|---------|-------------|
| [`/ship`](commands/ship.md) | Full implementation-to-PR workflow (11 phases): plan, implement, dual-agent review, self-correct, PR |
| [`/compushar`](commands/compushar.md) | Quick commit → push → create/update PR |
| [`/fix-the-things`](commands/fix-the-things.md) | Detect all lint, type, and test failures in parallel, then fix them sequentially |
| [`/wrap-it-up`](commands/wrap-it-up.md) | Quad code review (2 standard + 2 critical), consolidate, fix issues, open PR |

### Investigation

| Command | What it does |
|---------|-------------|
| [`/investigate`](commands/investigate.md) | 3-agent bug investigation (Claude + Codex + Gemini) with synthesis |

### Learning & Improvement

| Command | What it does |
|---------|-------------|
| [`/capture-skill`](commands/capture-skill.md) | Extract learnings from the current session into CLAUDE.md or a new skill |
| [`/meta-learn`](commands/meta-learn.md) | Analyze your conversation history to identify patterns, friction, and improvements |

### Not Included

We also have a `/deep-research` command that automates ChatGPT's Deep Research feature via browser automation (using the Claude-in-Chrome MCP). It works — you can have Claude Code drive a Chrome tab, submit a research prompt to ChatGPT, wait for results, and save the output to markdown. We're not including it here due to the gray area around automating another provider's interface, but it's worth knowing that this kind of cross-model orchestration is technically possible.

### Scripts

| Script | What it does |
|--------|-------------|
| [`sync-commands-to-codex.sh`](scripts/sync-commands-to-codex.sh) | Sync Claude Code commands to Codex CLI via hardlinks (single source of truth) |

---

## Key Patterns

### Language Overloading

We define trigger words in our **global CLAUDE.md** that activate specific agent behaviors. This keeps conversation concise — instead of explaining what you want, you use a single word:

| Trigger | Behavior |
|---------|----------|
| **"clear"** | Spawn a fresh, headless agent with isolated context |
| **"loopy"** | Full autonomy — implement, validate, iterate until actually done |
| **"dialogue"** | Pause and ask all questions needed before building |
| **"ultrathink"** | Extra reasoning time for edge cases and side effects |
| **"full force"** | Parallel Claude + Codex analysis, merged into one document |
| **"triple force"** | Parallel Claude + Codex + Gemini analysis, merged |

These live in the global layer because they're useful across every project, not tied to any specific codebase. See [`global.md`](AGENTS.md%20Examples/global.md) for full definitions and implementation details.

### Multi-Model Reviews

Different models catch different bugs. Our review workflows exploit this by running agents from multiple providers in parallel:

```
/team_three_review
├── Claude Opus  → standard review
├── Claude Opus  → critical review
├── Codex        → standard review
├── Codex        → critical review
├── Gemini       → standard review
└── Gemini       → critical review
    ↓
/meta-review → consolidated, deduplicated findings
```

Each model has different strengths: Claude is thorough on architecture, Codex finds subtle logic errors, Gemini catches different edge cases. Running all three in parallel gives broader coverage than any single model — and it all happens from a single Claude Code session.

### Team Coordination (Experimental)

Claude Code has a team/task system that allows agents to coordinate work — creating task lists, assigning work to teammates, sending messages between agents, and managing dependencies. Some of our commands use this system (notably `/ship`), while others use the simpler pattern of spawning parallel agents independently. We find the team system interesting but haven't fully standardized on it across all our workflows. It's an evolving area.

### Self-Improving Codebase

Agents are instructed to update CLAUDE.md files when they discover:
- Non-obvious debugging insights
- Undocumented patterns or conventions
- Gotchas that would trip up the next agent
- Wrong or misleading documentation

This creates a flywheel: each agent session leaves the codebase more navigable for the next one. A 30-second addition saves hours across future sessions.

### Thrashing Detection

When an agent detects it's stuck (3+ failed attempts at the same problem, circular debugging), it's instructed to:

1. Stop and acknowledge the situation
2. Generate a **handoff prompt** with: what was tried, current state, observed behavior, possible directions
3. Suggest spawning a fresh agent with the handoff — fresh context without accumulated assumptions often breaks through stuck situations

### Safety Rails

Destructive operations require explicit human approval:
- `rm -rf`, `git push --force`, `git reset --hard`
- Production deployments
- Database migrations with `--force-reset`

Agents are also instructed to confirm target environments before data-affecting commands.

---

## Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (primary)
- [Codex CLI](https://github.com/openai/codex) (optional, for multi-model workflows)
- [Gemini CLI](https://github.com/google-gemini/gemini-cli) (optional, for triple-model workflows)

---

## About Authentic

[Authentic](https://authentic.app) is a social media app focused on real, ephemeral content shared between close friends. We're a small team that leans heavily on agentic engineering to move fast without sacrificing quality.

---

## License

MIT
