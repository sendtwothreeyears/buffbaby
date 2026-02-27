const express = require("express");

const { CLAUDE_HOST = "http://localhost:3001" } = process.env;

// --- Constants ---
const MAX_QUEUE_DEPTH = 5;
const RELAY_TIMEOUT_MS = 330_000; // VM's COMMAND_TIMEOUT_MS (300s) + 30s buffer
const APPROVAL_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// --- Per-user state ---
// States: "idle" | "working" | "awaiting_approval"
const userState = new Map();

// userId → adapter mapping (set on first message from each user)
const userAdapters = new Map();

function getState(userId) {
  if (!userState.has(userId)) {
    userState.set(userId, { state: "idle", queue: [], approvalTimer: null, abortController: null });
  }
  return userState.get(userId);
}

function getAdapter(userId) {
  return userAdapters.get(userId);
}

function createRelay(adapter) {
  const app = express();

  app.use(express.urlencoded({ extended: false }));
  app.use(express.json()); // for VM callbacks

  // --- Health endpoint ---
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "textslash-relay" });
  });

  // --- Image proxy — external services fetch images from relay, relay proxies from VM ---
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
  app.post("/callback/:userId", (req, res) => {
    const userId = decodeURIComponent(req.params.userId);
    const { type, message } = req.body;

    if (type === "progress" && message) {
      const adp = getAdapter(userId);
      if (adp) {
        const truncated = message.length > 4096
          ? message.slice(0, 4096 - 20) + "\n[truncated]"
          : message;
        adp.sendText(userId, truncated);
      }
    }

    res.sendStatus(200);
  });

  // --- Message handler (called by adapter) ---
  function onMessage(userId, text) {
    // Register adapter for this user
    userAdapters.set(userId, adapter);

    const state = getState(userId);
    const normalized = text.trim().toLowerCase();

    // --- State: awaiting_approval — only accept keywords ---
    if (state.state === "awaiting_approval") {
      if (["approve", "a"].includes(normalized)) {
        handleApprove(userId, state);
      } else if (["reject", "r"].includes(normalized)) {
        handleReject(userId, state);
      } else if (["cancel", "c"].includes(normalized)) {
        handleCancel(userId, state);
      } else {
        adapter.sendText(userId, "Reply *approve* to create PR or *reject* to undo changes.");
      }
      return;
    }

    // --- State: working — accept cancel, queue everything else ---
    if (state.state === "working") {
      if (["cancel", "c"].includes(normalized)) {
        handleCancelWorking(userId, state);
        return;
      }
      if (state.queue.length >= MAX_QUEUE_DEPTH) {
        console.log(`[QUEUE_FULL] ${userId}`);
        adapter.sendText(userId, "Queue full, please wait for current tasks to finish.");
        return;
      }
      state.queue.push(text);
      console.log(`[QUEUED] ${userId} (depth: ${state.queue.length})`);
      adapter.sendText(userId, "Got it, I'll process this next.");
      return;
    }

    // --- State: idle — process the command ---
    state.state = "working";
    processCommand(userId, text, state).catch((err) => {
      // Safety net — ensure state is always reset
      state.state = "idle";
      state.queue.length = 0;
      console.error(`[FATAL] ${userId}: unhandled error in processCommand: ${err.message}`);
    });
  }

  // --- Process a single command ---
  async function processCommand(userId, text, state) {
    const adp = getAdapter(userId);
    try {
      console.log(`[FORWARD] ${userId}: ${text.substring(0, 80)}`);
      const data = await forwardToVM(text, userId, state);

      console.log(`[RESPONSE] ${userId} (${data.durationMs}ms, exit ${data.exitCode})`);

      // Approval flow — transition to awaiting_approval
      if (data.approvalRequired) {
        state.state = "awaiting_approval";
        state.approvalTimer = setTimeout(() => {
          state.state = "idle";
          state.approvalTimer = null;
          adp.sendText(userId, "Approval timed out (30 min). Changes preserved on disk.");
        }, APPROVAL_TIMEOUT_MS);

        await adp.sendApprovalPrompt(userId, data);
        return; // Don't process queue — waiting for user response
      }

      // Normal completion — send response and process queue
      await adp.sendVMResponse(userId, data);
    } catch (err) {
      console.error(`[ERROR] ${userId}: ${err.message}`);
      const message =
        err.status === 400
          ? "I couldn't process that message. Try rephrasing."
          : err.status === 408
            ? "That took too long. Try a simpler request."
            : "Something went wrong. Try again in a moment.";
      await adp.sendText(userId, message);

      // Send diffs from error/timeout responses (Claude may have modified files before failing)
      if (err.data?.diffs) {
        await adp.sendVMResponse(userId, { diffs: err.data.diffs, diffSummary: err.data.diffSummary });
      }
    }

    processQueue(userId, state);
  }

  // --- Process queued messages ---
  function processQueue(userId, state) {
    if (state.queue.length > 0) {
      const next = state.queue.shift();
      console.log(`[DEQUEUED] ${userId} (remaining: ${state.queue.length})`);
      processCommand(userId, next, state).catch((err) => {
        state.state = "idle";
        state.queue.length = 0;
        console.error(`[FATAL] ${userId}: unhandled error in queued processCommand: ${err.message}`);
      });
    } else {
      state.state = "idle";
    }
  }

  // --- Approval handlers ---
  async function handleApprove(userId, state) {
    const adp = getAdapter(userId);
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
        await adp.sendText(userId, `PR created: ${data.prUrl}`);
      } else {
        await adp.sendText(userId, data.text || "Approved.");
      }
    } catch (err) {
      console.error(`[APPROVE_ERR] ${userId}: ${err.message}`);
      await adp.sendText(userId, `Failed to create PR: ${err.message}\nReply *approve* to retry.`);
      state.state = "awaiting_approval";
      state.approvalTimer = setTimeout(() => {
        state.state = "idle";
        state.approvalTimer = null;
        adp.sendText(userId, "Approval timed out.");
      }, APPROVAL_TIMEOUT_MS);
      return;
    }

    // State stays "working" — processQueue sets "idle" if queue is empty
    processQueue(userId, state);
  }

  async function handleReject(userId, state) {
    const adp = getAdapter(userId);
    clearTimeout(state.approvalTimer);
    state.state = "working";
    state.approvalTimer = null;

    try {
      await fetch(`${CLAUDE_HOST}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved: false }),
      });
      await adp.sendText(userId, "Changes reverted. Ready for next command.");
    } catch (err) {
      console.error(`[REJECT_ERR] ${userId}: ${err.message}`);
      await adp.sendText(userId, `Failed to revert: ${err.message}. Changes may still be on disk.`);
    }

    state.state = "idle";
    state.queue.length = 0;
  }

  async function handleCancel(userId, state) {
    const adp = getAdapter(userId);
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
    await adp.sendText(userId, "Cancelled. Changes reverted. Ready for next command.");
  }

  async function handleCancelWorking(userId, state) {
    const adp = getAdapter(userId);
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
    await adp.sendText(userId, "Cancelled. Ready for next command.");
  }

  // --- HTTP to VM with timeout + cold-start retry ---
  async function forwardToVM(text, userId, state) {
    const controller = new AbortController();
    if (state) state.abortController = controller;
    const timeout = setTimeout(() => controller.abort(), RELAY_TIMEOUT_MS);

    const adp = getAdapter(userId);

    const doFetch = async () => {
      const res = await fetch(`${CLAUDE_HOST}/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, callbackPhone: userId }),
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
      // Cold-start retry: send "Waking up..." and poll /health until VM is ready
      if (err.cause?.code === "ECONNREFUSED" || err.message.includes("ECONNREFUSED")) {
        console.log("[COLD-START] VM not reachable, sending wake-up notice");
        await adp.sendText(userId, "\u23f3 Waking up your VM...");

        const MAX_WAIT = 30_000;
        const POLL_INTERVAL = 3_000;
        const start = Date.now();

        while (Date.now() - start < MAX_WAIT) {
          await new Promise((r) => setTimeout(r, POLL_INTERVAL));
          try {
            const healthRes = await fetch(`${CLAUDE_HOST}/health`, {
              signal: AbortSignal.timeout(2_000),
            });
            if (healthRes.ok) {
              console.log("[COLD-START] VM is up, sending command");
              return await doFetch();
            }
          } catch {
            // Still waking up, keep polling
          }
        }

        // Final attempt after max wait
        console.log("[COLD-START] Max wait reached, final attempt");
        return await doFetch();
      }
      throw err;
    } finally {
      clearTimeout(timeout);
      if (state) state.abortController = null;
    }
  }

  // --- Register adapter routes ---
  adapter.registerRoutes(app, onMessage);

  // --- Startup logging ---
  const PORT = process.env.PORT || "3000";
  console.log(`[STARTUP] VM target: ${CLAUDE_HOST}`);
  if (adapter.logStartup) adapter.logStartup();

  return app;
}

module.exports = { createRelay };
