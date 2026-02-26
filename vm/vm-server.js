const express = require("express");
const { spawn } = require("child_process");
const path = require("path");

const { ANTHROPIC_API_KEY, PORT = "3001", COMMAND_TIMEOUT_MS = "300000" } = process.env;

// Fail-fast env var validation
if (!ANTHROPIC_API_KEY) {
  console.error("Missing required env var: ANTHROPIC_API_KEY");
  process.exit(1);
}

const TIMEOUT = Number(COMMAND_TIMEOUT_MS);
if (!Number.isFinite(TIMEOUT) || TIMEOUT <= 0) {
  console.error(`Invalid COMMAND_TIMEOUT_MS: "${COMMAND_TIMEOUT_MS}" (must be a positive number)`);
  process.exit(1);
}

const MAX_OUTPUT_BYTES = 10 * 1024 * 1024; // 10MB cap on stdout/stderr
const IMAGES_DIR = "/tmp/images";
const app = express();
let busy = false;
let activeChild = null;

app.use(express.json());

// POST /command — run a prompt through Claude Code
app.post("/command", (req, res) => {
  const { text } = req.body || {};
  if (!text || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({
      error: "bad_request",
      message: "Request body must include a non-empty 'text' field",
    });
  }
  if (busy) {
    return res.status(409).json({
      error: "busy",
      message: "A command is already in progress",
    });
  }

  busy = true;
  const start = Date.now();
  const stdoutChunks = [];
  const stderrChunks = [];

  const child = spawn("claude", ["-p", "--dangerously-skip-permissions", "-"], {
    detached: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  activeChild = child;
  let timedOut = false;
  let stdoutBytes = 0;
  let stderrBytes = 0;

  console.log(`[COMMAND] Received prompt (${text.length} chars)`);
  console.log(`[SPAWN]   Claude Code PID ${child.pid}`);

  const killChild = () => {
    try { process.kill(-child.pid, "SIGTERM"); } catch (_) { /* already dead */ }
  };

  const timer = setTimeout(() => {
    timedOut = true;
    killChild();
  }, TIMEOUT);

  child.stdin.on("error", () => {}); // swallow broken-pipe if child dies early
  child.stdin.write(text);
  child.stdin.end();

  child.stdout.on("data", (chunk) => {
    stdoutBytes += chunk.length;
    if (stdoutBytes <= MAX_OUTPUT_BYTES) stdoutChunks.push(chunk);
  });
  child.stderr.on("data", (chunk) => {
    stderrBytes += chunk.length;
    if (stderrBytes <= MAX_OUTPUT_BYTES) stderrChunks.push(chunk);
  });

  child.on("error", (err) => {
    clearTimeout(timer);
    busy = false;
    activeChild = null;
    const durationMs = Date.now() - start;
    console.error(`[ERROR]   Spawn failed: ${err.message}`);
    res.status(500).json({
      error: "execution_error",
      message: err.message,
      exitCode: null,
      durationMs,
    });
  });

  child.on("close", (code) => {
    clearTimeout(timer);
    busy = false;
    activeChild = null;
    const durationMs = Date.now() - start;
    const textOut = Buffer.concat(stdoutChunks).toString();
    const stderrOut = Buffer.concat(stderrChunks).toString();

    if (timedOut) {
      console.log(`[TIMEOUT] Killed PID ${child.pid} after ${durationMs}ms`);
      return res.status(408).json({
        error: "timeout",
        message: `Command timed out after ${TIMEOUT}ms`,
        text: textOut || null,
        images: [],
        durationMs,
      });
    }

    if (code !== 0) {
      console.log(`[DONE]    Exit ${code}, ${durationMs}ms`);
      return res.status(500).json({
        error: "execution_error",
        message: stderrOut || `Process exited with code ${code}`,
        exitCode: code,
        durationMs,
      });
    }

    console.log(`[DONE]    Exit 0, ${durationMs}ms, ${textOut.length} chars output`);
    res.json({ text: textOut, images: [], exitCode: 0, durationMs });
  });
});

// GET /health
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// GET /images/:filename — serve files from /tmp/images with path traversal protection
app.get("/images/:filename", (req, res) => {
  const resolved = path.resolve(IMAGES_DIR, req.params.filename);
  if (!resolved.startsWith(IMAGES_DIR + "/")) {
    return res.sendStatus(400);
  }
  res.sendFile(resolved, (err) => {
    if (err) res.sendStatus(404);
  });
});

// Graceful shutdown — kill process group, not just the child
process.on("SIGTERM", () => {
  console.log("[SHUTDOWN] SIGTERM received");
  if (activeChild) {
    try { process.kill(-activeChild.pid, "SIGTERM"); } catch (_) { /* already dead */ }
  }
  process.exit(0);
});

app.listen(Number(PORT), () => {
  console.log(`[STARTUP] VM server listening on port ${PORT}`);
});
