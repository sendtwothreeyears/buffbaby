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
app.use(express.json()); // for VM callbacks

// --- Constants ---
const MAX_QUEUE_DEPTH = 5;
const RELAY_TIMEOUT_MS = 330_000; // VM's COMMAND_TIMEOUT_MS (300s) + 30s buffer
const APPROVAL_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// --- Per-user state ---
// States: "idle" | "working" | "awaiting_approval"
const userState = new Map();

function getState(phone) {
  if (!userState.has(phone)) {
    userState.set(phone, { state: "idle", queue: [], approvalTimer: null, abortController: null });
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

// --- VM progress callback endpoint ---
app.post("/callback/:phone", (req, res) => {
  const phone = decodeURIComponent(req.params.phone);
  const { type, message } = req.body;

  if (type === "progress" && message) {
    const truncated = message.length > MAX_MSG
      ? message.slice(0, MAX_MSG - 20) + "\n[truncated]"
      : message;
    sendMessage(phone, truncated);
  }

  res.sendStatus(200);
});

// --- Twilio webhook signature validation ---
const webhookValidator = twilio.webhook(TWILIO_AUTH_TOKEN, {
  url: PUBLIC_URL + "/webhook",
});

// --- Diff formatting for WhatsApp ---
const MAX_MSG = 4096;

function truncateAtFileBoundary(diff, maxChars) {
  const FILE_HEADER = "diff --git ";
  const files = diff.split(FILE_HEADER).filter(Boolean);

  let result = "";

  for (const file of files) {
    const entry = FILE_HEADER + file;
    if (result.length + entry.length > maxChars) break;
    result += entry;
  }

  return result || diff.substring(0, maxChars);
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

  const state = getState(from);
  const normalized = body.trim().toLowerCase();

  // --- State: awaiting_approval — only accept keywords ---
  if (state.state === "awaiting_approval") {
    if (["approve", "a"].includes(normalized)) {
      handleApprove(from, state);
    } else if (["reject", "r"].includes(normalized)) {
      handleReject(from, state);
    } else if (["cancel", "c"].includes(normalized)) {
      handleCancel(from, state);
    } else {
      sendMessage(from, "Reply *approve* to create PR or *reject* to undo changes.");
    }
    return;
  }

  // --- State: working — accept cancel, queue everything else ---
  if (state.state === "working") {
    if (["cancel", "c"].includes(normalized)) {
      handleCancelWorking(from, state);
      return;
    }
    if (state.queue.length >= MAX_QUEUE_DEPTH) {
      console.log(`[QUEUE_FULL] ${from}`);
      return sendMessage(from, "Queue full, please wait for current tasks to finish.");
    }
    state.queue.push(body);
    console.log(`[QUEUED] ${from} (depth: ${state.queue.length})`);
    return sendMessage(from, "Got it, I'll process this next.");
  }

  // --- State: idle — process the command ---
  state.state = "working";
  try {
    await processCommand(from, body, state);
  } catch (err) {
    // Safety net — ensure state is always reset
    state.state = "idle";
    state.queue.length = 0;
    console.error(`[FATAL] ${from}: unhandled error in processCommand: ${err.message}`);
  }
});

// --- Send VM response to WhatsApp (shared formatting logic) ---
async function sendVMResponse(from, data) {
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
        await sendMessage(from, truncatedResponse, mediaUrls);
        const overflowDiff = formatDiffMessage(diffs, diffSummary, MAX_MSG);
        if (overflowDiff) {
          await sendMessage(from, overflowDiff.substring(0, MAX_MSG));
        }
        return;
      }
    }

    if (responseText.length > MAX_MSG) {
      responseText = responseText.substring(0, MAX_MSG - 22) + "\n\n[Response truncated]";
      await sendMessage(from, responseText, mediaUrls);
      if (diffs) {
        const overflowDiff = formatDiffMessage(diffs, diffSummary, MAX_MSG);
        if (overflowDiff) {
          await sendMessage(from, overflowDiff.substring(0, MAX_MSG));
        }
      }
      return;
    }

    await sendMessage(from, responseText, mediaUrls);
  } else if (mediaUrls.length > 0) {
    await sendMessage(from, "Here's a screenshot:", mediaUrls);
  } else {
    await sendMessage(from, "Claude returned an empty response.");
  }
}

// --- Process a single command ---
async function processCommand(from, text, state) {
  try {
    console.log(`[FORWARD] ${from}: ${text.substring(0, 80)}`);
    const data = await forwardToVM(text, from, state);

    console.log(`[RESPONSE] ${from} (${data.durationMs}ms, exit ${data.exitCode})`);

    // Approval flow — transition to awaiting_approval
    if (data.approvalRequired) {
      state.state = "awaiting_approval";
      state.approvalTimer = setTimeout(() => {
        state.state = "idle";
        state.approvalTimer = null;
        sendMessage(from, "Approval timed out (30 min). Changes preserved on disk.");
      }, APPROVAL_TIMEOUT_MS);

      const mediaUrls = (data.images || []).map((img) => `${PUBLIC_URL}${img.url}`);
      await sendMessage(from, formatApprovalPrompt(data), mediaUrls);
      return; // Don't process queue — waiting for user response
    }

    // Normal completion — send response and process queue
    await sendVMResponse(from, data);
  } catch (err) {
    console.error(`[ERROR] ${from}: ${err.message}`);
    const message =
      err.status === 400
        ? "I couldn't process that message. Try rephrasing."
        : err.status === 408
          ? "That took too long. Try a simpler request."
          : "Something went wrong. Try again in a moment.";
    await sendMessage(from, message);

    // Send diffs from error/timeout responses (Claude may have modified files before failing)
    if (err.data?.diffs) {
      const errorDiff = formatDiffMessage(err.data.diffs, err.data.diffSummary, MAX_MSG);
      if (errorDiff) {
        await sendMessage(from, errorDiff.substring(0, MAX_MSG));
      }
    }
  }

  processQueue(from, state);
}

// --- Process queued messages ---
function processQueue(from, state) {
  if (state.queue.length > 0) {
    const next = state.queue.shift();
    console.log(`[DEQUEUED] ${from} (remaining: ${state.queue.length})`);
    processCommand(from, next, state).catch((err) => {
      state.state = "idle";
      state.queue.length = 0;
      console.error(`[FATAL] ${from}: unhandled error in queued processCommand: ${err.message}`);
    });
  } else {
    state.state = "idle";
  }
}

// --- Approval handlers ---
async function handleApprove(from, state) {
  clearTimeout(state.approvalTimer);
  state.state = "working";
  state.approvalTimer = null;

  try {
    const response = await fetch(`${CLAUDE_HOST}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved: true }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || `VM returned ${response.status}`);
    }

    if (data.prUrl) {
      await sendMessage(from, `PR created: ${data.prUrl}`);
    } else {
      await sendMessage(from, data.text || "Approved.");
    }
  } catch (err) {
    console.error(`[APPROVE_ERR] ${from}: ${err.message}`);
    await sendMessage(from, `Failed to create PR: ${err.message}\nReply *approve* to retry.`);
    state.state = "awaiting_approval";
    state.approvalTimer = setTimeout(() => {
      state.state = "idle";
      state.approvalTimer = null;
      sendMessage(from, "Approval timed out.");
    }, APPROVAL_TIMEOUT_MS);
    return;
  }

  // State stays "working" — processQueue sets "idle" if queue is empty
  processQueue(from, state);
}

async function handleReject(from, state) {
  clearTimeout(state.approvalTimer);
  state.state = "working";
  state.approvalTimer = null;

  try {
    await fetch(`${CLAUDE_HOST}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved: false }),
    });
    await sendMessage(from, "Changes reverted. Ready for next command.");
  } catch (err) {
    console.error(`[REJECT_ERR] ${from}: ${err.message}`);
    await sendMessage(from, `Failed to revert: ${err.message}. Changes may still be on disk.`);
  }

  state.state = "idle";
  state.queue.length = 0;
}

async function handleCancel(from, state) {
  clearTimeout(state.approvalTimer);
  state.approvalTimer = null;

  // In awaiting_approval, cancel acts like reject
  try {
    await fetch(`${CLAUDE_HOST}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved: false }),
    });
  } catch (_) { /* best effort */ }

  state.state = "idle";
  state.queue.length = 0;
  await sendMessage(from, "Cancelled. Changes reverted. Ready for next command.");
}

async function handleCancelWorking(from, state) {
  // Abort the in-flight fetch
  if (state.abortController) {
    state.abortController.abort();
  }

  // Tell VM to kill the process
  try {
    await fetch(`${CLAUDE_HOST}/cancel`, { method: "POST" });
  } catch (_) { /* VM may already be done */ }

  state.state = "idle";
  state.queue.length = 0;
  state.abortController = null;
  await sendMessage(from, "Cancelled. Ready for next command.");
}

// --- HTTP to VM with timeout + cold-start retry ---
async function forwardToVM(text, from, state) {
  const controller = new AbortController();
  if (state) state.abortController = controller;
  const timeout = setTimeout(() => controller.abort(), RELAY_TIMEOUT_MS);

  const doFetch = async () => {
    const res = await fetch(`${CLAUDE_HOST}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, callbackPhone: from }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw Object.assign(new Error(errBody.error || `VM returned ${res.status}`), {
        status: res.status,
        data: errBody,
      });
    }
    return await res.json();
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
  } finally {
    clearTimeout(timeout);
    if (state) state.abortController = null;
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
