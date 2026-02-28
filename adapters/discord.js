const { Client, GatewayIntentBits, AttachmentBuilder, ActivityType, Options, REST, Routes, SlashCommandBuilder } = require("discord.js");
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
  if (interaction.commandName !== "switch") return;

  const focused = interaction.options.getFocused();
  try {
    const res = await fetch(`${CLAUDE_HOST}/repos`, { signal: AbortSignal.timeout(5000) });
    const data = await res.json();

    const choices = (data.repos || [])
      .filter(r => r.name.toLowerCase().includes(focused.toLowerCase()))
      .slice(0, 25) // Discord max 25 autocomplete choices
      .map(r => ({ name: r.name, value: r.name }));

    await interaction.respond(choices);
  } catch {
    await interaction.respond([]);
  }
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
    });

    client.on("messageCreate", (message) => {
      if (message.author.bot) return;
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
