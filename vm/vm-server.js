const express = require("express");
const { spawn, execSync, execFileSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const { chromium } = require("playwright");
const { getConfig, setConfig, logCommand, getArtifact, deleteExpiredArtifacts } = require("./db");
const { scanSkills } = require("./skills");
const { generateView, renderExpiredPage, VIEWS_DIR } = require("./web-views");
const { classifyOutput, createInlineSummary } = require("./output-classifier");
const tmux = require("./tmux");

const { ANTHROPIC_API_KEY, PORT = "3001", COMMAND_TIMEOUT_MS = "300000", IDLE_TIMEOUT_MS = "1800000", ENABLE_TEST_APP, RELAY_CALLBACK_URL = "" } = process.env;
const REPOS_DIR = process.env.REPOS_DIR || "/data/repos";
const MAX_THREADS = Number(process.env.MAX_THREADS) || 5;

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
const IMAGES_DIR = process.env.IMAGES_DIR || "/tmp/images";
const IMAGE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes
const MAX_IMAGE_FILES = 100;
const MOBILE_VIEWPORT = { width: 390, height: 844, deviceScaleFactor: 2 };
const DESKTOP_VIEWPORT = { width: 1440, height: 900, deviceScaleFactor: 2 };
const NAV_TIMEOUT_MS = 15_000;
const MAX_IMAGE_BYTES = 600_000;
const JPEG_QUALITY = 75;
const JPEG_QUALITY_FALLBACK = 50;

// Ensure directories exist on startup (Fly Volume mounts overlay container filesystem)
const fsSync = require("fs");
for (const dir of [IMAGES_DIR, REPOS_DIR, VIEWS_DIR]) {
  if (!fsSync.existsSync(dir)) {
    fsSync.mkdirSync(dir, { recursive: true });
    console.log(`[STARTUP] Created ${dir}`);
  }
}

// Restore CWD from SQLite — defaults to REPOS_DIR if not set or invalid
function getCurrentCwd() {
  const saved = getConfig("cwd");
  if (saved && fsSync.existsSync(saved)) return saved;
  return REPOS_DIR;
}

const app = express();
let busy = false;
let activeChild = null;
let lastActivity = Date.now();
let skipContinue = false; // Set by POST /clear — next /command starts a fresh conversation
// Images captured by POST /screenshot during a /command execution.
// Safe because only one /command runs at a time (busy flag enforces single concurrency).
// /command resets on entry, /screenshot appends, /command drains on exit.
let pendingImages = [];

app.use(express.json());

// --- Thread management (tmux-backed sessions) ---
const activeThreads = new Map(); // threadId -> { threadId, type, dir, command, createdBy, createdAt }

function resolveThreadDir(dir) {
  const resolved = path.resolve(REPOS_DIR, dir);
  if (!resolved.startsWith(REPOS_DIR + "/") && resolved !== REPOS_DIR) {
    throw new Error("Invalid directory: path traversal detected");
  }
  if (!fsSync.existsSync(resolved)) {
    throw new Error("Invalid directory: not found");
  }
  return resolved;
}

function tmuxSessionName(threadId) {
  return `thread-${threadId}`;
}

// Collect uncommitted git diffs after command execution
function collectDiffs(cwd) {
  const execCwd = cwd || getCurrentCwd();
  try {
    const diff = execSync("git diff HEAD --no-color", {
      cwd: execCwd,
      timeout: 2000,
      maxBuffer: 512 * 1024,
      encoding: "utf-8",
    });

    if (!diff.trim()) return null;

    const summary = execSync("git diff HEAD --stat --no-color", {
      cwd: execCwd,
      timeout: 2000,
      maxBuffer: 64 * 1024,
      encoding: "utf-8",
    });

    const summaryLine = summary.trim().split("\n").pop()?.trim() || "";

    return { diff, summary: summaryLine };
  } catch {
    return null;
  }
}

// POST progress callbacks to relay during command execution
const pendingCallbacks = [];

async function postCallback(userId, payload) {
  const url = `${RELAY_CALLBACK_URL}/callback/${encodeURIComponent(userId)}`;
  const promise = fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch((err) => console.error(`[CALLBACK] Failed: ${err.message}`));
  pendingCallbacks.push(promise);
}

// POST /command — run a prompt through Claude Code
app.post("/command", (req, res) => {
  const { text, callbackUserId, callbackPhone } = req.body || {};
  const userId = callbackUserId || callbackPhone; // backward-compat
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
  pendingCallbacks.length = 0;
  lastActivity = Date.now();
  const start = Date.now();
  const stdoutChunks = [];
  const stderrChunks = [];
  let approvalRequested = false;

  const cwd = getCurrentCwd();
  const args = ["-p", "--dangerously-skip-permissions", "-"];
  if (!skipContinue) args.splice(1, 0, "--continue");
  skipContinue = false;

  const child = spawn("claude", args, {
    cwd,
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

  // Line-buffered stdout parser for ::progress:: and ::approval:: markers
  let lineBuf = "";

  child.stdout.on("data", (chunk) => {
    stdoutBytes += chunk.length;
    if (stdoutBytes <= MAX_OUTPUT_BYTES) stdoutChunks.push(chunk);

    // Parse markers from stdout lines
    lineBuf += chunk.toString();
    const lines = lineBuf.split("\n");
    lineBuf = lines.pop(); // keep incomplete last line in buffer

    for (const line of lines) {
      if (line.match(/^::approval::/)) {
        approvalRequested = true;
      }
      const progressMatch = line.match(/^::progress::\s*(.+)/);
      if (progressMatch && RELAY_CALLBACK_URL && userId) {
        postCallback(userId, { type: "progress", message: progressMatch[1] });
      }
    }
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

  child.on("close", async (code) => {
    clearTimeout(timer);
    lastActivity = Date.now();
    const durationMs = Date.now() - start;
    const rawOut = Buffer.concat(stdoutChunks).toString();
    const stderrOut = Buffer.concat(stderrChunks).toString();

    // Strip ::progress:: and ::approval:: markers from output sent to user
    const textOut = rawOut
      .split("\n")
      .filter((line) => !line.match(/^::progress::\s/) && !line.match(/^::approval::/))
      .join("\n")
      .trim();

    try {
      // Ensure all progress callbacks have been delivered before responding
      await Promise.allSettled(pendingCallbacks);
      pendingCallbacks.length = 0;

      const diffResult = collectDiffs(cwd);

      if (timedOut) {
        const images = [...pendingImages];
        pendingImages = [];
        console.log(`[TIMEOUT] Killed PID ${child.pid} after ${durationMs}ms`);
        return res.status(408).json({
          error: "timeout",
          message: `Command timed out after ${TIMEOUT}ms`,
          text: textOut || null,
          images,
          diffs: diffResult?.diff || undefined,
          diffSummary: diffResult?.summary || undefined,
          durationMs,
        });
      }

      if (code !== 0) {
        const images = [...pendingImages];
        pendingImages = [];
        console.log(`[DONE]    Exit ${code}, ${durationMs}ms, ${images.length} image(s)`);
        return res.status(500).json({
          error: "execution_error",
          message: stderrOut || `Process exited with code ${code}`,
          text: textOut || null,
          images,
          diffs: diffResult?.diff || undefined,
          diffSummary: diffResult?.summary || undefined,
          exitCode: code,
          durationMs,
        });
      }

      const images = [...pendingImages];
      pendingImages = [];

      // Classify output and generate web view for long output
      const classification = classifyOutput(textOut, diffResult?.diff);
      let responseText = textOut;
      let viewUrl;

      if (classification.isLong) {
        try {
          const viewContent = classification.type === "diff"
            ? (diffResult?.diff || textOut)
            : textOut;
          const view = generateView(classification.type, viewContent, {
            title: `Command Output`,
            diffs: diffResult?.diff,
            diffSummary: diffResult?.summary,
          });
          viewUrl = `/view/${view.id}`;

          // Replace full text with inline summary
          responseText = createInlineSummary(textOut, classification, {
            diffs: diffResult?.diff,
            diffSummary: diffResult?.summary,
          });
        } catch (viewErr) {
          console.error(`[VIEW_ERR] Failed to generate view: ${viewErr.message}`);
          // Fall through with original text
        }
      }

      console.log(`[DONE]    Exit 0, ${durationMs}ms, ${textOut.length} chars output, ${images.length} image(s)${viewUrl ? `, view: ${viewUrl}` : ""}`);
      res.json({
        text: responseText,
        images,
        diffs: diffResult?.diff || undefined,
        diffSummary: diffResult?.summary || undefined,
        outputType: classification.type,
        viewUrl,
        approvalRequired: approvalRequested && code === 0,
        exitCode: 0,
        durationMs,
      });
    } finally {
      busy = false;
      activeChild = null;
    }
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

// GET /view/:id — serve generated HTML views with expiry check
app.get("/view/:id", (req, res) => {
  const { id } = req.params;

  // Validate UUID format
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) {
    return res.sendStatus(400);
  }

  const artifact = getArtifact(id);
  if (!artifact) {
    return res.sendStatus(404);
  }

  // Check expiry
  const expiresAt = new Date(artifact.expires_at + "Z").getTime();
  if (Date.now() > expiresAt) {
    res.status(410).type("html").send(renderExpiredPage());
    return;
  }

  res.sendFile(artifact.file_path, (err) => {
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

    // JPEG capture — try at default quality, retry once at lower quality if too large
    let quality = JPEG_QUALITY;
    let buffer = await page.screenshot({ type: "jpeg", quality, fullPage });
    if (buffer.length > MAX_IMAGE_BYTES) {
      quality = JPEG_QUALITY_FALLBACK;
      buffer = await page.screenshot({ type: "jpeg", quality, fullPage });
    }

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

// POST /approve — create PR or revert changes
app.post("/approve", async (req, res) => {
  const { approved } = req.body || {};

  if (busy) {
    return res.status(409).json({ error: "busy" });
  }

  busy = true;
  lastActivity = Date.now();

  const approveCwd = getCurrentCwd();
  try {
    if (approved) {
      const child = spawn("claude", ["-p", "--dangerously-skip-permissions", "-"], {
        cwd: approveCwd,
        detached: true,
        stdio: ["pipe", "pipe", "pipe"],
      });
      activeChild = child;

      child.stdin.write("Create a git commit for all current changes and push a PR using `gh pr create`. Use a descriptive title based on the changes.");
      child.stdin.end();

      const stdoutChunks = [];
      child.stdout.on("data", (chunk) => stdoutChunks.push(chunk));
      child.stderr.on("data", () => {}); // discard stderr

      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          try { process.kill(-child.pid, "SIGTERM"); } catch (_) {}
          reject(new Error("Approve command timed out"));
        }, TIMEOUT);

        child.on("close", (code) => {
          clearTimeout(timer);
          if (code !== 0) reject(new Error(`Approve exited with code ${code}`));
          else resolve();
        });
        child.on("error", (err) => {
          clearTimeout(timer);
          reject(err);
        });
      });

      const stdout = Buffer.concat(stdoutChunks).toString();
      const prUrlMatch = stdout.match(/https:\/\/github\.com\/[^\s]+\/pull\/\d+/);

      console.log(`[APPROVE] PR created: ${prUrlMatch ? prUrlMatch[0] : "URL not found"}`);
      res.json({
        text: stdout,
        prUrl: prUrlMatch ? prUrlMatch[0] : null,
      });
    } else {
      execSync("git checkout . && git clean -fd", { cwd: approveCwd, timeout: 5000 });
      console.log("[REJECT] Changes reverted");
      res.json({ text: "Changes reverted." });
    }
  } catch (err) {
    console.error(`[APPROVE_ERR] ${err.message}`);
    res.status(500).json({ error: "approve_failed", message: err.message });
  } finally {
    busy = false;
    activeChild = null;
  }
});

// POST /clone — clone a git repo to /data/repos/<name>
app.post("/clone", async (req, res) => {
  const { url } = req.body || {};

  if (!url || typeof url !== "string" || !url.startsWith("http")) {
    return res.status(400).json({ error: "bad_request", message: "A valid HTTPS URL is required" });
  }

  if (busy) {
    return res.status(409).json({ error: "busy", message: "A command is already in progress" });
  }

  busy = true;
  lastActivity = Date.now();
  const start = Date.now();

  try {
    // Extract repo name from URL: https://github.com/user/repo.git → repo
    const repoName = path.basename(url, ".git").replace(/[^a-zA-Z0-9._-]/g, "");
    if (!repoName) {
      return res.status(400).json({ error: "bad_request", message: "Could not extract repo name from URL" });
    }

    const repoPath = path.join(REPOS_DIR, repoName);

    if (fsSync.existsSync(repoPath)) {
      // Repo already exists — pull latest instead
      execSync("git pull", { cwd: repoPath, timeout: 60_000, encoding: "utf-8" });
      console.log(`[CLONE] Pulled existing repo: ${repoName}`);
    } else {
      // Clone new repo — use execFileSync to avoid shell injection via URL

      execFileSync("git", ["clone", url, repoPath], { timeout: 120_000, encoding: "utf-8" });
      console.log(`[CLONE] Cloned: ${repoName}`);
    }

    // Update CWD
    setConfig("cwd", repoPath);

    // Scan skills
    const skills = scanSkills(repoPath, { useCache: false });

    const durationMs = Date.now() - start;
    const text = `Cloned ${repoName}. Working directory set to ${repoPath}.${skills.length > 0 ? `\n${skills.length} project skill(s) found.` : ""}`;

    res.json({ text, skills, durationMs });
  } catch (err) {
    console.error(`[CLONE_ERR] ${err.message}`);
    res.status(500).json({ error: "clone_failed", message: err.message });
  } finally {
    busy = false;
  }
});

// POST /switch — switch to a different cloned repo
app.post("/switch", (req, res) => {
  const { name } = req.body || {};

  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "bad_request", message: "Repo name is required" });
  }

  const sanitized = name.replace(/[^a-zA-Z0-9._-]/g, "");
  const repoPath = path.join(REPOS_DIR, sanitized);

  if (!fsSync.existsSync(repoPath)) {
    return res.status(404).json({ error: "not_found", message: `Repo "${sanitized}" not found. Use 'repos' to see available repos.` });
  }

  lastActivity = Date.now();
  setConfig("cwd", repoPath);

  const skills = scanSkills(repoPath, { useCache: false });
  const text = `Switched to ${sanitized}.${skills.length > 0 ? ` ${skills.length} project skill(s) found.` : ""}`;

  console.log(`[SWITCH] ${sanitized}`);
  res.json({ text, skills });
});

// GET /repos — list all cloned repos
app.get("/repos", (_req, res) => {
  lastActivity = Date.now();

  try {
    const currentCwd = getCurrentCwd();
    const entries = fsSync.existsSync(REPOS_DIR)
      ? fsSync.readdirSync(REPOS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory())
      : [];

    const repos = entries.map((d) => {
      const repoPath = path.join(REPOS_DIR, d.name);
      const isCurrent = repoPath === currentCwd;
      return { name: d.name, path: repoPath, current: isCurrent };
    });

    if (repos.length === 0) {
      return res.json({ text: "No repos cloned yet. Use 'clone <url>' to get started.", repos });
    }

    const lines = repos.map((r) => `${r.current ? "→ " : "  "}${r.name}`);
    const text = `Repos:\n${lines.join("\n")}`;

    res.json({ text, repos });
  } catch (err) {
    console.error(`[REPOS_ERR] ${err.message}`);
    res.status(500).json({ error: "repos_failed", message: err.message });
  }
});

// GET /status — current repo, branch, changed files, active threads
app.get("/status", async (_req, res) => {
  lastActivity = Date.now();

  const cwd = getCurrentCwd();
  const repoName = path.basename(cwd);

  // Check if cwd is a git repo
  if (!fsSync.existsSync(path.join(cwd, ".git"))) {
    return res.json({ text: `Working directory: ${cwd}\nNo git repo found. Use 'clone <url>' to get started.` });
  }

  try {
    const branch = execSync("git branch --show-current", { cwd, timeout: 5000, encoding: "utf-8" }).trim();
    const statusOutput = execSync("git status --porcelain", { cwd, timeout: 5000, encoding: "utf-8" }).trim();
    const changedFiles = statusOutput ? statusOutput.split("\n").length : 0;

    const parts = [`Repo: ${repoName}`, `Branch: ${branch}`];
    if (changedFiles > 0) {
      parts.push(`Changed files: ${changedFiles}`);
    } else {
      parts.push("Working tree clean");
    }

    // Append active threads
    if (activeThreads.size > 0) {
      parts.push("");
      parts.push(`Active threads: ${activeThreads.size}`);
      for (const [threadId, meta] of activeThreads) {
        const running = await tmux.getProcessRunning(tmuxSessionName(threadId));
        const icon = meta.type === "terminal" ? "🖥" : "🤖";
        const status = running ? "running" : "exited";
        parts.push(`  ${icon} ${meta.dir} — ${(meta.command || "").slice(0, 40)} (${status})`);
      }
    }

    res.json({ text: parts.join("\n") });
  } catch (err) {
    console.error(`[STATUS_ERR] ${err.message}`);
    res.json({ text: `Working directory: ${cwd}\nGit status unavailable: ${err.message}` });
  }
});

// GET /branch — list branches, mark current
app.get("/branch", (_req, res) => {
  lastActivity = Date.now();

  const cwd = getCurrentCwd();
  if (!fsSync.existsSync(path.join(cwd, ".git"))) {
    return res.json({ text: "No git repo found. Use 'clone <url>' to get started." });
  }

  try {
    const output = execSync("git branch --no-color", { cwd, timeout: 5000, encoding: "utf-8" }).trim();
    if (!output) {
      return res.json({ text: "No branches found." });
    }
    res.json({ text: `Branches:\n${output}` });
  } catch (err) {
    console.error(`[BRANCH_ERR] ${err.message}`);
    res.status(500).json({ error: "branch_failed", message: err.message });
  }
});

// POST /checkout — switch or create+switch branch
app.post("/checkout", (req, res) => {
  const { name, create } = req.body || {};

  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "bad_request", message: "Branch name is required" });
  }

  // Sanitize branch name — allow alphanumeric, hyphens, underscores, slashes, dots
  const sanitized = name.replace(/[^a-zA-Z0-9._\/-]/g, "");
  if (!sanitized) {
    return res.status(400).json({ error: "bad_request", message: "Invalid branch name" });
  }

  const cwd = getCurrentCwd();
  if (!fsSync.existsSync(path.join(cwd, ".git"))) {
    return res.json({ text: "No git repo found. Use 'clone <url>' to get started." });
  }

  lastActivity = Date.now();

  try {
    const args = create ? ["-b", sanitized] : [sanitized];

    execFileSync("git", ["checkout", ...args], { cwd, timeout: 10_000, encoding: "utf-8" });

    const action = create ? "Created and switched to" : "Switched to";
    console.log(`[CHECKOUT] ${action} ${sanitized}`);
    res.json({ text: `${action} branch ${sanitized}.` });
  } catch (err) {
    console.error(`[CHECKOUT_ERR] ${err.message}`);
    res.status(500).json({ error: "checkout_failed", message: err.message });
  }
});

// POST /pr/create — create PR from current branch
app.post("/pr/create", (req, res) => {
  const cwd = getCurrentCwd();
  if (!fsSync.existsSync(path.join(cwd, ".git"))) {
    return res.status(400).json({ error: "no_repo", message: "No git repo found." });
  }

  if (busy) {
    return res.status(409).json({ error: "busy", message: "A command is already in progress" });
  }

  busy = true;
  lastActivity = Date.now();

  try {

    const output = execFileSync("gh", ["pr", "create", "--fill"], { cwd, timeout: 30_000, encoding: "utf-8" }).trim();

    const prUrlMatch = output.match(/https:\/\/github\.com\/[^\s]+\/pull\/\d+/);
    console.log(`[PR_CREATE] ${prUrlMatch ? prUrlMatch[0] : output}`);
    res.json({ text: output, prUrl: prUrlMatch ? prUrlMatch[0] : null });
  } catch (err) {
    console.error(`[PR_CREATE_ERR] ${err.message}`);
    res.status(500).json({ error: "pr_create_failed", message: err.stderr || err.message });
  } finally {
    busy = false;
  }
});

// GET /pr/status — show CI status and review state
app.get("/pr/status", (_req, res) => {
  const cwd = getCurrentCwd();
  if (!fsSync.existsSync(path.join(cwd, ".git"))) {
    return res.status(400).json({ error: "no_repo", message: "No git repo found." });
  }

  lastActivity = Date.now();

  try {

    const output = execFileSync("gh", ["pr", "status"], { cwd, timeout: 15_000, encoding: "utf-8" }).trim();
    res.json({ text: output });
  } catch (err) {
    console.error(`[PR_STATUS_ERR] ${err.message}`);
    res.status(500).json({ error: "pr_status_failed", message: err.stderr || err.message });
  }
});

// POST /pr/merge — merge current PR
app.post("/pr/merge", (req, res) => {
  const cwd = getCurrentCwd();
  if (!fsSync.existsSync(path.join(cwd, ".git"))) {
    return res.status(400).json({ error: "no_repo", message: "No git repo found." });
  }

  if (busy) {
    return res.status(409).json({ error: "busy", message: "A command is already in progress" });
  }

  busy = true;
  lastActivity = Date.now();

  try {

    const output = execFileSync("gh", ["pr", "merge", "--auto", "--squash"], { cwd, timeout: 30_000, encoding: "utf-8" }).trim();
    console.log(`[PR_MERGE] ${output.substring(0, 80)}`);
    res.json({ text: output });
  } catch (err) {
    console.error(`[PR_MERGE_ERR] ${err.message}`);
    res.status(500).json({ error: "pr_merge_failed", message: err.stderr || err.message });
  } finally {
    busy = false;
  }
});

// GET /onboarded — check if user has been onboarded
app.get("/onboarded", (_req, res) => {
  const flag = getConfig("onboarded");
  res.json({ onboarded: flag === "true" });
});

// POST /onboarded — mark user as onboarded
app.post("/onboarded", (_req, res) => {
  setConfig("onboarded", "true");
  res.json({ ok: true });
});

// GET /skills — return cached skills for current repo
app.get("/skills", (req, res) => {
  lastActivity = Date.now();
  const cwd = getCurrentCwd();
  const refresh = req.query.refresh === "true";
  const skills = scanSkills(cwd, { useCache: !refresh });
  res.json({ skills, repoPath: cwd });
});

// --- Thread endpoints (independent of busy flag) ---

// POST /thread/create — spawn a tmux session for a Discord thread
app.post("/thread/create", async (req, res) => {
  const { threadId, type, dir, command, createdBy } = req.body || {};

  if (!threadId || !type || !dir || !command) {
    return res.status(400).json({ error: "Missing required fields: threadId, type, dir, command" });
  }
  if (type !== "terminal" && type !== "agent") {
    return res.status(400).json({ error: "type must be 'terminal' or 'agent'" });
  }

  let resolved;
  try {
    resolved = resolveThreadDir(dir);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  // Check thread count
  const sessions = await tmux.listSessions();
  const threadSessions = sessions.filter(s => s.startsWith("thread-"));
  if (threadSessions.length >= MAX_THREADS) {
    return res.status(429).json({ error: `Max threads exceeded (${MAX_THREADS})` });
  }

  const sessionName = tmuxSessionName(threadId);

  // Kill stale session with same name if it exists
  if (await tmux.sessionExists(sessionName)) {
    await tmux.killSession(sessionName);
  }

  try {
    if (type === "terminal") {
      await tmux.createSession(sessionName, resolved, command);
    } else {
      // Agent: start a shell, then send the claude command
      await tmux.createSession(sessionName, resolved, "bash");
      const claudeCmd = `claude -p --dangerously-skip-permissions "${command.replace(/"/g, '\\"')}"`;
      await tmux.sendInput(sessionName, claudeCmd);
    }

    activeThreads.set(threadId, {
      threadId,
      type,
      dir,
      command,
      createdBy: createdBy || "unknown",
      createdAt: new Date().toISOString(),
    });

    console.log(`[THREAD] Created ${type} session: ${sessionName} (dir: ${dir})`);
    res.status(201).json({ created: true, tmuxSession: sessionName });
  } catch (err) {
    console.error(`[THREAD_ERR] Create failed: ${err.message}`);
    res.status(500).json({ error: `Failed to create session: ${err.message}` });
  }
});

// POST /thread/:id/input — send text to a thread's stdin
app.post("/thread/:id/input", async (req, res) => {
  const threadId = req.params.id;
  const { text } = req.body || {};

  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "text is required" });
  }

  const threadInfo = activeThreads.get(threadId);
  if (!threadInfo) {
    return res.status(404).json({ error: "Thread not found" });
  }

  const sessionName = tmuxSessionName(threadId);
  if (!(await tmux.sessionExists(sessionName))) {
    return res.status(410).json({ error: "Thread ended" });
  }

  try {
    if (threadInfo.type === "agent") {
      // Check if the claude process is still running
      const running = await tmux.getProcessRunning(sessionName);
      if (!running) {
        // Process exited back to shell — spawn a --continue session
        const claudeCmd = `claude -p --continue --dangerously-skip-permissions "${text.replace(/"/g, '\\"')}"`;
        await tmux.sendInput(sessionName, claudeCmd);
      } else {
        await tmux.sendInput(sessionName, text);
      }
    } else {
      await tmux.sendInput(sessionName, text);
    }
    res.json({ sent: true });
  } catch (err) {
    console.error(`[THREAD_ERR] Input failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// GET /thread/:id/output — read new output from a thread's log file
app.get("/thread/:id/output", async (req, res) => {
  const threadId = req.params.id;
  const since = Number(req.query.since) || 0;

  if (!activeThreads.has(threadId)) {
    return res.status(404).json({ error: "Thread not found" });
  }

  const sessionName = tmuxSessionName(threadId);
  const { output, offset } = tmux.readOutput(sessionName, since);
  const processRunning = await tmux.getProcessRunning(sessionName);
  const exitCode = processRunning ? null : await tmux.getExitCode(sessionName);

  res.json({ output, offset, processRunning, exitCode });
});

// POST /thread/:id/kill — kill a thread session
app.post("/thread/:id/kill", async (req, res) => {
  const threadId = req.params.id;
  const threadInfo = activeThreads.get(threadId);

  if (!threadInfo) {
    return res.status(404).json({ error: "Thread not found" });
  }

  const sessionName = tmuxSessionName(threadId);
  const summary = tmux.getSummary(sessionName);

  await tmux.killSession(sessionName);
  activeThreads.delete(threadId);

  console.log(`[THREAD] Killed session: ${sessionName}`);
  res.json({ killed: true, summary });
});

// GET /threads — list all active thread sessions
app.get("/threads", async (_req, res) => {
  const sessions = await tmux.listSessions();
  const threadSessions = sessions.filter(s => s.startsWith("thread-"));

  const threads = [];
  for (const session of threadSessions) {
    const threadId = session.replace("thread-", "");
    const meta = activeThreads.get(threadId) || { threadId, type: "unknown", dir: "unknown", command: "unknown" };
    const processRunning = await tmux.getProcessRunning(session);
    threads.push({
      ...meta,
      status: processRunning ? "running" : "exited",
      processRunning,
    });
  }

  res.json({ threads });
});

// POST /cancel — kill the active Claude Code process
app.post("/cancel", (_req, res) => {
  if (activeChild) {
    try {
      process.kill(-activeChild.pid, "SIGTERM");
    } catch (_) { /* already dead */ }
    console.log(`[CANCEL] Killed PID ${activeChild.pid}`);
    res.json({ cancelled: true });
  } else {
    res.json({ cancelled: false, message: "no active process" });
  }
});

// POST /clear — start a fresh conversation (next /command omits --continue)
app.post("/clear", (_req, res) => {
  skipContinue = true;
  console.log("[CLEAR] Next command will start a fresh conversation");
  res.json({ text: "Context cleared. Next command starts a fresh conversation." });
});

// Image cleanup — remove expired or excess images every 5 minutes
setInterval(async () => {
  try {
    const files = await fs.readdir(IMAGES_DIR);
    const now = Date.now();
    const entries = await Promise.all(
      files.map(async (f) => {
        const fp = path.join(IMAGES_DIR, f);
        const stat = await fs.stat(fp);
        return { path: fp, mtimeMs: stat.mtimeMs, expired: now - stat.mtimeMs > IMAGE_TTL_MS };
      })
    );

    // Delete expired files
    const toDelete = entries.filter((e) => e.expired);

    // If still over cap after removing expired, delete oldest remaining
    const remaining = entries.length - toDelete.length;
    if (remaining > MAX_IMAGE_FILES) {
      const alive = entries.filter((e) => !e.expired).sort((a, b) => a.mtimeMs - b.mtimeMs);
      toDelete.push(...alive.slice(0, remaining - MAX_IMAGE_FILES));
    }

    for (const { path: fp } of toDelete) {
      await fs.unlink(fp);
    }
    if (toDelete.length > 0) {
      console.log(`[CLEANUP] Removed ${toDelete.length} image(s)`);
    }
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.error(`[CLEANUP_ERR] ${err.message}`);
    }
  }

  // Artifact cleanup — delete expired web views using the artifacts table
  try {
    const expired = deleteExpiredArtifacts();
    for (const row of expired) {
      try {
        await fs.unlink(row.file_path);
      } catch (e) {
        if (e.code !== "ENOENT") console.error(`[CLEANUP_ERR] view ${row.id}: ${e.message}`);
      }
    }
    if (expired.length > 0) {
      console.log(`[CLEANUP] Removed ${expired.length} expired view(s)`);
    }
  } catch (err) {
    console.error(`[CLEANUP_ERR] artifacts: ${err.message}`);
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

  // Start test app server on port 8080 (for screenshot testing, not production)
  if (ENABLE_TEST_APP) {
    const testAppPath = path.join(__dirname, "test-app");
    const { exec } = require("child_process");
    exec(`npx -y serve ${testAppPath} -l 8080 -s`, (err) => {
      if (err) console.error(`[TEST_APP] Failed to start: ${err.message}`);
    });
    console.log("[TEST_APP] Starting on http://localhost:8080");
  }
});

// Idle shutdown — exit if no activity for IDLE_TIMEOUT_MS (Docker restart: unless-stopped)
setInterval(() => {
  if (!busy && Date.now() - lastActivity > IDLE_TIMEOUT) {
    console.log(`[IDLE] No activity for ${IDLE_TIMEOUT / 1000}s, shutting down`);
    process.exit(0);
  }
}, 60_000);
