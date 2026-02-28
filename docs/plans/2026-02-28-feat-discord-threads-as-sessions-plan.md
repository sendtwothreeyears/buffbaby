---
title: "feat: Discord Threads as Sessions (Terminals + Subagents)"
type: feat
status: completed
date: 2026-02-28
brainstorm: docs/brainstorms/2026-02-28-discord-threads-as-sessions-brainstorm.md
related: docs/roadmap/buffbaby-discord-coworking.md
---

# Discord Threads as Sessions (Terminals + Subagents)

## Overview

Discord threads become **sessions** — each thread is either a persistent terminal process or a Claude Code subagent, spawned via slash commands and managed via tmux on the VM. The main channel stays as the orchestrator (existing single-process model unchanged). Threads are an additive feature.

**Core metaphor:** Thread = tmux session. Discord thread ID = tmux session name. Thread title = self-documenting label.

## Problem Statement

The current system is single-process: one Claude Code instance at a time per VM, controlled from the main channel. Users need to:

- Run long-lived processes (dev servers, watchers) while simultaneously asking Claude Code for help
- Spawn multiple agents working in parallel on different parts of a codebase
- See all active work at a glance in Discord's sidebar
- Keep the main channel clean for orchestration

## Proposed Solution

Two new slash commands (`/terminal`, `/agent`) that create Discord threads, each backed by a tmux session on the VM. Output streams to the thread via edit-in-place Discord messages. The main channel gains orchestration commands (`/status`, `/kill`).

## Architecture

```
Discord                            VM (Fly.io)
──────                            ──────────────
#workspace (main)            ←→   vm-server.js (existing /command path)
  │                                  │
  ├── Thread A (terminal)    ←→     tmux session: thread-<A-id>
  │   /terminal server npm..        └── npm run dev (cwd: /data/repos/myapp/server/)
  │                                  │
  ├── Thread B (terminal)    ←→     tmux session: thread-<B-id>
  │   /terminal client npm..        └── npm run dev (cwd: /data/repos/myapp/client/)
  │                                  │
  └── Thread C (agent)       ←→     tmux session: thread-<C-id>
      /agent server fix auth         └── claude -p (cwd: /data/repos/myapp/server/)
```

### Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Output streaming transport | **Interval polling** (`GET /thread/:id/output?since=<offset>`) at ~1s | Simplest. Matches Discord's 5-edits/5s rate limit. No persistent connections. |
| Thread routing location | **Discord adapter only** | Ship fast, extract later if needed. Thread concept is Discord-specific (WhatsApp has no threads). |
| Slash command UX | **Two separate options** (`dir` + `cmd`/`prompt`) with autocomplete for `dir` | Uses Discord-native UX affordances. No parsing ambiguity. |
| Thread vs main isolation | **Fully independent** | Thread endpoints don't touch `busy` flag. Main channel and threads are parallel systems. |
| Thread state authority | **In-memory Map on VM** (not thread title) | Titles can be edited by users. The VM's in-memory Map + tmux session naming is the source of truth. SQLite persistence deferred to post-MVP. |

## Technical Approach

### Phase 1: VM Infrastructure (tmux + endpoints)

#### 1.1 Install tmux in Dockerfile

```dockerfile
# vm/Dockerfile — add tmux to apt-get install line
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    tmux \
    python3 \
    ...
```

#### 1.2 tmux Manager Module — `vm/tmux.js`

New module encapsulating all tmux operations. Keeps `vm-server.js` clean.

```javascript
// vm/tmux.js — key exports
module.exports = {
  createSession(sessionName, cwd, command),  // tmux new-session -d -s <name> -c <cwd> <cmd>
  sendInput(sessionName, text),              // tmux send-keys -t <name> <text> Enter
  getLogPath(sessionName),                   // /tmp/thread-<name>.log
  readOutput(sessionName, byteOffset),       // read log file from byte offset
  killSession(sessionName),                  // tmux kill-session -t <name>
  listSessions(),                            // tmux list-sessions -F "#{session_name}"
  sessionExists(sessionName),               // check if session is alive
  getProcessRunning(sessionName),           // check if pane process is alive
};
```

Key implementation details:
- All commands via `child_process.execFile("tmux", [...args])` — no shell interpretation, no injection risk
- Session names: `thread-<discord-thread-id>` (safe characters only — digits and hyphens)
- **Output capture via log file, NOT `capture-pane`:** On session creation, run `tmux pipe-pane -t <session> 'cat >> /tmp/thread-<session>.log'` to redirect all pane output to a persistent log file. `readOutput()` reads from this file starting at a byte offset. This avoids tmux's finite scrollback buffer (default 2000 lines) and supports true byte-offset streaming for long-running processes.
- Process liveness check via `tmux list-panes -t <session> -F "#{pane_pid} #{pane_dead}"` to detect crashed processes
- On session kill, clean up the log file (`/tmp/thread-<session>.log`)

#### 1.3 New VM Endpoints

All new endpoints are independent of the existing `busy` flag and `activeChild`. They have zero interaction with the main `/command` pipeline.

**`POST /thread/create`**

```
Body: { threadId: string, type: "terminal"|"agent", dir: string, command: string, createdBy: string }
Response 201: { created: true, tmuxSession: string }
Error 400: { error: "Invalid directory" }   — path traversal or not found
Error 409: { error: "Thread already exists" } — tmux session name collision
Error 429: { error: "Max threads exceeded" } — configurable via MAX_THREADS env var (default 5)
```

Behavior:
1. Validate `dir` — resolve against `REPOS_DIR`, reject `..` sequences, confirm directory exists
2. Check thread count against `MAX_THREADS` (count active tmux sessions via `tmux list-sessions`)
3. Check for stale tmux session with same name — kill if exists
4. Create tmux session with appropriate command:
   - Terminal: `tmux new-session -d -s thread-<id> -c <resolved-dir> "<command>"`
   - Agent: `tmux new-session -d -s thread-<id> -c <resolved-dir>` (starts a shell), then `tmux send-keys -t thread-<id> 'claude -p --dangerously-skip-permissions "<prompt>"' Enter`
5. Enable output logging: `tmux pipe-pane -t thread-<id> 'cat >> /tmp/thread-<id>.log'`
6. Track thread metadata in an in-memory Map (`activeThreads`): `{ threadId, type, dir, command, createdBy, createdAt }`
7. Return success

**Path validation** (critical — prevents arbitrary file access):
```javascript
function resolveThreadDir(dir) {
  const REPOS_DIR = process.env.REPOS_DIR || "/data/repos";
  const resolved = path.resolve(REPOS_DIR, dir);
  if (!resolved.startsWith(REPOS_DIR + "/") && resolved !== REPOS_DIR) {
    throw new Error("Invalid directory: path traversal detected");
  }
  if (!fs.existsSync(resolved)) {
    throw new Error("Invalid directory: not found");
  }
  return resolved;
}
```

**`POST /thread/:id/input`**

```
Body: { text: string }
Response 200: { sent: true }
Error 404: { error: "Thread not found" }
Error 410: { error: "Thread ended" }        — process exited, thread is stale
```

Behavior:
1. Look up thread in in-memory Map — verify exists and tmux session is alive
2. For terminal threads: `tmux send-keys -t thread-<id> "<text>" Enter`
3. For agent threads: check if Claude Code process is still running in the pane. If idle (process exited back to shell), run: `tmux send-keys -t thread-<id> 'claude -p --continue --dangerously-skip-permissions "<text>"' Enter`. Note: the command invocation itself will appear in the output log — the Discord adapter should strip lines matching the `claude -p` invocation pattern before displaying.
4. Return success

**`GET /thread/:id/output`**

```
Query: ?since=<byte-offset>  (default 0)
Response 200: { output: string, offset: number, processRunning: boolean, exitCode: number|null }
Error 404: { error: "Thread not found" }
```

Behavior:
1. Read the log file `/tmp/thread-<id>.log` from byte offset `since`
2. Return new content and the updated byte offset (file size after read)
3. Check if the pane's process is still running via `tmux list-panes`
4. If process has exited, include exit code

The log file is populated by `tmux pipe-pane` (set up during `/thread/create`). This approach never loses output regardless of scrollback buffer size, and byte offsets are stable.

**`POST /thread/:id/kill`**

```
Response 200: { killed: true, summary: string }
Error 404: { error: "Thread not found" }
```

Behavior:
1. Kill tmux session: `tmux kill-session -t thread-<id>`
2. Generate summary:
   - Terminal: last 10 lines of the log file + exit code
   - Agent: last Claude Code response text (tail of log file)
3. Remove thread from in-memory Map, delete log file (`/tmp/thread-<id>.log`)
4. Return summary text

**`GET /threads`**

```
Response 200: { threads: [{ threadId, type, dir, command, status, createdBy, createdAt, processRunning }] }
```

Behavior:
1. List active tmux sessions via `tmux list-sessions`
2. Filter to sessions matching the `thread-*` naming pattern
3. Cross-reference with in-memory Map for metadata (type, dir, command)
4. Check process liveness per session
5. Return enriched list

### Phase 2: Discord Adapter — Thread Creation

#### 2.1 Register New Slash Commands

Add to `CORE_COMMANDS` in `adapters/discord.js`:

```javascript
new SlashCommandBuilder()
  .setName("terminal")
  .setDescription("Spawn a persistent terminal in a thread")
  .addStringOption(opt =>
    opt.setName("dir").setDescription("Directory (repo or subdirectory)").setRequired(true).setAutocomplete(true)
  )
  .addStringOption(opt =>
    opt.setName("command").setDescription("Command to run (e.g., npm run dev)").setRequired(true)
  ),

new SlashCommandBuilder()
  .setName("agent")
  .setDescription("Spawn a Claude Code agent in a thread")
  .addStringOption(opt =>
    opt.setName("dir").setDescription("Directory (repo or subdirectory)").setRequired(true).setAutocomplete(true)
  )
  .addStringOption(opt =>
    opt.setName("prompt").setDescription("What should the agent do?").setRequired(true)
  ),

new SlashCommandBuilder()
  .setName("done")
  .setDescription("Close the current thread session"),

new SlashCommandBuilder()
  .setName("kill")
  .setDescription("Kill a thread session from main channel")
  .addStringOption(opt =>
    opt.setName("thread").setDescription("Thread name or ID").setRequired(true).setAutocomplete(true)
  ),
```

#### 2.2 Autocomplete for `dir`

Extend the existing autocomplete handler to handle `/terminal` and `/agent` `dir` options:

```javascript
// In interactionCreate autocomplete handler
if (focused.name === "dir") {
  // Reuse existing GET /repos endpoint — return cloned repo names as choices
  // e.g., [{ name: "myapp", value: "myapp" }, { name: "shared-lib", value: "shared-lib" }]
}
```

For MVP, autocomplete lists cloned repo names only (from the existing `GET /repos` endpoint). Users can type subdirectory paths manually (e.g., `myapp/server`). Deep directory listing is a future enhancement.

#### 2.3 Thread Creation Flow

When `/terminal` or `/agent` is invoked:

1. `interaction.deferReply()` — thread + process creation takes >3s
2. Create Discord thread from the main channel:
   ```javascript
   const thread = await interaction.channel.threads.create({
     name: type === "terminal"
       ? `🖥 terminal: ${dir} — ${command}`
       : `🤖 agent: ${dir} — ${prompt.slice(0, 50)}`,
     autoArchiveDuration: 1440, // 24 hours
     reason: `${type} session spawned by ${interaction.user.tag}`,
   });
   ```
3. Call `POST /thread/create` on VM with `{ threadId: thread.id, type, dir, command, createdBy: interaction.user.id }`
4. Handle errors (invalid dir → reply with error, max threads → reply with count)
5. On success: `interaction.editReply({ content: "Session started → ${thread}" })` (links to thread)
6. Register thread in local `activeThreads` Map
7. Start output polling loop for this thread

#### 2.4 Active Threads Map (Discord adapter state)

```javascript
const activeThreads = new Map();
// key: discord thread ID
// value: { type, dir, discordThread, pollingInterval, lastOffset, lastMessageId }
```

This is in-memory state on the relay. On relay restart, it is rebuilt from the VM's `GET /threads` endpoint + Discord thread lookups.

### Phase 3: Discord Adapter — Message Routing

#### 3.1 Fix the Channel Filter

The existing `messageCreate` handler drops all messages not in `DISCORD_CHANNEL_ID`. Modify to also accept messages from threads whose parent is the main channel:

```javascript
// adapters/discord.js — messageCreate handler
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // Check: is this a thread we're managing?
  if (message.channel.isThread() && activeThreads.has(message.channel.id)) {
    return handleThreadMessage(message);
  }

  // Existing main channel filter
  if (message.channel.id !== DISCORD_CHANNEL_ID) return;

  // ... existing onMessage() path
});
```

#### 3.2 Thread Message Handler

```javascript
async function handleThreadMessage(message) {
  const threadId = message.channel.id;
  const threadInfo = activeThreads.get(threadId);

  // Check user is in allowlist
  if (!ALLOWED_USER_IDS.includes(message.author.id)) return;

  // Send text as stdin to the VM thread
  const vmUrl = process.env.VM_URL || "http://localhost:3001";
  await fetch(`${vmUrl}/thread/${threadId}/input`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: message.content }),
  });
}
```

Key points:
- Thread messages **never** call `onMessage()` — they bypass relay-core entirely
- User allowlist is still enforced
- Messages are forwarded as-is to the VM thread's stdin

#### 3.3 Slash Commands in Threads

When `/done` is used inside a thread:

```javascript
// In interactionCreate handler
if (interaction.commandName === "done") {
  const threadId = interaction.channelId;
  if (!activeThreads.has(threadId)) {
    return interaction.reply({ content: "Not in an active thread session.", ephemeral: true });
  }

  await interaction.deferReply();
  const response = await fetch(`${vmUrl}/thread/${threadId}/kill`, { method: "POST" });
  const { summary } = await response.json();

  await interaction.editReply({ content: `Session ended.\n\n**Summary:**\n${summary}` });

  // Stop polling, clean up
  clearInterval(activeThreads.get(threadId).pollingInterval);
  activeThreads.delete(threadId);

  // Archive the Discord thread
  await interaction.channel.setArchived(true);
}
```

Other slash commands used inside a thread (like `/status`, `/clone`) should continue to work normally — they route through the existing `handleSlashCommand` path which calls `onMessage()`. The key distinction: `/done` is thread-specific, everything else uses the existing flow.

### Phase 4: Output Streaming (Polling Loop)

#### 4.1 Polling Mechanism

After a thread is created, the Discord adapter starts a polling loop:

```javascript
function startOutputPolling(threadId) {
  const threadInfo = activeThreads.get(threadId);
  let lastOffset = 0;
  let currentMessageId = null;
  let currentMessageLength = 0;

  const interval = setInterval(async () => {
    try {
      const res = await fetch(`${vmUrl}/thread/${threadId}/output?since=${lastOffset}`);
      if (!res.ok) { clearInterval(interval); return; }

      const { output, offset, processRunning, exitCode } = await res.json();
      if (!output) return; // no new output

      lastOffset = offset;

      // Format output as monospace code block
      const formatted = formatTerminalOutput(output);

      // Edit-in-place or create new message
      if (currentMessageId && currentMessageLength + formatted.length < 1900) {
        // Edit existing message — append new output
        const existing = await threadInfo.discordThread.messages.fetch(currentMessageId);
        const newContent = existing.content + formatted;
        await existing.edit(newContent);
        currentMessageLength = newContent.length;
      } else {
        // New message
        const msg = await threadInfo.discordThread.send(formatAsCodeBlock(formatted));
        currentMessageId = msg.id;
        currentMessageLength = formatted.length;
      }

      // Process exited — notify and stop polling
      if (!processRunning) {
        await threadInfo.discordThread.send(
          `Process exited with code ${exitCode ?? "unknown"}.`
        );
        clearInterval(interval);
      }
    } catch (err) {
      console.error(`[thread:${threadId}] polling error:`, err.message);
    }
  }, 1000); // 1 second interval — respects Discord's 5-edits/5s rate limit

  threadInfo.pollingInterval = interval;
  threadInfo.lastOffset = 0;
}
```

#### 4.2 Output Formatting

```javascript
function formatTerminalOutput(raw) {
  // Strip ANSI escape codes
  const stripped = raw.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "");
  // Truncate lines longer than 100 chars
  return stripped.split("\n").map(line => line.slice(0, 100)).join("\n");
}

function formatAsCodeBlock(text) {
  // Wrap in Discord code block, cap at 1900 chars (leave room for ``` markers)
  const capped = text.slice(0, 1900);
  return "```\n" + capped + "\n```";
}
```

#### 4.3 Agent Output

Agent threads use **plain text output** (no `--output-format` flag). The log file captures everything Claude Code prints to the terminal — progress messages, tool usage, and results — as human-readable text. This is simpler and more robust than parsing stream-json from a terminal capture, since the log file contains rendered terminal output (not raw stdout).

The existing `::progress::` and `::approval::` marker patterns from `vm-server.js:166-187` are irrelevant here — those are parsed from piped stdout in the single-process model. In the tmux model, Claude Code's terminal output goes directly to the pane (and thus the log file) without structured markers. The output is displayed as-is in Discord code blocks.

### Phase 5: Orchestration Commands

#### 5.1 `/status` Enhancement

The existing `/status` command shows repo/branch info. Extend it to include active threads:

```javascript
// When handling /status, also call GET /threads
const threadRes = await fetch(`${vmUrl}/threads`);
const { threads } = await threadRes.json();

if (threads.length > 0) {
  statusText += "\n\n**Active Threads:**\n";
  for (const t of threads) {
    const uptime = formatUptime(t.createdAt);
    const icon = t.type === "terminal" ? "🖥" : "🤖";
    statusText += `${icon} \`${t.dir}\` — ${t.command.slice(0, 40)} (${uptime})\n`;
  }
}
```

#### 5.2 `/kill` from Main Channel

```javascript
if (interaction.commandName === "kill") {
  const threadArg = interaction.options.getString("thread");
  // Look up in activeThreads by name match or ID
  const match = findThreadByNameOrId(threadArg);
  if (!match) return interaction.reply({ content: "Thread not found.", ephemeral: true });

  await interaction.deferReply();
  await fetch(`${vmUrl}/thread/${match.threadId}/kill`, { method: "POST" });
  clearInterval(match.pollingInterval);
  activeThreads.delete(match.threadId);
  await match.discordThread.setArchived(true);
  await interaction.editReply({ content: `Killed thread: ${match.discordThread.name}` });
}
```

### Phase 6: Recovery & Resilience

#### 6.1 Bot Restart Recovery

On Discord `client.ready`:

```javascript
async function recoverThreads() {
  // 1. Get active threads from VM
  const res = await fetch(`${vmUrl}/threads`);
  const { threads } = await res.json();

  // 2. For each thread, find the Discord thread
  const mainChannel = client.channels.cache.get(DISCORD_CHANNEL_ID);
  const archivedThreads = await mainChannel.threads.fetchArchived();
  const activeDiscordThreads = await mainChannel.threads.fetchActive();

  for (const t of threads) {
    const discordThread =
      activeDiscordThreads.threads.get(t.threadId) ||
      archivedThreads.threads.get(t.threadId);

    if (!discordThread) {
      // Discord thread gone — kill orphaned tmux session
      await fetch(`${vmUrl}/thread/${t.threadId}/kill`, { method: "POST" });
      continue;
    }

    // Unarchive if needed
    if (discordThread.archived) await discordThread.setArchived(false);

    // Re-register in activeThreads and restart polling
    activeThreads.set(t.threadId, { type: t.type, dir: t.dir, discordThread });
    startOutputPolling(t.threadId);
  }
}
```

#### 6.2 VM Restart Recovery

tmux sessions do not survive container restarts. On VM restart, the in-memory thread Map is empty and no tmux sessions exist — the VM starts clean. The relay's bot restart recovery (6.1) handles the Discord side: it calls `GET /threads`, gets an empty list, and archives any orphaned Discord threads.

#### 6.3 Process Crash Detection

The polling loop already checks `processRunning` on each poll. When a terminal process crashes:

1. The poll returns `processRunning: false` with `exitCode`
2. The Discord adapter posts a notification: `Process exited (code <N>). Thread remains open — type /done to close.`
3. The thread stays open — user can read output history
4. Further text messages in the thread return an error: "Process has exited. Use `/done` to close this thread."

## Implementation Phases

### Phase 1: VM Foundation
- [x] Add `tmux` to `vm/Dockerfile` (already present)
- [x] Create `vm/tmux.js` module (create, input, readOutput via log file, kill, list, exists, processRunning)
- [x] Implement path validation helper (`resolveThreadDir`)
- [x] Implement `POST /thread/create` endpoint
- [x] Implement `POST /thread/:id/input` endpoint
- [x] Implement `GET /thread/:id/output` endpoint
- [x] Implement `POST /thread/:id/kill` endpoint
- [x] Implement `GET /threads` endpoint
- [ ] Test all endpoints manually via curl

### Phase 2: Discord Thread Creation
- [x] Add `/terminal`, `/agent`, `/done`, `/kill` to `CORE_COMMANDS`
- [x] Add `dir` autocomplete handler
- [x] Implement thread creation flow (Discord thread + VM call)
- [x] Add `activeThreads` Map to Discord adapter
- [x] Handle creation errors (invalid dir, max threads)

### Phase 3: Message Routing & Output
- [x] Modify `messageCreate` filter to accept managed thread messages
- [x] Implement `handleThreadMessage` for stdin forwarding
- [x] Implement output polling loop with edit-in-place
- [x] Implement output formatting (ANSI strip, code blocks, 2000-char chunking)
- [x] Handle agent-specific output parsing (stream-json format)
- [x] Implement `/done` slash command in threads

### Phase 4: Orchestration & Recovery
- [x] Extend `/status` to show active threads
- [x] Implement `/kill` from main channel
- [x] Implement bot restart recovery (`recoverThreads`)
- [x] Process crash detection and user notification

## Files Modified

| File | Changes |
|------|---------|
| `vm/Dockerfile` | Add `tmux` to apt-get install |
| `vm/tmux.js` | **NEW** — tmux CLI wrapper module |
| `vm/vm-server.js` | 5 new endpoints: `/thread/create`, `/thread/:id/input`, `/thread/:id/output`, `/thread/:id/kill`, `/threads` |
| `adapters/discord.js` | Slash commands, thread creation, message routing, output polling, recovery |
| `vm/.env.example` | Add `MAX_THREADS=5` |

**Note:** `relay-core.js`, `server.js`, and other adapters (WhatsApp, Telegram) are untouched. Thread messages bypass relay-core entirely.

## Edge Cases & Mitigations

| Edge Case | Mitigation |
|-----------|------------|
| Path traversal in `dir` arg (`../../etc`) | `resolveThreadDir` validates resolved path starts with REPOS_DIR |
| Process crashes mid-run | Polling detects `processRunning: false`, notifies user in thread |
| Bot restarts with active threads | `recoverThreads` on startup queries VM `GET /threads` + looks up Discord threads |
| VM restarts (container restart) | tmux sessions die with the container. Relay detects empty thread list, archives orphaned Discord threads. |
| User manually creates Discord thread | Not in `activeThreads` map → messages silently ignored |
| User edits thread title | SQLite is source of truth, not title. No impact. |
| Max threads exceeded | `POST /thread/create` returns 429, adapter shows friendly error |
| Discord rate limit on edits | Polling at 1s = max 1 edit/s/thread, well under 5/5s limit |
| Agent emits `::approval::` marker | **Phase 2 concern** — for MVP, agent threads run with `--dangerously-skip-permissions` (auto-approve). Thread-local approval flow is a future enhancement. |
| Two threads modifying same directory | User responsibility. Same as running two terminals in same dir locally. |
| Large stdin paste | tmux handles arbitrary stdin. No special handling needed. |

## Acceptance Criteria

### Functional Requirements

- [ ] `/terminal server npm run dev` creates a Discord thread, starts the process, streams output
- [ ] Text messages in a terminal thread are piped as stdin to the process
- [ ] `/agent server fix the auth bug` creates a Discord thread, runs Claude Code, streams output
- [ ] Follow-up messages in an agent thread spawn `--continue` sessions
- [ ] `/done` in any thread kills the process, posts a summary, archives the thread
- [ ] `/status` shows all active threads with type, directory, and uptime
- [ ] `/kill <thread>` from main channel terminates a thread remotely
- [ ] Main channel behavior is completely unchanged — freeform messages still go through relay-core
- [ ] 5 threads can run concurrently (configurable via MAX_THREADS)
- [ ] Path traversal in `dir` is rejected with a clear error

### Non-Functional Requirements

- [ ] Output polling does not exceed Discord's rate limits
- [ ] Bot restart recovers active thread sessions within 10s
- [ ] VM restart reconciles stale thread records
- [ ] Memory usage stays under 4GB with 5 active threads (monitor during testing)

### Quality Gates

- [ ] All new VM endpoints tested via curl in local Docker
- [ ] Thread creation → message → /done lifecycle works end-to-end
- [ ] Bot restart recovery verified (kill bot, restart, verify threads resume)
- [ ] Path traversal attack rejected (manual test with `../../etc`)

## Dependencies & Prerequisites

- **tmux** — must be added to VM Docker image (trivial)
- **Discord bot permissions** — bot needs `CREATE_PUBLIC_THREADS` permission in the channel. Verify in Discord server settings.
- **Phase 12 complete** — slash command registration, Discord adapter, relay-core patterns all established

## Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Log file grows unbounded for long-running threads | Medium | Low | Clean up log on `/done`. Add size cap check in polling (warn user if >10MB). |
| Memory exhaustion with 5 concurrent threads | Medium | High | Default MAX_THREADS=5, monitor in testing, document per-VM tuning |
| Discord thread archival breaks polling | Low | Medium | Recovery loop handles archived threads (unarchive or clean up) |
| Agent `--continue` context window exhaustion | Low | Low | Agent process errors naturally. User creates new thread. |

## Future Considerations

- **SQLite thread persistence** — add a `threads` table (migration v3) for durable thread history, metadata recovery across VM restarts, and historical records of ended threads. MVP uses in-memory Map + tmux session naming convention instead.
- **Thread-local approval flow** — when agents need PR approval, implement inline approve/reject in the thread
- **Thread types expansion** — `/browser <url>` for Playwright sessions, `/logs <service>` for log tailing
- **Multi-user threads** — collaborative sessions where multiple users can interact (coworking vision)
- **Thread output export** — `/export` to download full thread output as a file
- **Resource budgets** — per-thread memory/CPU limits via cgroups or Docker resource constraints

## References

### Internal

- Brainstorm: `docs/brainstorms/2026-02-28-discord-threads-as-sessions-brainstorm.md`
- Discord adapter: `adapters/discord.js` — slash command registration (lines 35-92), message routing (lines 218-260)
- VM server: `vm/vm-server.js` — process spawn pattern (lines 110-307), busy flag (line 57)
- Database: `vm/db.js` — migration pattern (lines 1-50)
- Process management learnings: `docs/solutions/developer-experience/docker-vm-claude-code-headless-setup-20260225.md`
- State machine patterns: `docs/solutions/integration-issues/e2e-demo-loop-progress-approval-cancel-20260227.md`
- Callback streaming pattern: same file — "Reset → Accumulate → Drain"
- Relay state constraint: `docs/solutions/integration-issues/stateful-relay-multi-machine-deploy-20260227.md`

### Lessons Applied

- **Detached process groups**: Kill via negative PID for clean teardown (from Docker VM setup learnings)
- **Explicit states over boolean flags**: Thread status uses string enum, not booleans (from state machine learnings)
- **Swallow stdin errors**: `child.stdin.on("error", () => {})` when child dies early (from Docker VM learnings)
- **Edit-in-place pattern**: Post one message, keep editing — avoids rate limits (from Phase 12)
- **Single-machine relay**: `activeThreads` Map is in-memory. Same single-machine constraint as `userState`. Document for future scaling.
