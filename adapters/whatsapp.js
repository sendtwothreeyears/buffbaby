const twilio = require("twilio");
const { chunkText, truncateAtFileBoundary } = require("./utils");

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_WHATSAPP_NUMBER,
  PUBLIC_URL,
  ALLOWED_PHONE_NUMBERS,
} = process.env;

// --- Constants ---
const MAX_MSG = 4096;
const MAX_CHUNK = 1600; // Twilio WhatsApp sandbox limit

function isConfigured() {
  return !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN &&
            TWILIO_WHATSAPP_NUMBER && PUBLIC_URL &&
            ALLOWED_PHONE_NUMBERS);
}

function formatDiffMessage(diffs, diffSummary, budget) {
  if (!diffs) return null;

  const SEPARATOR = "\n\n--- Changes ---\n";
  const CODE_OPEN = "```\n";
  const CODE_CLOSE = "\n```";
  const OVERHEAD = SEPARATOR.length + CODE_OPEN.length + CODE_CLOSE.length;
  const TRUNCATION_RESERVE = 60;
  const availableBudget = budget - OVERHEAD - TRUNCATION_RESERVE;

  if (availableBudget <= 0) return null;

  if (diffs.length <= availableBudget) {
    return SEPARATOR + CODE_OPEN + diffs + CODE_CLOSE;
  }

  const truncatedDiff = truncateAtFileBoundary(diffs, availableBudget);
  const summaryText = diffSummary ? `\n${diffSummary}` : "";

  return SEPARATOR + CODE_OPEN + truncatedDiff + CODE_CLOSE + summaryText;
}

// --- Format approval prompt ---
function formatApprovalPrompt(data) {
  let msg = data.text || "Changes ready for review.";

  if (data.diffs) {
    const diffFormatted = formatDiffMessage(data.diffs, data.diffSummary, MAX_MSG - msg.length - 100);
    if (diffFormatted) {
      msg += diffFormatted;
    }
  }

  msg += "\n\nReply *approve* to create PR or *reject* to undo.";

  return msg.slice(0, MAX_MSG);
}

// --- Lazy-initialized Twilio client and webhook validator ---
let client, webhookValidator, allowlist;

// --- Outbound WhatsApp helper ---
async function sendWhatsAppMessage(to, body, mediaUrls = []) {
  const phone = to.replace(/^whatsapp:/, "");
  const whatsappTo = `whatsapp:${phone}`;
  try {
    // Split long messages into chunks
    const chunks = chunkText(body, MAX_CHUNK);

    // First chunk gets the first media attachment (if any)
    const firstParams = {
      to: whatsappTo,
      from: `whatsapp:${TWILIO_WHATSAPP_NUMBER}`,
      body: chunks[0],
    };
    if (mediaUrls.length > 0) {
      firstParams.mediaUrl = [mediaUrls[0]];
    }
    await client.messages.create(firstParams);

    // Remaining text chunks
    for (const chunk of chunks.slice(1)) {
      await client.messages.create({
        to: whatsappTo,
        from: `whatsapp:${TWILIO_WHATSAPP_NUMBER}`,
        body: chunk,
      });
    }

    // Remaining media (1 per message)
    for (const url of mediaUrls.slice(1)) {
      await client.messages.create({
        to: whatsappTo,
        from: `whatsapp:${TWILIO_WHATSAPP_NUMBER}`,
        mediaUrl: [url],
      });
    }

    if (mediaUrls.length > 0) {
      console.log(`[MEDIA] ${whatsappTo}: ${mediaUrls.length} image(s)`);
    }
    if (chunks.length > 1) {
      console.log(`[OUTBOUND] ${whatsappTo}: ${body.length} chars in ${chunks.length} chunks`);
    } else {
      console.log(`[OUTBOUND] ${whatsappTo}: ${body.substring(0, 80)}`);
    }
  } catch (err) {
    console.error(`[OUTBOUND_ERROR] ${whatsappTo}: ${err.message}`);
  }
}

module.exports = {
  name: "whatsapp",

  isConfigured,

  registerRoutes(app, onMessage) {
    // Initialize Twilio lazily — only when this adapter is actually used
    client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    webhookValidator = twilio.webhook(TWILIO_AUTH_TOKEN, {
      url: PUBLIC_URL + "/webhook",
    });
    allowlist = new Set(ALLOWED_PHONE_NUMBERS.split(",").map((n) => n.trim()));

    app.post("/webhook", webhookValidator, async (req, res) => {
      const from = req.body.From;
      const phone = from.replace(/^whatsapp:/, "");
      const body = (req.body.Body || "").trim();

      // Phone allowlist
      if (!allowlist.has(phone)) {
        console.log(`[BLOCKED] ${phone}`);
        return res.sendStatus(200);
      }

      // Immediate 200 OK — async pattern (Twilio 15s timeout)
      res.sendStatus(200);

      console.log(`[INBOUND] ${from}: ${body.substring(0, 80)}`);

      // Media check (text-only) — before empty-body check so
      // image-only messages get the right error ("text only" not "empty")
      if (parseInt(req.body.NumMedia || "0", 10) > 0) {
        return sendWhatsAppMessage(phone, "I can only process text messages for now.");
      }

      // Empty message check
      if (!body) {
        return sendWhatsAppMessage(phone, "I received an empty message.");
      }

      onMessage(`whatsapp:${phone}`, body);
    });
  },

  sendText(userId, text) {
    return sendWhatsAppMessage(userId, text);
  },

  sendProgress(userId, text) {
    return sendWhatsAppMessage(userId, text);
  },

  async sendVMResponse(userId, data) {
    const mediaUrls = (data.images || []).map((img) => `${PUBLIC_URL}${img.url}`);

    if (data.text || data.diffs) {
      let responseText = data.text || "";
      const diffs = data.diffs;
      const diffSummary = data.diffSummary;

      if (responseText.length <= MAX_MSG && diffs) {
        const diffBudget = MAX_MSG - responseText.length;
        const diffFormatted = formatDiffMessage(diffs, diffSummary, diffBudget);

        if (diffFormatted && responseText.length + diffFormatted.length <= MAX_MSG) {
          responseText += diffFormatted;
        } else if (diffFormatted) {
          const truncatedResponse = responseText.length > MAX_MSG
            ? responseText.substring(0, MAX_MSG - 22) + "\n\n[Response truncated]"
            : responseText;
          await sendWhatsAppMessage(userId, truncatedResponse, mediaUrls);
          const overflowDiff = formatDiffMessage(diffs, diffSummary, MAX_MSG);
          if (overflowDiff) {
            await sendWhatsAppMessage(userId, overflowDiff.substring(0, MAX_MSG));
          }
          return;
        }
      }

      if (responseText.length > MAX_MSG) {
        responseText = responseText.substring(0, MAX_MSG - 22) + "\n\n[Response truncated]";
        await sendWhatsAppMessage(userId, responseText, mediaUrls);
        if (diffs) {
          const overflowDiff = formatDiffMessage(diffs, diffSummary, MAX_MSG);
          if (overflowDiff) {
            await sendWhatsAppMessage(userId, overflowDiff.substring(0, MAX_MSG));
          }
        }
        return;
      }

      return sendWhatsAppMessage(userId, responseText, mediaUrls);
    } else if (mediaUrls.length > 0) {
      return sendWhatsAppMessage(userId, "Here's a screenshot:", mediaUrls);
    } else {
      return sendWhatsAppMessage(userId, "Claude returned an empty response.");
    }
  },

  sendApprovalPrompt(userId, data) {
    const mediaUrls = (data.images || []).map((img) => `${PUBLIC_URL}${img.url}`);
    return sendWhatsAppMessage(userId, formatApprovalPrompt(data), mediaUrls);
  },

  logStartup() {
    console.log(`[STARTUP] Webhook: ${PUBLIC_URL}/webhook`);
    console.log(`[STARTUP] Allowlist: ${[...allowlist].join(", ")}`);
    console.log(`[STARTUP] WhatsApp: ${TWILIO_WHATSAPP_NUMBER}`);
  },
};
