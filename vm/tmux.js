const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");

const LOG_DIR = "/tmp";
const LOG_WARN_BYTES = 10 * 1024 * 1024; // 10MB — warn when log files get large

function logPath(sessionName) {
  return path.join(LOG_DIR, `${sessionName}.log`);
}

function exec(args) {
  return new Promise((resolve, reject) => {
    execFile("tmux", args, { timeout: 5000 }, (err, stdout, stderr) => {
      if (err) return reject(err);
      resolve(stdout);
    });
  });
}

async function createSession(sessionName, cwd, command) {
  // Create detached tmux session running the command
  await exec(["new-session", "-d", "-s", sessionName, "-c", cwd, command]);
  // Pipe all pane output to a log file for reliable streaming
  await exec(["pipe-pane", "-t", sessionName, `cat >> ${logPath(sessionName)}`]);
}

async function sendInput(sessionName, text) {
  await exec(["send-keys", "-t", sessionName, text, "Enter"]);
}

function readOutput(sessionName, byteOffset = 0) {
  const filePath = logPath(sessionName);
  if (!fs.existsSync(filePath)) {
    return { output: "", offset: 0 };
  }
  const stat = fs.statSync(filePath);
  if (stat.size > LOG_WARN_BYTES && byteOffset === 0) {
    console.warn(`[TMUX] Log file ${filePath} is ${(stat.size / 1024 / 1024).toFixed(1)}MB — consider ending this thread`);
  }
  if (byteOffset >= stat.size) {
    return { output: "", offset: stat.size };
  }
  const fd = fs.openSync(filePath, "r");
  const buf = Buffer.alloc(stat.size - byteOffset);
  fs.readSync(fd, buf, 0, buf.length, byteOffset);
  fs.closeSync(fd);
  return { output: buf.toString("utf-8"), offset: stat.size };
}

async function killSession(sessionName) {
  try {
    await exec(["kill-session", "-t", sessionName]);
  } catch {
    // Session may already be dead
  }
  // Clean up log file
  const file = logPath(sessionName);
  try { fs.unlinkSync(file); } catch { /* may not exist */ }
}

async function listSessions() {
  try {
    const out = await exec(["list-sessions", "-F", "#{session_name}"]);
    return out.trim().split("\n").filter(Boolean);
  } catch {
    // No tmux server running = no sessions
    return [];
  }
}

async function sessionExists(sessionName) {
  const sessions = await listSessions();
  return sessions.includes(sessionName);
}

async function getProcessRunning(sessionName) {
  try {
    const out = await exec(["list-panes", "-t", sessionName, "-F", "#{pane_dead}"]);
    const dead = out.trim();
    return dead !== "1";
  } catch {
    return false;
  }
}

async function getExitCode(sessionName) {
  try {
    const out = await exec(["list-panes", "-t", sessionName, "-F", "#{pane_dead_status}"]);
    const code = parseInt(out.trim(), 10);
    return Number.isFinite(code) ? code : null;
  } catch {
    return null;
  }
}

function getSummary(sessionName, maxLines = 10) {
  const filePath = logPath(sessionName);
  if (!fs.existsSync(filePath)) return "(no output)";
  const stat = fs.statSync(filePath);
  // Read only the last 4KB to avoid loading huge log files
  const readSize = Math.min(stat.size, 4096);
  const fd = fs.openSync(filePath, "r");
  const buf = Buffer.alloc(readSize);
  fs.readSync(fd, buf, 0, readSize, Math.max(0, stat.size - readSize));
  fs.closeSync(fd);
  const lines = buf.toString("utf-8").trim().split("\n");
  return lines.slice(-maxLines).join("\n") || "(no output)";
}

module.exports = {
  createSession,
  sendInput,
  logPath,
  readOutput,
  killSession,
  listSessions,
  sessionExists,
  getProcessRunning,
  getExitCode,
  getSummary,
};
