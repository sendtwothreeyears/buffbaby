require("dotenv").config();
const express = require("express");
const twilio = require("twilio");

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER,
  PUBLIC_URL,
  ALLOWED_PHONE_NUMBERS,
  CLAUDE_HOST = "http://localhost:3001",
  PORT = "3000",
} = process.env;

// Validate required env vars
const required = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_PHONE_NUMBER",
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

// --- Twilio webhook signature validation ---
const webhookValidator = twilio.webhook(TWILIO_AUTH_TOKEN, {
  url: PUBLIC_URL + "/sms",
});

// --- Core SMS handler ---
app.post("/sms", webhookValidator, async (req, res) => {
  const from = req.body.From;
  const body = (req.body.Body || "").trim();

  // Phone allowlist
  if (!allowlist.has(from)) {
    console.log(`[BLOCKED] ${from}`);
    return res.sendStatus(200);
  }

  // Immediate 200 OK — async pattern (Twilio 15s timeout)
  res.sendStatus(200);

  console.log(`[INBOUND] ${from}: ${body.substring(0, 80)}`);

  // MMS check (text-only for Phase 3) — before empty-body check so
  // image-only messages get the right error ("text only" not "empty")
  if (parseInt(req.body.NumMedia || "0", 10) > 0) {
    return sendSMS(from, "I can only process text messages for now.");
  }

  // Empty message check
  if (!body) {
    return sendSMS(from, "I received an empty message.");
  }

  // Queue or forward
  const state = getState(from);
  if (state.busy) {
    if (state.queue.length >= 5) {
      console.log(`[QUEUE_FULL] ${from}`);
      return sendSMS(from, "Queue full, please wait for current tasks to finish.");
    }
    state.queue.push(body);
    console.log(`[QUEUED] ${from} (depth: ${state.queue.length})`);
    return sendSMS(from, "Got it, I'll process this next.");
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
  try {
    console.log(`[FORWARD] ${from}: ${text.substring(0, 80)}`);
    const data = await forwardToVM(text);

    if (data.text) {
      const response =
        data.text.length > 1500
          ? data.text.substring(0, 1500) + "\n\n[Response truncated]"
          : data.text;
      console.log(`[RESPONSE] ${from} (${data.durationMs}ms, exit ${data.exitCode})`);
      await sendSMS(from, response);
    } else {
      await sendSMS(from, "Claude returned an empty response.");
    }
  } catch (err) {
    console.error(`[ERROR] ${from}: ${err.message}`);
    const message =
      err.status === 400
        ? "I couldn't process that message. Try rephrasing."
        : err.status === 408
          ? "That took too long. Try a simpler request."
          : "Something went wrong. Try again in a moment.";
    await sendSMS(from, message);
  }

  // Process next queued message
  if (state.queue.length > 0) {
    const next = state.queue.shift();
    console.log(`[DEQUEUED] ${from} (remaining: ${state.queue.length})`);
    await processCommand(from, next, state);
  } else {
    state.busy = false;
  }
}

// --- HTTP to VM with timeout + cold-start retry ---
async function forwardToVM(text) {
  const RELAY_TIMEOUT_MS = 330_000; // VM's COMMAND_TIMEOUT_MS (300s) + 30s buffer

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

// --- Outbound SMS helper ---
async function sendSMS(to, body) {
  try {
    await client.messages.create({
      to,
      from: TWILIO_PHONE_NUMBER,
      body,
    });
    console.log(`[OUTBOUND] ${to}: ${body.substring(0, 80)}`);
  } catch (err) {
    console.error(`[OUTBOUND_ERROR] ${to}: ${err.message}`);
  }
}

// --- Start server ---
app.listen(PORT, () => {
  console.log(`[STARTUP] Relay listening on port ${PORT}`);
  console.log(`[STARTUP] VM target: ${CLAUDE_HOST}`);
  console.log(`[STARTUP] Webhook: ${PUBLIC_URL}/sms`);
  console.log(`[STARTUP] Allowlist: ${[...allowlist].join(", ")}`);
});
