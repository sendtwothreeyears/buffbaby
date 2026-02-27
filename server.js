require("dotenv").config();
const express = require("express");
const twilio = require("twilio");

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_WHATSAPP_NUMBER,
  PUBLIC_URL,
  ALLOWED_PHONE_NUMBERS,
  CLAUDE_HOST = "http://localhost:3001",
  PORT = "3000",
} = process.env;

// Validate required env vars
const required = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_WHATSAPP_NUMBER",
  "PUBLIC_URL",
  "ALLOWED_PHONE_NUMBERS",
];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}

const allowlist = new Set(ALLOWED_PHONE_NUMBERS.split(",").map((n) => n.trim()));
const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
const app = express();

app.use(express.urlencoded({ extended: false }));

// --- Constants ---
const MAX_QUEUE_DEPTH = 5;
const RELAY_TIMEOUT_MS = 330_000; // VM's COMMAND_TIMEOUT_MS (300s) + 30s buffer

// --- Per-user state ---
const userState = new Map(); // Map<phone, { busy: boolean, queue: string[] }>

function getState(phone) {
  if (!userState.has(phone)) {
    userState.set(phone, { busy: false, queue: [] });
  }
  return userState.get(phone);
}

// --- Health endpoint ---
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "textslash-relay" });
});

// --- Image proxy — Twilio fetches images from relay, relay proxies from VM ---
app.get("/images/:filename", async (req, res) => {
  const { filename } = req.params;

  // Validate filename: UUID.jpeg only — prevents path traversal
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpeg$/.test(filename)) {
    return res.sendStatus(400);
  }

  try {
    const vmUrl = `${CLAUDE_HOST}/images/${encodeURIComponent(filename)}`;
    const response = await fetch(vmUrl);

    if (!response.ok) {
      return res.sendStatus(response.status);
    }

    res.set("Content-Type", "image/jpeg");
    res.set("Cache-Control", "public, max-age=300");
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error(`[IMAGE_PROXY_ERR] ${filename}: ${err.message}`);
    res.sendStatus(502);
  }
});

// --- Twilio webhook signature validation ---
const webhookValidator = twilio.webhook(TWILIO_AUTH_TOKEN, {
  url: PUBLIC_URL + "/webhook",
});

// --- Core WhatsApp handler ---
app.post("/webhook", webhookValidator, async (req, res) => {
  const from = req.body.From;
  const phone = from.replace(/^whatsapp:/, "");
  const body = (req.body.Body || "").trim();

  // Phone allowlist (strip whatsapp: prefix for check)
  if (!allowlist.has(phone)) {
    console.log(`[BLOCKED] ${phone}`);
    return res.sendStatus(200);
  }

  // Immediate 200 OK — async pattern (Twilio 15s timeout)
  res.sendStatus(200);

  console.log(`[INBOUND] ${from}: ${body.substring(0, 80)}`);

  // Media check (text-only for Phase 3) — before empty-body check so
  // image-only messages get the right error ("text only" not "empty")
  if (parseInt(req.body.NumMedia || "0", 10) > 0) {
    return sendMessage(from, "I can only process text messages for now.");
  }

  // Empty message check
  if (!body) {
    return sendMessage(from, "I received an empty message.");
  }

  // Queue or forward
  const state = getState(from);
  if (state.busy) {
    if (state.queue.length >= MAX_QUEUE_DEPTH) {
      console.log(`[QUEUE_FULL] ${from}`);
      return sendMessage(from, "Queue full, please wait for current tasks to finish.");
    }
    state.queue.push(body);
    console.log(`[QUEUED] ${from} (depth: ${state.queue.length})`);
    return sendMessage(from, "Got it, I'll process this next.");
  }

  state.busy = true; // Synchronous — before any await
  try {
    await processCommand(from, body, state);
  } catch (err) {
    // Safety net — ensure busy flag is always cleared
    state.busy = false;
    state.queue.length = 0;
    console.error(`[FATAL] ${from}: unhandled error in processCommand: ${err.message}`);
  }
});

// --- Forward to VM and process queue ---
async function processCommand(from, text, state) {
  let current = text;
  while (current) {
    try {
      console.log(`[FORWARD] ${from}: ${current.substring(0, 80)}`);
      const data = await forwardToVM(current);

      // Construct public media URLs from images array
      const mediaUrls = (data.images || []).map((img) => `${PUBLIC_URL}${img.url}`);

      if (data.text) {
        const response =
          data.text.length > 4096
            ? data.text.substring(0, 4096) + "\n\n[Response truncated]"
            : data.text;
        console.log(`[RESPONSE] ${from} (${data.durationMs}ms, exit ${data.exitCode}, ${mediaUrls.length} image(s))`);
        await sendMessage(from, response, mediaUrls);
      } else if (mediaUrls.length > 0) {
        await sendMessage(from, "Here's a screenshot:", mediaUrls);
      } else {
        await sendMessage(from, "Claude returned an empty response.");
      }
    } catch (err) {
      console.error(`[ERROR] ${from}: ${err.message}`);
      const message =
        err.status === 400
          ? "I couldn't process that message. Try rephrasing."
          : err.status === 408
            ? "That took too long. Try a simpler request."
            : "Something went wrong. Try again in a moment.";
      await sendMessage(from, message);
    }

    // Dequeue next message or mark idle
    if (state.queue.length > 0) {
      current = state.queue.shift();
      console.log(`[DEQUEUED] ${from} (remaining: ${state.queue.length})`);
    } else {
      current = null;
    }
  }
  state.busy = false;
}

// --- HTTP to VM with timeout + cold-start retry ---
async function forwardToVM(text) {
  const doFetch = async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RELAY_TIMEOUT_MS);
    try {
      const res = await fetch(`${CLAUDE_HOST}/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw Object.assign(new Error(errBody.error || `VM returned ${res.status}`), {
          status: res.status,
        });
      }
      return await res.json();
    } finally {
      clearTimeout(timeout);
    }
  };

  try {
    return await doFetch();
  } catch (err) {
    // Cold-start retry on connection error
    if (err.cause?.code === "ECONNREFUSED" || err.message.includes("ECONNREFUSED")) {
      console.log("[RETRY] VM connection refused, retrying in 4s (cold start?)");
      await new Promise((r) => setTimeout(r, 4000));
      return await doFetch();
    }
    throw err;
  }
}

// --- Outbound WhatsApp helper ---
async function sendMessage(to, body, mediaUrls = []) {
  try {
    const params = {
      to,
      from: `whatsapp:${TWILIO_WHATSAPP_NUMBER}`,
      body,
    };
    if (mediaUrls.length > 0) {
      // WhatsApp: 1 media per message — send first image with text, rest as separate messages
      params.mediaUrl = [mediaUrls[0]];
      await client.messages.create(params);
      for (const url of mediaUrls.slice(1)) {
        await client.messages.create({
          to,
          from: `whatsapp:${TWILIO_WHATSAPP_NUMBER}`,
          mediaUrl: [url],
        });
      }
    } else {
      await client.messages.create(params);
    }
    if (mediaUrls.length > 0) {
      console.log(`[MEDIA] ${to}: ${mediaUrls.length} image(s)`);
    }
    console.log(`[OUTBOUND] ${to}: ${body.substring(0, 80)}`);
  } catch (err) {
    console.error(`[OUTBOUND_ERROR] ${to}: ${err.message}`);
  }
}

// --- Start server ---
app.listen(PORT, () => {
  console.log(`[STARTUP] Relay listening on port ${PORT}`);
  console.log(`[STARTUP] VM target: ${CLAUDE_HOST}`);
  console.log(`[STARTUP] Webhook: ${PUBLIC_URL}/webhook`);
  console.log(`[STARTUP] Allowlist: ${[...allowlist].join(", ")}`);
  console.log(`[STARTUP] WhatsApp: ${TWILIO_WHATSAPP_NUMBER}`);
});
