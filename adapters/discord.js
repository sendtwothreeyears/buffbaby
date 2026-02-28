const { Client, GatewayIntentBits, AttachmentBuilder, ActivityType, Options } = require("discord.js");
const { chunkText, truncateAtFileBoundary, fetchImageBuffer } = require("./utils");

const {
  DISCORD_BOT_TOKEN,
  DISCORD_CHANNEL_ID,
  DISCORD_ALLOWED_USER_IDS,
} = process.env;

const MAX_MSG = 2000; // Discord message limit

// Track progress messages per user for edit-in-place
const progressMessages = new Map(); // userId -> Discord Message object

let client;
let targetChannel;

function isConfigured() {
  return !!(DISCORD_BOT_TOKEN && DISCORD_CHANNEL_ID);
}

const allowlist = new Set((DISCORD_ALLOWED_USER_IDS || "").split(",").map(s => s.trim()).filter(Boolean));

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

    client.on("ready", () => {
      targetChannel = client.channels.cache.get(DISCORD_CHANNEL_ID);
      if (!targetChannel) {
        console.error(`[DISCORD] Channel ${DISCORD_CHANNEL_ID} not found in cache. Bot may not have access.`);
      }
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

      console.log(`[INBOUND] discord:${authorId}: ${body.substring(0, 80)}`);
      onMessage(`discord:${authorId}`, body);
    });

    client.on("error", (err) => {
      console.error(`[DISCORD_ERR] ${err.message}`);
    });

    // Login (non-blocking — don't await)
    client.login(DISCORD_BOT_TOKEN).catch((err) => {
      console.error(`[DISCORD] Failed to login: ${err.message}`);
    });
  },

  async sendText(userId, text) {
    if (!targetChannel) return;
    // Clear progress tracker — any non-progress message means the command is done or errored
    progressMessages.delete(userId);
    try {
      const chunks = chunkText(text, MAX_MSG);
      for (const chunk of chunks) {
        await targetChannel.send(chunk);
      }
      const authorId = userId.replace(/^discord:/, "");
      console.log(`[OUTBOUND] discord:${authorId}: ${text.substring(0, 80)}`);
    } catch (err) {
      console.error(`[DISCORD_SEND_ERR] ${err.message}`);
    }
  },

  async sendProgress(userId, text) {
    if (!targetChannel) return;
    try {
      const existing = progressMessages.get(userId);
      const truncated = text.length > MAX_MSG ? text.slice(0, MAX_MSG - 20) + "\n[truncated]" : text;
      if (existing) {
        await existing.edit(truncated);
      } else {
        const msg = await targetChannel.send(truncated);
        progressMessages.set(userId, msg);
      }
    } catch (err) {
      // Edit failed (deleted? rate limited?) — send new message
      try {
        const msg = await targetChannel.send(text.slice(0, MAX_MSG));
        progressMessages.set(userId, msg);
      } catch (e) {
        console.error(`[DISCORD_PROGRESS_ERR] ${e.message}`);
      }
    }
  },

  async sendVMResponse(userId, data) {
    if (!targetChannel) return;
    progressMessages.delete(userId);

    try {
      const files = await buildAttachments(data.images);

      // Format text + diffs
      let responseText = data.text || "";
      if (data.diffs) {
        const diffBlock = formatDiscordDiff(data.diffs, data.diffSummary, MAX_MSG - responseText.length);
        if (diffBlock && responseText.length + diffBlock.length <= MAX_MSG) {
          responseText += diffBlock;
        } else {
          // Overflow: send text first, then diffs
          if (responseText) {
            await targetChannel.send({ content: responseText.slice(0, MAX_MSG), files });
            files.length = 0; // Already sent
          }
          const overflowDiff = formatDiscordDiff(data.diffs, data.diffSummary, MAX_MSG);
          if (overflowDiff) {
            await targetChannel.send(overflowDiff.slice(0, MAX_MSG));
          }
          return;
        }
      }

      if (responseText) {
        await targetChannel.send({ content: responseText.slice(0, MAX_MSG), files });
      } else if (files.length > 0) {
        await targetChannel.send({ content: "Here's a screenshot:", files });
      } else {
        await targetChannel.send("Claude returned an empty response.");
      }
    } catch (err) {
      console.error(`[DISCORD_RESPONSE_ERR] ${err.message}`);
    }
  },

  async sendApprovalPrompt(userId, data) {
    if (!targetChannel) return;
    progressMessages.delete(userId);

    try {
      const files = await buildAttachments(data.images);

      let msg = data.text || "Changes ready for review.";
      if (data.diffs) {
        const diffBlock = formatDiscordDiff(data.diffs, data.diffSummary, MAX_MSG - msg.length - 80);
        if (diffBlock) msg += diffBlock;
      }
      msg += "\n\nReply **approve** to create PR or **reject** to undo.";

      await targetChannel.send({ content: msg.slice(0, MAX_MSG), files });
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
