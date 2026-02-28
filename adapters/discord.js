const { Client, GatewayIntentBits, AttachmentBuilder, ActivityType, Options, REST, Routes, SlashCommandBuilder, ChannelType } = require("discord.js");
const { chunkText, truncateAtFileBoundary, fetchImageBuffer, viewLinkLabel } = require("./utils");

const {
  DISCORD_BOT_TOKEN,
  DISCORD_CHANNEL_ID,
  DISCORD_ALLOWED_USER_IDS,
  CLAUDE_HOST = "http://localhost:3001",
} = process.env;

const MAX_MSG = 2000; // Discord message limit

// Track progress messages per user for edit-in-place
const progressMessages = new Map(); // userId -> Discord Message object

// Track pending slash command interactions for deferred reply
const pendingInteractions = new Map(); // userId -> { interaction, finalSent: boolean }

// Track active thread sessions (Discord thread ID -> thread state)
const activeThreads = new Map(); // threadId -> { type, dir, command, discordThread, pollingInterval, lastOffset, currentMessageId, currentMessageLength }

let client;
let targetChannel;
let guildId;
let rest;

// Currently registered skill command names (not including core commands)
let registeredSkillNames = [];

function isConfigured() {
  return !!(DISCORD_BOT_TOKEN && DISCORD_CHANNEL_ID);
}

const allowlist = new Set((DISCORD_ALLOWED_USER_IDS || "").split(",").map(s => s.trim()).filter(Boolean));

// --- Slash command definitions ---

const CORE_COMMANDS = [
  new SlashCommandBuilder().setName("help").setDescription("Show available commands and project skills"),
  new SlashCommandBuilder().setName("status").setDescription("Current repo, branch, changed files"),
  new SlashCommandBuilder().setName("clone").setDescription("Clone a repo to the VM")
    .addStringOption(opt => opt.setName("url").setDescription("Git repository URL").setRequired(true)),
  new SlashCommandBuilder().setName("switch").setDescription("Switch to a different repo")
    .addStringOption(opt => opt.setName("name").setDescription("Repository name").setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName("repos").setDescription("List all cloned repos"),
  new SlashCommandBuilder().setName("branch").setDescription("List branches, mark current"),
  new SlashCommandBuilder().setName("checkout").setDescription("Switch or create a branch")
    .addStringOption(opt => opt.setName("name").setDescription("Branch name").setRequired(true))
    .addBooleanOption(opt => opt.setName("create").setDescription("Create a new branch").setRequired(false)),
  new SlashCommandBuilder().setName("pr-create").setDescription("Create PR from current branch"),
  new SlashCommandBuilder().setName("pr-status").setDescription("Show CI status and review state"),
  new SlashCommandBuilder().setName("pr-merge").setDescription("Merge current PR"),
  new SlashCommandBuilder().setName("clear").setDescription("Start fresh conversation (reset context)"),
  new SlashCommandBuilder().setName("terminal").setDescription("Spawn a persistent terminal in a thread")
    .addStringOption(opt => opt.setName("dir").setDescription("Directory (repo or subdirectory)").setRequired(true).setAutocomplete(true))
    .addStringOption(opt => opt.setName("command").setDescription("Command to run (e.g., npm run dev)").setRequired(true)),
  new SlashCommandBuilder().setName("agent").setDescription("Spawn a Claude Code agent in a thread")
    .addStringOption(opt => opt.setName("dir").setDescription("Directory (repo or subdirectory)").setRequired(true).setAutocomplete(true))
    .addStringOption(opt => opt.setName("prompt").setDescription("What should the agent do?").setRequired(true)),
  new SlashCommandBuilder().setName("done").setDescription("Close the current thread session"),
  new SlashCommandBuilder().setName("kill").setDescription("Kill a thread session from main channel")
    .addStringOption(opt => opt.setName("thread").setDescription("Thread name or ID").setRequired(true).setAutocomplete(true)),
];

const CORE_COMMAND_NAMES = new Set(CORE_COMMANDS.map(c => c.name));

// --- Slash command registration ---

async function registerGuildCommands(commandsJson) {
  if (!rest || !guildId || !client?.application?.id) return;

  try {
    await rest.put(
      Routes.applicationGuildCommands(client.application.id, guildId),
      { body: commandsJson },
    );
    console.log(`[DISCORD] Registered ${commandsJson.length} slash command(s)`);
  } catch (err) {
    console.error(`[DISCORD_CMD_ERR] Failed to register slash commands: ${err.message}`);
  }
}

function buildAllCommands(skills) {
  const commands = CORE_COMMANDS.map(c => c.toJSON());
  const seen = new Set(CORE_COMMAND_NAMES);

  for (const skill of skills) {
    // Discord command names: lowercase, 1-32 chars, alphanumeric + hyphens + underscores
    const name = skill.name
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 32);

    if (!name || seen.has(name)) continue;
    seen.add(name);

    const desc = (skill.description || name).slice(0, 100);
    commands.push(new SlashCommandBuilder().setName(name).setDescription(desc).toJSON());
  }

  return commands;
}

// --- Interaction handlers ---

async function handleSlashCommand(interaction, onMessage) {
  const authorId = interaction.user.id;
  if (allowlist.size > 0 && !allowlist.has(authorId)) {
    await interaction.reply({ content: "You don't have access.", ephemeral: true });
    return;
  }

  // Reconstruct text from slash command
  const commandName = interaction.commandName;
  let text;

  if (commandName === "clone") {
    text = `clone ${interaction.options.getString("url")}`;
  } else if (commandName === "switch") {
    text = `switch ${interaction.options.getString("name")}`;
  } else if (commandName === "checkout") {
    const create = interaction.options.getBoolean("create");
    const name = interaction.options.getString("name");
    text = create ? `checkout -b ${name}` : `checkout ${name}`;
  } else if (commandName === "pr-create") {
    text = "pr create";
  } else if (commandName === "pr-status") {
    text = "pr status";
  } else if (commandName === "pr-merge") {
    text = "pr merge";
  } else {
    text = commandName;
  }

  // Defer reply — VM work typically takes >3s
  await interaction.deferReply();

  const userId = `discord:${authorId}`;
  pendingInteractions.set(userId, { interaction, finalSent: false });

  console.log(`[INBOUND] ${userId} (slash): ${text}`);
  onMessage(userId, text);
}

async function handleAutocomplete(interaction) {
  const focused = interaction.options.getFocused(true);

  // dir autocomplete — used by /switch, /terminal, /agent
  if (focused.name === "name" || focused.name === "dir") {
    try {
      const res = await fetch(`${CLAUDE_HOST}/repos`, { signal: AbortSignal.timeout(5000) });
      const data = await res.json();

      const choices = (data.repos || [])
        .filter(r => r.name.toLowerCase().includes(focused.value.toLowerCase()))
        .slice(0, 25)
        .map(r => ({ name: r.name, value: r.name }));

      await interaction.respond(choices);
    } catch {
      await interaction.respond([]);
    }
    return;
  }

  // thread autocomplete — used by /kill
  if (focused.name === "thread") {
    const choices = [];
    for (const [threadId, info] of activeThreads) {
      const label = `${info.type}: ${info.dir} — ${(info.command || "").slice(0, 40)}`;
      if (label.toLowerCase().includes(focused.value.toLowerCase()) || threadId.includes(focused.value)) {
        choices.push({ name: label.slice(0, 100), value: threadId });
      }
    }
    await interaction.respond(choices.slice(0, 25));
    return;
  }

  await interaction.respond([]);
}

// --- Send helper: routes through pending interaction or falls back to channel ---

async function sendViaInteractionOrChannel(userId, options) {
  const pending = pendingInteractions.get(userId);
  if (pending) {
    try {
      const { interaction, finalSent } = pending;
      if (!finalSent) {
        // First non-progress message — replace the deferred "thinking..." response
        await interaction.editReply(options);
        pending.finalSent = true;
      } else {
        await interaction.followUp(options);
      }
      return;
    } catch (err) {
      console.error(`[DISCORD_INTERACTION_ERR] ${err.message}`);
      pendingInteractions.delete(userId);
      // Fall through to channel.send
    }
  }

  if (!targetChannel) return;
  await targetChannel.send(options);
}

// --- Thread management ---

function stripAnsi(str) {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "");
}

function formatAsCodeBlock(text) {
  const capped = text.slice(0, 1900);
  return "```\n" + capped + "\n```";
}

async function handleThreadCreation(interaction, type) {
  const authorId = interaction.user.id;
  if (allowlist.size > 0 && !allowlist.has(authorId)) {
    await interaction.reply({ content: "You don't have access.", ephemeral: true });
    return;
  }

  const dir = interaction.options.getString("dir");
  const command = type === "terminal"
    ? interaction.options.getString("command")
    : interaction.options.getString("prompt");

  await interaction.deferReply();

  try {
    // Create Discord thread from the channel
    const channel = interaction.channel;
    const threadName = type === "terminal"
      ? `terminal: ${dir} — ${command.slice(0, 40)}`
      : `agent: ${dir} — ${command.slice(0, 50)}`;

    const thread = await channel.threads.create({
      name: threadName.slice(0, 100),
      type: ChannelType.PublicThread,
      autoArchiveDuration: 1440,
      reason: `${type} session spawned by ${interaction.user.tag}`,
    });

    // Call VM to create the tmux session
    const vmRes = await fetch(`${CLAUDE_HOST}/thread/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threadId: thread.id,
        type,
        dir,
        command,
        createdBy: authorId,
      }),
      signal: AbortSignal.timeout(10000),
    });

    const vmData = await vmRes.json();

    if (!vmRes.ok) {
      await thread.delete().catch(() => {});
      await interaction.editReply({ content: `Failed: ${vmData.error}` });
      return;
    }

    // Register thread locally and start polling
    activeThreads.set(thread.id, {
      type,
      dir,
      command,
      discordThread: thread,
      pollingInterval: null,
      lastOffset: 0,
      currentMessageId: null,
      currentMessageLength: 0,
    });

    startOutputPolling(thread.id);

    const icon = type === "terminal" ? "🖥" : "🤖";
    await interaction.editReply({ content: `${icon} Session started → ${thread}` });
    console.log(`[THREAD] Created ${type}: ${thread.id} (${dir})`);
  } catch (err) {
    console.error(`[THREAD_ERR] Creation failed: ${err.message}`);
    try {
      await interaction.editReply({ content: `Thread creation failed: ${err.message}` });
    } catch { /* best effort */ }
  }
}

async function handleDoneCommand(interaction) {
  const threadId = interaction.channelId;
  if (!activeThreads.has(threadId)) {
    await interaction.reply({ content: "Not in an active thread session.", ephemeral: true });
    return;
  }

  await interaction.deferReply();

  try {
    const res = await fetch(`${CLAUDE_HOST}/thread/${threadId}/kill`, {
      method: "POST",
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();

    const threadInfo = activeThreads.get(threadId);
    if (threadInfo?.pollingInterval) clearInterval(threadInfo.pollingInterval);
    activeThreads.delete(threadId);

    const summary = data.summary ? `\n\n**Last output:**\n${formatAsCodeBlock(stripAnsi(data.summary))}` : "";
    await interaction.editReply({ content: `Session ended.${summary}` });

    // Archive the thread
    try { await interaction.channel.setArchived(true); } catch { /* may lack perms */ }
    console.log(`[THREAD] Ended: ${threadId}`);
  } catch (err) {
    console.error(`[THREAD_ERR] Done failed: ${err.message}`);
    await interaction.editReply({ content: `Failed to end session: ${err.message}` });
  }
}

async function handleKillCommand(interaction) {
  const authorId = interaction.user.id;
  if (allowlist.size > 0 && !allowlist.has(authorId)) {
    await interaction.reply({ content: "You don't have access.", ephemeral: true });
    return;
  }

  const threadArg = interaction.options.getString("thread");
  const threadInfo = activeThreads.get(threadArg);

  if (!threadInfo) {
    await interaction.reply({ content: "Thread not found.", ephemeral: true });
    return;
  }

  await interaction.deferReply();

  try {
    await fetch(`${CLAUDE_HOST}/thread/${threadArg}/kill`, {
      method: "POST",
      signal: AbortSignal.timeout(10000),
    });

    if (threadInfo.pollingInterval) clearInterval(threadInfo.pollingInterval);
    activeThreads.delete(threadArg);

    const threadName = threadInfo.discordThread?.name || threadArg;
    try { await threadInfo.discordThread?.setArchived(true); } catch { /* may lack perms */ }

    await interaction.editReply({ content: `Killed thread: ${threadName}` });
    console.log(`[THREAD] Killed from main: ${threadArg}`);
  } catch (err) {
    console.error(`[THREAD_ERR] Kill failed: ${err.message}`);
    await interaction.editReply({ content: `Failed to kill thread: ${err.message}` });
  }
}

async function handleThreadMessage(message) {
  const threadId = message.channel.id;
  const threadInfo = activeThreads.get(threadId);
  if (!threadInfo) return;

  const authorId = message.author.id;
  if (allowlist.size > 0 && !allowlist.has(authorId)) return;

  try {
    const res = await fetch(`${CLAUDE_HOST}/thread/${threadId}/input`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message.content }),
      signal: AbortSignal.timeout(5000),
    });

    if (res.status === 410) {
      await message.reply("Process has exited. Use `/done` to close this thread.");
    }
  } catch (err) {
    console.error(`[THREAD_ERR] Input forward failed: ${err.message}`);
  }
}

function startOutputPolling(threadId) {
  const threadInfo = activeThreads.get(threadId);
  if (!threadInfo) return;

  const interval = setInterval(async () => {
    const info = activeThreads.get(threadId);
    if (!info) { clearInterval(interval); return; }

    try {
      const res = await fetch(
        `${CLAUDE_HOST}/thread/${threadId}/output?since=${info.lastOffset}`,
        { signal: AbortSignal.timeout(5000) },
      );
      if (!res.ok) { clearInterval(interval); return; }

      const { output, offset, processRunning, exitCode } = await res.json();
      info.lastOffset = offset;

      if (output) {
        const stripped = stripAnsi(output);
        // Truncate long lines
        const formatted = stripped.split("\n").map(line => line.slice(0, 100)).join("\n");

        // Edit-in-place or create new message
        if (info.currentMessageId && info.currentMessageLength + formatted.length < 1900) {
          try {
            const existing = await info.discordThread.messages.fetch(info.currentMessageId);
            // Extract inner content from code block, append, re-wrap
            const inner = existing.content.replace(/^```\n?/, "").replace(/\n?```$/, "");
            const newInner = inner + formatted;
            const newContent = formatAsCodeBlock(newInner);
            await existing.edit(newContent);
            info.currentMessageLength = newInner.length;
          } catch {
            // Edit failed — send new message
            const msg = await info.discordThread.send(formatAsCodeBlock(formatted));
            info.currentMessageId = msg.id;
            info.currentMessageLength = formatted.length;
          }
        } else {
          const msg = await info.discordThread.send(formatAsCodeBlock(formatted));
          info.currentMessageId = msg.id;
          info.currentMessageLength = formatted.length;
        }
      }

      // Process exited
      if (!processRunning) {
        await info.discordThread.send(
          `Process exited with code ${exitCode ?? "unknown"}. Thread remains open — use \`/done\` to close.`,
        );
        clearInterval(interval);
      }
    } catch (err) {
      console.error(`[THREAD_POLL_ERR] ${threadId}: ${err.message}`);
    }
  }, 1000);

  threadInfo.pollingInterval = interval;
}

async function recoverThreads() {
  try {
    const res = await fetch(`${CLAUDE_HOST}/threads`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return;
    const { threads } = await res.json();

    if (threads.length === 0) return;

    const mainChannel = client.channels.cache.get(DISCORD_CHANNEL_ID);
    if (!mainChannel) return;

    // Fetch both active and recently archived threads
    const activeDiscordThreads = await mainChannel.threads.fetchActive();
    const archivedThreads = await mainChannel.threads.fetchArchived({ fetchAll: true }).catch(() => ({ threads: new Map() }));

    for (const t of threads) {
      const discordThread =
        activeDiscordThreads.threads.get(t.threadId) ||
        archivedThreads.threads?.get(t.threadId);

      if (!discordThread) {
        // Discord thread gone — kill orphaned tmux session
        await fetch(`${CLAUDE_HOST}/thread/${t.threadId}/kill`, { method: "POST" }).catch(() => {});
        continue;
      }

      // Unarchive if needed
      if (discordThread.archived) {
        try { await discordThread.setArchived(false); } catch { /* may lack perms */ }
      }

      activeThreads.set(t.threadId, {
        type: t.type,
        dir: t.dir,
        command: t.command,
        discordThread,
        pollingInterval: null,
        lastOffset: 0,
        currentMessageId: null,
        currentMessageLength: 0,
      });

      startOutputPolling(t.threadId);
    }

    if (threads.length > 0) {
      console.log(`[DISCORD] Recovered ${threads.length} thread session(s)`);
    }
  } catch (err) {
    console.error(`[DISCORD_RECOVERY_ERR] ${err.message}`);
  }
}

function formatUptime(isoDate) {
  const ms = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

module.exports = {
  name: "discord",

  isConfigured,

  registerRoutes(app, onMessage) {
    client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, // Privileged — enable in Developer Portal
      ],
      makeCache: Options.cacheWithLimits({
        MessageManager: 0,
        GuildMemberManager: 0,
        PresenceManager: 0,
        ReactionManager: 0,
      }),
    });

    client.on("ready", async () => {
      targetChannel = client.channels.cache.get(DISCORD_CHANNEL_ID);
      if (!targetChannel) {
        console.error(`[DISCORD] Channel ${DISCORD_CHANNEL_ID} not found in cache. Bot may not have access.`);
        return;
      }

      guildId = targetChannel.guildId;
      rest = new REST({ version: "10" }).setToken(DISCORD_BOT_TOKEN);

      // Register core slash commands (reconcile: this PUT replaces all guild commands)
      const commands = buildAllCommands(registeredSkillNames.map(n => ({ name: n, description: n })));
      await registerGuildCommands(commands);

      client.user.setActivity("for commands", { type: ActivityType.Listening });
      console.log(`[DISCORD] Bot ready: ${client.user.tag}`);

      // Recover any active thread sessions from the VM
      await recoverThreads();
    });

    client.on("messageCreate", async (message) => {
      if (message.author.bot) return;

      // Route messages in managed threads to the thread handler
      if (message.channel.isThread() && activeThreads.has(message.channel.id)) {
        return handleThreadMessage(message);
      }

      if (message.channel.id !== DISCORD_CHANNEL_ID) return;

      const authorId = message.author.id;
      if (allowlist.size > 0 && !allowlist.has(authorId)) {
        console.log(`[DISCORD_BLOCKED] ${authorId}`);
        return; // Silent drop
      }

      const body = message.content.trim();
      if (!body) return; // Ignore empty / attachment-only messages

      // Clear any stale pending interaction for this user (they switched to text input)
      pendingInteractions.delete(`discord:${authorId}`);

      console.log(`[INBOUND] discord:${authorId}: ${body.substring(0, 80)}`);
      onMessage(`discord:${authorId}`, body);
    });

    client.on("interactionCreate", async (interaction) => {
      try {
        if (interaction.isAutocomplete()) {
          await handleAutocomplete(interaction);
          return;
        }

        if (interaction.isChatInputCommand()) {
          // Thread-specific commands — handle directly, don't route through relay-core
          const cmd = interaction.commandName;
          if (cmd === "terminal" || cmd === "agent") {
            await handleThreadCreation(interaction, cmd);
            return;
          }
          if (cmd === "done") {
            await handleDoneCommand(interaction);
            return;
          }
          if (cmd === "kill") {
            await handleKillCommand(interaction);
            return;
          }

          await handleSlashCommand(interaction, onMessage);
          return;
        }
      } catch (err) {
        console.error(`[DISCORD_INTERACTION_ERR] ${err.message}`);
        try {
          const reply = { content: "Something went wrong.", ephemeral: true };
          if (interaction.deferred || interaction.replied) {
            await interaction.editReply(reply);
          } else {
            await interaction.reply(reply);
          }
        } catch { /* best effort */ }
      }
    });

    client.on("error", (err) => {
      console.error(`[DISCORD_ERR] ${err.message}`);
    });

    // Login (non-blocking — don't await)
    client.login(DISCORD_BOT_TOKEN).catch((err) => {
      console.error(`[DISCORD] Failed to login: ${err.message}`);
    });
  },

  async updateSlashCommands(skills) {
    const newSkillNames = skills
      .map(s => s.name.toLowerCase().replace(/[^a-z0-9-_]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 32))
      .filter(n => n && !CORE_COMMAND_NAMES.has(n));

    // Skip if nothing changed
    if (
      newSkillNames.length === registeredSkillNames.length &&
      newSkillNames.every((n, i) => n === registeredSkillNames[i])
    ) {
      return;
    }

    registeredSkillNames = newSkillNames;

    // PUT replaces all guild commands — handles both add and remove in one call
    const commands = buildAllCommands(skills);
    await registerGuildCommands(commands);
  },

  async sendText(userId, text) {
    // Clear progress tracker — any non-progress message means the command is done or errored
    progressMessages.delete(userId);
    try {
      const chunks = chunkText(text, MAX_MSG);
      for (const chunk of chunks) {
        await sendViaInteractionOrChannel(userId, { content: chunk });
      }
      const authorId = userId.replace(/^discord:/, "");
      console.log(`[OUTBOUND] discord:${authorId}: ${text.substring(0, 80)}`);
    } catch (err) {
      console.error(`[DISCORD_SEND_ERR] ${err.message}`);
    }
  },

  async sendProgress(userId, text) {
    try {
      const truncated = text.length > MAX_MSG ? text.slice(0, MAX_MSG - 20) + "\n[truncated]" : text;

      // For slash commands: update the deferred reply with progress
      const pending = pendingInteractions.get(userId);
      if (pending) {
        try {
          await pending.interaction.editReply({ content: truncated });
          return;
        } catch (err) {
          console.error(`[DISCORD_INTERACTION_ERR] progress: ${err.message}`);
          pendingInteractions.delete(userId);
          // Fall through to channel-based progress
        }
      }

      if (!targetChannel) return;
      const existing = progressMessages.get(userId);
      if (existing) {
        await existing.edit(truncated);
      } else {
        const msg = await targetChannel.send(truncated);
        progressMessages.set(userId, msg);
      }
    } catch (err) {
      // Edit failed (deleted? rate limited?) — send new message
      if (!targetChannel) return;
      try {
        const msg = await targetChannel.send(text.slice(0, MAX_MSG));
        progressMessages.set(userId, msg);
      } catch (e) {
        console.error(`[DISCORD_PROGRESS_ERR] ${e.message}`);
      }
    }
  },

  async sendVMResponse(userId, data) {
    progressMessages.delete(userId);

    try {
      const files = await buildAttachments(data.images);

      // Format text + diffs
      let responseText = data.text || "";

      // Append web view link if present (Discord: markdown link)
      if (data.viewUrl) {
        const publicUrl = process.env.PUBLIC_URL || "";
        responseText += `\n\n[${viewLinkLabel(data.outputType)} ↗](${publicUrl}${data.viewUrl})`;
      }

      if (data.diffs && !data.viewUrl) {
        const diffBlock = formatDiscordDiff(data.diffs, data.diffSummary, MAX_MSG - responseText.length);
        if (diffBlock && responseText.length + diffBlock.length <= MAX_MSG) {
          responseText += diffBlock;
        } else {
          // Overflow: send text first, then diffs
          if (responseText) {
            await sendViaInteractionOrChannel(userId, { content: responseText.slice(0, MAX_MSG), files });
            files.length = 0; // Already sent
          }
          const overflowDiff = formatDiscordDiff(data.diffs, data.diffSummary, MAX_MSG);
          if (overflowDiff) {
            await sendViaInteractionOrChannel(userId, { content: overflowDiff.slice(0, MAX_MSG) });
          }
          return;
        }
      }

      if (responseText) {
        await sendViaInteractionOrChannel(userId, { content: responseText.slice(0, MAX_MSG), files });
      } else if (files.length > 0) {
        await sendViaInteractionOrChannel(userId, { content: "Here's a screenshot:", files });
      } else {
        await sendViaInteractionOrChannel(userId, { content: "Claude returned an empty response." });
      }
    } catch (err) {
      console.error(`[DISCORD_RESPONSE_ERR] ${err.message}`);
    }
  },

  async sendApprovalPrompt(userId, data) {
    progressMessages.delete(userId);

    try {
      const files = await buildAttachments(data.images);

      let msg = data.text || "Changes ready for review.";
      if (data.diffs) {
        const diffBlock = formatDiscordDiff(data.diffs, data.diffSummary, MAX_MSG - msg.length - 80);
        if (diffBlock) msg += diffBlock;
      }
      msg += "\n\nReply **approve** to create PR or **reject** to undo.";

      await sendViaInteractionOrChannel(userId, { content: msg.slice(0, MAX_MSG), files });
    } catch (err) {
      console.error(`[DISCORD_APPROVAL_ERR] ${err.message}`);
    }
  },

  logStartup() {
    console.log(`[STARTUP] Discord channel: ${DISCORD_CHANNEL_ID}`);
    console.log(`[STARTUP] Discord allowlist: ${[...allowlist].join(", ") || "(all users)"}`);
  },

  async shutdown() {
    if (client) client.destroy();
  },
};

// --- Helpers ---

async function buildAttachments(images) {
  const files = [];
  for (const img of (images || [])) {
    try {
      const buffer = await fetchImageBuffer(img.url);
      if (buffer) {
        files.push(new AttachmentBuilder(buffer, { name: img.filename || "screenshot.jpeg" }));
      }
    } catch (e) {
      console.error(`[DISCORD_IMG_ERR] ${e.message}`);
    }
  }
  return files;
}

function formatDiscordDiff(diffs, diffSummary, budget) {
  if (!diffs) return null;
  const SEPARATOR = "\n\n--- Changes ---\n";
  const CODE_OPEN = "```diff\n"; // Discord supports diff syntax highlighting
  const CODE_CLOSE = "\n```";
  const OVERHEAD = SEPARATOR.length + CODE_OPEN.length + CODE_CLOSE.length;
  const TRUNCATION_RESERVE = 60;
  const available = budget - OVERHEAD - TRUNCATION_RESERVE;
  if (available <= 0) return null;

  const truncated = diffs.length <= available
    ? diffs
    : truncateAtFileBoundary(diffs, available);
  const summaryText = diffs.length > available && diffSummary ? `\n${diffSummary}` : "";

  return SEPARATOR + CODE_OPEN + truncated + CODE_CLOSE + summaryText;
}
