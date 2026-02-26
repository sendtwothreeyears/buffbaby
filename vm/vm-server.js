const express = require("express");
const { spawn } = require("child_process");
const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const { chromium } = require("playwright");

const { ANTHROPIC_API_KEY, PORT = "3001", COMMAND_TIMEOUT_MS = "300000", IDLE_TIMEOUT_MS = "1800000" } = process.env;

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

const IDLE_TIMEOUT = Number(IDLE_TIMEOUT_MS);
const MAX_OUTPUT_BYTES = 10 * 1024 * 1024; // 10MB cap on stdout/stderr
const IMAGES_DIR = "/tmp/images";
const IMAGE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes
const MAX_IMAGE_FILES = 100;
const MOBILE_VIEWPORT = { width: 390, height: 844, deviceScaleFactor: 2 };
const DESKTOP_VIEWPORT = { width: 1440, height: 900, deviceScaleFactor: 2 };
const NAV_TIMEOUT_MS = 15_000;
const MAX_IMAGE_BYTES = 600_000;
const MIN_JPEG_QUALITY = 30;

const app = express();
let busy = false;
let activeChild = null;
let lastActivity = Date.now();
let pendingImages = [];

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
  pendingImages = [];
  lastActivity = Date.now();
  const start = Date.now();
  const stdoutChunks = [];
  const stderrChunks = [];

  const child = spawn("claude", ["-p", "--continue", "--dangerously-skip-permissions", "-"], {
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
    lastActivity = Date.now();
    const durationMs = Date.now() - start;
    const textOut = Buffer.concat(stdoutChunks).toString();
    const stderrOut = Buffer.concat(stderrChunks).toString();

    if (timedOut) {
      const images = [...pendingImages];
      pendingImages = [];
      console.log(`[TIMEOUT] Killed PID ${child.pid} after ${durationMs}ms`);
      return res.status(408).json({
        error: "timeout",
        message: `Command timed out after ${TIMEOUT}ms`,
        text: textOut || null,
        images,
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

    const images = [...pendingImages];
    pendingImages = [];
    console.log(`[DONE]    Exit 0, ${durationMs}ms, ${textOut.length} chars output, ${images.length} image(s)`);
    res.json({ text: textOut, images, exitCode: 0, durationMs });
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

// POST /screenshot — capture a web page with Playwright
app.post("/screenshot", async (req, res) => {
  const { url, viewport = "mobile", fullPage = false } = req.body || {};

  if (!url || typeof url !== "string") {
    return res.status(400).json({ success: false, error: "url is required" });
  }
  if (viewport !== "mobile" && viewport !== "desktop") {
    return res.status(400).json({ success: false, error: 'viewport must be "mobile" or "desktop"' });
  }

  const viewportConfig = viewport === "desktop" ? DESKTOP_VIEWPORT : MOBILE_VIEWPORT;
  let browser;

  try {
    browser = await chromium.launch({ args: ["--no-sandbox"] });
    const page = await browser.newPage({ viewport: viewportConfig });
    await page.goto(url, { waitUntil: "networkidle", timeout: NAV_TIMEOUT_MS });

    const filename = `${crypto.randomUUID()}.jpeg`;
    const filepath = path.join(IMAGES_DIR, filename);

    // Iterative JPEG compression — start at quality 80, reduce until under threshold
    let quality = 80;
    let buffer;
    do {
      buffer = await page.screenshot({ type: "jpeg", quality, fullPage: !!fullPage });
      if (buffer.length <= MAX_IMAGE_BYTES) break;
      quality -= 10;
    } while (quality >= MIN_JPEG_QUALITY);

    await fs.writeFile(filepath, buffer);
    pendingImages.push({ type: "screenshot", filename, url: `/images/${filename}` });

    console.log(`[SCREENSHOT] ${filename} (${buffer.length} bytes, q=${quality}) ${url}`);
    res.json({
      success: true,
      filename,
      url: `/images/${filename}`,
      viewport: viewportConfig,
      sizeBytes: buffer.length,
    });
  } catch (err) {
    console.error(`[SCREENSHOT_ERR] ${err.message}`);
    res.status(502).json({ success: false, error: err.message });
  } finally {
    if (browser) await browser.close();
  }
});

// Image cleanup — remove expired images every 5 minutes
setInterval(async () => {
  try {
    const files = await fs.readdir(IMAGES_DIR);
    const now = Date.now();
    let cleaned = 0;

    // If over cap, delete oldest first regardless of age
    if (files.length > MAX_IMAGE_FILES) {
      const stats = await Promise.all(
        files.map(async (f) => {
          const fp = path.join(IMAGES_DIR, f);
          const stat = await fs.stat(fp);
          return { file: f, path: fp, mtimeMs: stat.mtimeMs };
        })
      );
      stats.sort((a, b) => a.mtimeMs - b.mtimeMs);
      const excess = stats.slice(0, files.length - MAX_IMAGE_FILES);
      for (const { path: fp } of excess) {
        await fs.unlink(fp);
        cleaned++;
      }
    }

    // TTL-based cleanup
    for (const file of await fs.readdir(IMAGES_DIR)) {
      const fp = path.join(IMAGES_DIR, file);
      const stat = await fs.stat(fp);
      if (now - stat.mtimeMs > IMAGE_TTL_MS) {
        await fs.unlink(fp);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[CLEANUP] Removed ${cleaned} expired image(s)`);
    }
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.error(`[CLEANUP_ERR] ${err.message}`);
    }
  }
}, CLEANUP_INTERVAL_MS);

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
  console.log(`[STARTUP] Idle timeout: ${IDLE_TIMEOUT / 1000}s`);

  // Start test app server on port 8080 (static HTML for screenshot testing)
  const testAppPath = path.join(__dirname, "test-app");
  const { exec } = require("child_process");
  exec(`npx -y serve ${testAppPath} -l 8080 -s`, (err) => {
    if (err) console.error(`[TEST_APP] Failed to start: ${err.message}`);
  });
  console.log("[TEST_APP] Starting on http://localhost:8080");
});

// Idle shutdown — exit if no activity for IDLE_TIMEOUT_MS (Docker restart: unless-stopped)
setInterval(() => {
  if (!busy && Date.now() - lastActivity > IDLE_TIMEOUT) {
    console.log(`[IDLE] No activity for ${IDLE_TIMEOUT / 1000}s, shutting down`);
    process.exit(0);
  }
}, 60_000);
