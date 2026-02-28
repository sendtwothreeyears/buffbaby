const { Bot, InputFile } = require("grammy");
const { chunkText, truncateAtFileBoundary, fetchImageBuffer, viewLinkLabel } = require("./utils");

const {
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_ALLOWED_CHAT_IDS,
} = process.env;

const MAX_MSG = 4096;

const allowlist = new Set(
  (TELEGRAM_ALLOWED_CHAT_IDS || "").split(",").map(s => s.trim()).filter(Boolean)
);

// Track progress messages per user for edit-in-place
const progressMessages = new Map(); // userId -> { chatId, messageId, lastText }

let bot;

module.exports = {
  name: "telegram",

  isConfigured() {
    return !!TELEGRAM_BOT_TOKEN;
  },

  registerRoutes(app, onMessage) {
    bot = new Bot(TELEGRAM_BOT_TOKEN);

    bot.catch((err) => {
      const desc = err.error?.description || err.error?.message || err.message;
      console.error(`[TELEGRAM_ERR] ${desc}`);
    });

    // /start — welcome message, don't forward to VM
    bot.command("start", (ctx) => {
      if (ctx.chat.type !== "private") return;
      ctx.reply("Welcome to TextSlash! Send any message to run it as a Claude Code command on your VM.");
    });

    bot.on("message:text", (ctx) => {
      // DMs only
      if (ctx.chat.type !== "private") return;

      const chatId = String(ctx.chat.id);

      if (allowlist.size > 0 && !allowlist.has(chatId)) {
        console.log(`[TELEGRAM_BLOCKED] ${chatId}`);
        return;
      }

      let body = ctx.message.text.trim();
      if (!body) return;

      // Strip leading / from bot commands so /cancel matches relay-core's "cancel"
      if (body.startsWith("/")) {
        body = body.slice(1);
        if (!body) return;
      }

      console.log(`[INBOUND] telegram:${chatId}: ${body.substring(0, 80)}`);
      onMessage(`telegram:${chatId}`, body);
    });

    // Non-text messages — photos, stickers, voice, etc.
    bot.on("message", (ctx) => {
      if (ctx.chat.type !== "private") return;
      if (ctx.message.text) return; // Already handled by message:text
      const chatId = String(ctx.chat.id);
      if (allowlist.size > 0 && !allowlist.has(chatId)) return;
      bot.api.sendMessage(chatId, "I can only process text messages.").catch(() => {});
    });

    // Start long polling (non-blocking — do NOT await)
    bot.start({
      drop_pending_updates: true,
      allowed_updates: ["message"],
      onStart: (botInfo) => {
        console.log(`[TELEGRAM] Bot ready: @${botInfo.username}`);
      },
    }).catch((err) => {
      console.error(`[TELEGRAM] Failed to start polling: ${err.message}`);
    });
  },

  async sendText(userId, text) {
    const chatId = userId.replace(/^telegram:/, "");
    progressMessages.delete(userId);
    try {
      const chunks = chunkText(text, MAX_MSG);
      for (const chunk of chunks) {
        await bot.api.sendMessage(chatId, chunk);
      }
      console.log(`[OUTBOUND] telegram:${chatId}: ${text.substring(0, 80)}`);
    } catch (err) {
      console.error(`[TELEGRAM_SEND_ERR] ${err.description || err.message}`);
    }
  },

  async sendProgress(userId, text) {
    const chatId = userId.replace(/^telegram:/, "");
    try {
      const truncated = text.length > MAX_MSG ? text.slice(0, MAX_MSG - 20) + "\n[truncated]" : text;
      const existing = progressMessages.get(userId);

      // Skip no-op edits — Telegram returns 400 for identical content
      if (existing && existing.lastText === truncated) return;

      if (existing) {
        await bot.api.editMessageText(chatId, existing.messageId, truncated);
        existing.lastText = truncated;
      } else {
        const sent = await bot.api.sendMessage(chatId, truncated);
        progressMessages.set(userId, { chatId, messageId: sent.message_id, lastText: truncated });
      }
    } catch (err) {
      // Edit failed (deleted? rate limited?) — send new message
      try {
        const sent = await bot.api.sendMessage(chatId, text.slice(0, MAX_MSG));
        progressMessages.set(userId, { chatId, messageId: sent.message_id, lastText: text.slice(0, MAX_MSG) });
      } catch (e) {
        console.error(`[TELEGRAM_PROGRESS_ERR] ${e.description || e.message}`);
      }
    }
  },

  async sendVMResponse(userId, data) {
    const chatId = userId.replace(/^telegram:/, "");
    progressMessages.delete(userId);

    try {
      const imageBuffers = await fetchImages(data.images);

      // Format text + diffs
      let responseText = data.text || "";
      let useHtml = false;

      // Append web view link if present (Telegram: HTML <a> tag)
      if (data.viewUrl) {
        const publicUrl = process.env.PUBLIC_URL || "";
        // Must escape the text portion since the whole message will use parse_mode: HTML
        responseText = escapeHtml(responseText);
        responseText += `\n\n<a href="${escapeHtml(publicUrl + data.viewUrl)}">${viewLinkLabel(data.outputType)} ↗</a>`;
        useHtml = true;
      }

      if (data.diffs && !data.viewUrl) {
        const diffBlock = formatTelegramDiff(data.diffs, data.diffSummary, MAX_MSG - responseText.length);
        if (diffBlock && responseText.length + diffBlock.length <= MAX_MSG) {
          responseText += diffBlock;
          useHtml = true;
        } else {
          // Overflow: send text first, then diffs separately
          if (responseText) {
            const opts = useHtml ? { parse_mode: "HTML" } : {};
            await bot.api.sendMessage(chatId, responseText.slice(0, MAX_MSG), opts);
          }
          const overflowDiff = formatTelegramDiff(data.diffs, data.diffSummary, MAX_MSG);
          if (overflowDiff) {
            await bot.api.sendMessage(chatId, overflowDiff.slice(0, MAX_MSG), { parse_mode: "HTML" });
          }
          await sendImages(chatId, imageBuffers);
          return;
        }
      }

      if (responseText) {
        const opts = useHtml ? { parse_mode: "HTML" } : {};
        await bot.api.sendMessage(chatId, responseText.slice(0, MAX_MSG), opts);
        await sendImages(chatId, imageBuffers);
      } else if (imageBuffers.length > 0) {
        await sendImages(chatId, imageBuffers, "Here's a screenshot:");
      } else {
        await bot.api.sendMessage(chatId, "Claude returned an empty response.");
      }
    } catch (err) {
      console.error(`[TELEGRAM_RESPONSE_ERR] ${err.description || err.message}`);
    }
  },

  async sendApprovalPrompt(userId, data) {
    const chatId = userId.replace(/^telegram:/, "");
    progressMessages.delete(userId);

    try {
      let msg = data.text || "Changes ready for review.";
      if (data.diffs) {
        const diffBlock = formatTelegramDiff(data.diffs, data.diffSummary, MAX_MSG - msg.length - 80);
        if (diffBlock) msg += diffBlock;
      }
      msg += "\n\nReply approve to create PR or reject to undo.";

      const opts = data.diffs ? { parse_mode: "HTML" } : {};
      await bot.api.sendMessage(chatId, msg.slice(0, MAX_MSG), opts);

      const imageBuffers = await fetchImages(data.images);
      await sendImages(chatId, imageBuffers);
    } catch (err) {
      console.error(`[TELEGRAM_APPROVAL_ERR] ${err.description || err.message}`);
    }
  },

  logStartup() {
    console.log(`[STARTUP] Telegram allowlist: ${[...allowlist].join(", ") || "(all users)"}`);
  },

  async shutdown() {
    if (bot) {
      try { await bot.stop(); } catch (e) { console.error(`[TELEGRAM_SHUTDOWN] ${e.message}`); }
    }
  },
};

// --- Helpers ---

async function fetchImages(images) {
  const buffers = [];
  for (const img of (images || [])) {
    const buffer = await fetchImageBuffer(img.url);
    if (buffer) buffers.push(buffer);
  }
  return buffers;
}

async function sendImages(chatId, buffers, caption) {
  if (buffers.length === 0) return;
  if (buffers.length === 1) {
    await bot.api.sendPhoto(chatId, new InputFile(buffers[0], "screenshot.jpeg"), {
      caption: caption || undefined,
    });
  } else {
    // Media group (album) — 2-10 items
    const group = buffers.slice(0, 10).map((buf, i) => ({
      type: "photo",
      media: new InputFile(buf, `screenshot-${i}.jpeg`),
      caption: i === 0 ? (caption || undefined) : undefined,
    }));
    await bot.api.sendMediaGroup(chatId, group);
  }
}

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatTelegramDiff(diffs, diffSummary, budget) {
  if (!diffs) return null;
  const SEPARATOR = "\n\n--- Changes ---\n";
  const CODE_OPEN = "<pre>";
  const CODE_CLOSE = "</pre>";
  const OVERHEAD = SEPARATOR.length + CODE_OPEN.length + CODE_CLOSE.length;
  const TRUNCATION_RESERVE = 60;
  const available = budget - OVERHEAD - TRUNCATION_RESERVE;
  if (available <= 0) return null;

  const raw = diffs.length <= available
    ? diffs
    : truncateAtFileBoundary(diffs, available);
  const escaped = escapeHtml(raw);
  const summaryText = diffs.length > available && diffSummary ? `\n${escapeHtml(diffSummary)}` : "";

  return SEPARATOR + CODE_OPEN + escaped + CODE_CLOSE + summaryText;
}
