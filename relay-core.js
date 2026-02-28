const express = require("express");

const { CLAUDE_HOST = "http://localhost:3001" } = process.env;

// --- Constants ---
const MAX_QUEUE_DEPTH = 5;
const RELAY_TIMEOUT_MS = 330_000; // VM's COMMAND_TIMEOUT_MS (300s) + 30s buffer
const APPROVAL_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const MAX_PROGRESS_LENGTH = 4096; // truncation limit for VM progress callbacks
const ACTION_TIMEOUT_MS = 120_000; // 2 minutes for clone/switch/repos/status

// --- Per-user state ---
// States: "idle" | "working" | "awaiting_approval"
const userState = new Map();

function getState(userId) {
  if (!userState.has(userId)) {
    userState.set(userId, { state: "idle", queue: [], approvalTimer: null, abortController: null });
  }
  return userState.get(userId);
}

// --- Command classifier ---
function classifyCommand(text) {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // Exact-match relay meta-commands
  if (lower === "help") return { type: "meta", command: "help" };
  if (lower === "skills") return { type: "meta", command: "skills" };
  if (lower === "skills --refresh") return { type: "meta", command: "skills-refresh" };

  // Exact-match VM action-commands
  if (lower === "repos") return { type: "action", command: "repos" };
  if (lower === "status") return { type: "action", command: "status" };

  // Pattern-match VM action-commands (require arguments)
  // Match against original text to preserve URL/name casing
  const cloneMatch = trimmed.match(/^clone\s+(https?:\/\/\S+)/i);
  if (cloneMatch) return { type: "action", command: "clone", args: { url: cloneMatch[1] } };

  const switchMatch = trimmed.match(/^switch\s+(\S+)/i);
  if (switchMatch) return { type: "action", command: "switch", args: { name: switchMatch[1] } };

  // Everything else → Claude Code
  return { type: "freeform" };
}

function createRelay(adapters) {
  const app = express();

  app.use(express.urlencoded({ extended: false }));
  app.use(express.json()); // for VM callbacks

  // --- Adapter registry ---
  const adapterMap = new Map();
  for (const adapter of adapters) {
    adapterMap.set(adapter.name, adapter);
  }

  // --- Skill cache (populated from clone/switch VM responses) ---
  let skillCache = [];

  function getAdapterForUser(userId) {
    const prefix = userId.split(":")[0];
    const adapter = adapterMap.get(prefix);
    if (!adapter) {
      console.warn(`[ROUTE_WARN] No adapter for prefix "${prefix}", falling back to ${adapters[0].name}`);
    }
    return adapter || adapters[0];
  }

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
      const truncated = message.length > MAX_PROGRESS_LENGTH
        ? message.slice(0, MAX_PROGRESS_LENGTH - 20) + "\n[truncated]"
        : message;
      getAdapterForUser(userId).sendProgress(userId, truncated);
    }

    res.sendStatus(200);
  });

  // --- Message handler (called by adapter) ---
  function onMessage(userId, text) {
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
        getAdapterForUser(userId).sendText(userId, "Reply approve to create PR or reject to undo changes.");
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
        getAdapterForUser(userId).sendText(userId, "Queue full, please wait for current tasks to finish.");
        return;
      }
      state.queue.push(text);
      console.log(`[QUEUED] ${userId} (depth: ${state.queue.length})`);
      getAdapterForUser(userId).sendText(userId, "Got it, I'll process this next.");
      return;
    }

    // --- State: idle — classify and route ---
    const classified = classifyCommand(text);

    if (classified.type === "meta") {
      handleMetaCommand(userId, classified);
      return;
    }

    state.state = "working";

    if (classified.type === "action") {
      handleActionCommand(userId, classified, state).catch((err) => {
        state.state = "idle";
        state.queue.length = 0;
        console.error(`[FATAL] ${userId}: unhandled error in handleActionCommand: ${err.message}`);
      });
      return;
    }

    // Freeform → Claude Code (existing path)
    processCommand(userId, text, state).catch((err) => {
      state.state = "idle";
      state.queue.length = 0;
      console.error(`[FATAL] ${userId}: unhandled error in processCommand: ${err.message}`);
    });
  }

  // --- Process a single command ---
  async function processCommand(userId, text, state) {
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
          getAdapterForUser(userId).sendText(userId, "Approval timed out (30 min). Changes preserved on disk.");
        }, APPROVAL_TIMEOUT_MS);

        await getAdapterForUser(userId).sendApprovalPrompt(userId, data);
        return; // Don't process queue — waiting for user response
      }

      // Normal completion — send response and process queue
      await getAdapterForUser(userId).sendVMResponse(userId, data);
    } catch (err) {
      console.error(`[ERROR] ${userId}: ${err.message}`);
      const message =
        err.status === 400
          ? "I couldn't process that message. Try rephrasing."
          : err.status === 408
            ? "That took too long. Try a simpler request."
            : "Something went wrong. Try again in a moment.";
      await getAdapterForUser(userId).sendText(userId, message);

      // Send diffs from error/timeout responses (Claude may have modified files before failing)
      if (err.data?.diffs) {
        await getAdapterForUser(userId).sendVMResponse(userId, { diffs: err.data.diffs, diffSummary: err.data.diffSummary });
      }
    }

    processQueue(userId, state);
  }

  // --- Process queued messages ---
  function processQueue(userId, state) {
    if (state.queue.length === 0) {
      state.state = "idle";
      return;
    }

    const next = state.queue.shift();
    console.log(`[DEQUEUED] ${userId} (remaining: ${state.queue.length})`);

    // Classify dequeued message through the same router as fresh messages
    const classified = classifyCommand(next);

    if (classified.type === "meta") {
      handleMetaCommand(userId, classified);
      // Meta-commands are synchronous — continue draining
      processQueue(userId, state);
      return;
    }

    if (classified.type === "action") {
      handleActionCommand(userId, classified, state).catch((err) => {
        state.state = "idle";
        state.queue.length = 0;
        console.error(`[FATAL] ${userId}: unhandled error in queued handleActionCommand: ${err.message}`);
      });
      return;
    }

    // Freeform → Claude Code
    processCommand(userId, next, state).catch((err) => {
      state.state = "idle";
      state.queue.length = 0;
      console.error(`[FATAL] ${userId}: unhandled error in queued processCommand: ${err.message}`);
    });
  }

  // --- Meta-command handlers (respond locally, no VM call) ---
  function handleMetaCommand(userId, classified) {
    const adapter = getAdapterForUser(userId);

    if (classified.command === "help") {
      let helpText = `Core Commands
  clone <url>  — Clone a repo to the VM
  switch <name> — Switch to a different repo
  repos        — List all cloned repos
  status       — Current repo, branch, changed files
  help         — Show this help
  cancel       — Cancel running command
  approve      — Approve pending changes
  reject       — Reject pending changes`;

      if (skillCache.length > 0) {
        const skillLines = skillCache.map((s) => `  ${s.name} — ${s.description}`).join("\n");
        helpText += `\n\nProject Skills (from current repo)\n${skillLines}`;
      }

      helpText += "\n\nEverything else is sent directly to Claude Code.";
      adapter.sendText(userId, helpText);
      return;
    }

    if (classified.command === "skills" || classified.command === "skills-refresh") {
      const refresh = classified.command === "skills-refresh";
      // Fetch from VM
      fetch(`${CLAUDE_HOST}/skills${refresh ? "?refresh=true" : ""}`, {
        signal: AbortSignal.timeout(10_000),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.skills) {
            skillCache = data.skills;
          }
          if (skillCache.length === 0) {
            adapter.sendText(userId, "No project skills found in current repo.");
          } else {
            const lines = skillCache.map((s) => `  ${s.name} — ${s.description}`).join("\n");
            adapter.sendText(userId, `Project Skills\n${lines}`);
          }
        })
        .catch((err) => {
          console.error(`[SKILLS_ERR] ${err.message}`);
          adapter.sendText(userId, "Failed to fetch skills from VM.");
        });
      return;
    }
  }

  // --- Action-command handlers (route to specific VM endpoints) ---
  async function handleActionCommand(userId, classified, state) {
    const adapter = getAdapterForUser(userId);
    const { command, args } = classified;

    try {
      let vmUrl;
      let method = "GET";
      let body;

      switch (command) {
        case "clone":
          vmUrl = `${CLAUDE_HOST}/clone`;
          method = "POST";
          body = JSON.stringify({ url: args.url });
          break;
        case "switch":
          vmUrl = `${CLAUDE_HOST}/switch`;
          method = "POST";
          body = JSON.stringify({ name: args.name });
          break;
        case "repos":
          vmUrl = `${CLAUDE_HOST}/repos`;
          break;
        case "status":
          vmUrl = `${CLAUDE_HOST}/status`;
          break;
        default:
          adapter.sendText(userId, `Unknown action command: ${command}`);
          state.state = "idle";
          return;
      }

      console.log(`[ACTION] ${userId}: ${command}${args ? " " + JSON.stringify(args) : ""}`);

      const fetchOpts = { method, signal: AbortSignal.timeout(ACTION_TIMEOUT_MS) };
      if (body) {
        fetchOpts.headers = { "Content-Type": "application/json" };
        fetchOpts.body = body;
      }

      const doActionFetch = async () => {
        const r = await fetch(vmUrl, fetchOpts);
        const d = await r.json();
        if (!r.ok) throw new Error(d.message || d.error || `VM returned ${r.status}`);
        return d;
      };

      let data;
      try {
        data = await doActionFetch();
      } catch (fetchErr) {
        // Cold-start retry — same pattern as forwardToVM
        if (fetchErr.cause?.code === "ECONNREFUSED" || fetchErr.message?.includes("ECONNREFUSED")) {
          console.log(`[COLD-START] VM not reachable for action: ${command}`);
          await adapter.sendText(userId, "\u23f3 Waking up your VM...");

          const MAX_WAIT = 30_000;
          const POLL_INTERVAL = 3_000;
          const start = Date.now();

          while (Date.now() - start < MAX_WAIT) {
            await new Promise((r) => setTimeout(r, POLL_INTERVAL));
            try {
              const healthRes = await fetch(`${CLAUDE_HOST}/health`, { signal: AbortSignal.timeout(2_000) });
              if (healthRes.ok) {
                console.log("[COLD-START] VM is up, retrying action");
                data = await doActionFetch();
                break;
              }
            } catch { /* still waking */ }
          }

          if (!data) {
            // Final attempt
            data = await doActionFetch();
          }
        } else {
          throw fetchErr;
        }
      }

      if (!data) {
        throw new Error("VM did not respond");
      }

      // Cache skills from clone/switch responses
      if (data.skills) {
        skillCache = data.skills;
      }

      console.log(`[ACTION_DONE] ${userId}: ${command}`);
      await adapter.sendText(userId, data.text || "Done.");
    } catch (err) {
      console.error(`[ACTION_ERR] ${userId}: ${command}: ${err.message}`);
      await adapter.sendText(userId, `Failed: ${err.message}`);
    }

    processQueue(userId, state);
  }

  // --- Approval handlers ---
  async function handleApprove(userId, state) {
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
        await getAdapterForUser(userId).sendText(userId, `PR created: ${data.prUrl}`);
      } else {
        await getAdapterForUser(userId).sendText(userId, data.text || "Approved.");
      }
    } catch (err) {
      console.error(`[APPROVE_ERR] ${userId}: ${err.message}`);
      await getAdapterForUser(userId).sendText(userId, `Failed to create PR: ${err.message}\nReply approve to retry.`);
      state.state = "awaiting_approval";
      state.approvalTimer = setTimeout(() => {
        state.state = "idle";
        state.approvalTimer = null;
        getAdapterForUser(userId).sendText(userId, "Approval timed out.");
      }, APPROVAL_TIMEOUT_MS);
      return;
    }

    // State stays "working" — processQueue sets "idle" if queue is empty
    processQueue(userId, state);
  }

  async function handleReject(userId, state) {
    clearTimeout(state.approvalTimer);
    state.state = "working";
    state.approvalTimer = null;

    try {
      await fetch(`${CLAUDE_HOST}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved: false }),
      });
      await getAdapterForUser(userId).sendText(userId, "Changes reverted. Ready for next command.");
    } catch (err) {
      console.error(`[REJECT_ERR] ${userId}: ${err.message}`);
      await getAdapterForUser(userId).sendText(userId, `Failed to revert: ${err.message}. Changes may still be on disk.`);
    }

    state.state = "idle";
    state.queue.length = 0;
  }

  async function handleCancel(userId, state) {
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
    await getAdapterForUser(userId).sendText(userId, "Cancelled. Changes reverted. Ready for next command.");
  }

  async function handleCancelWorking(userId, state) {
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
    await getAdapterForUser(userId).sendText(userId, "Cancelled. Ready for next command.");
  }

  // --- HTTP to VM with timeout + cold-start retry ---
  async function forwardToVM(text, userId, state) {
    const controller = new AbortController();
    if (state) state.abortController = controller;
    const timeout = setTimeout(() => controller.abort(), RELAY_TIMEOUT_MS);

    const doFetch = async () => {
      const res = await fetch(`${CLAUDE_HOST}/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, callbackUserId: userId }),
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
        await getAdapterForUser(userId).sendText(userId, "\u23f3 Waking up your VM...");

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

  // --- Register all adapter routes ---
  for (const adapter of adapters) {
    adapter.registerRoutes(app, onMessage);
  }

  // --- Shutdown support ---
  app.shutdownAdapters = async () => {
    for (const adapter of adapters) {
      if (adapter.shutdown) {
        try { await adapter.shutdown(); } catch (e) { console.error(`[SHUTDOWN] ${adapter.name}: ${e.message}`); }
      }
    }
  };

  // --- Startup logging ---
  console.log(`[STARTUP] VM target: ${CLAUDE_HOST}`);
  console.log(`[STARTUP] Adapters: ${adapters.map(a => a.name).join(", ")}`);
  for (const adapter of adapters) {
    if (adapter.logStartup) adapter.logStartup();
  }

  return app;
}

module.exports = { createRelay };
