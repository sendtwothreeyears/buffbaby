const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = process.env.DB_PATH || "/data/cockpit.db";

let db;

function getDb() {
  if (db) return db;

  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");

  runMigrations(db);

  console.log(`[DB] Opened ${DB_PATH} (version ${db.pragma("user_version", { simple: true })})`);
  return db;
}

function runMigrations(db) {
  const version = db.pragma("user_version", { simple: true });

  if (version < 1) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS config (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS commands (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    TEXT NOT NULL,
        input      TEXT NOT NULL,
        output_summary TEXT,
        channel    TEXT NOT NULL,
        duration_ms INTEGER,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS skills_cache (
        repo_path  TEXT PRIMARY KEY,
        skills     TEXT NOT NULL,
        scanned_at TEXT DEFAULT (datetime('now'))
      );
    `);
    db.pragma("user_version = 1");
    console.log("[DB] Migrated to version 1");
  }

  if (version < 2) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS artifacts (
        id         TEXT PRIMARY KEY,
        type       TEXT NOT NULL,
        file_path  TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);
    db.pragma("user_version = 2");
    console.log("[DB] Migrated to version 2 (artifacts table)");
  }
}

// --- Config helpers ---

function getConfig(key) {
  const db = getDb();
  const row = db.prepare("SELECT value FROM config WHERE key = ?").get(key);
  return row ? row.value : null;
}

function setConfig(key, value) {
  const db = getDb();
  db.prepare(
    "INSERT INTO config (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
  ).run(key, value);
}

// --- Command history ---

function logCommand({ userId, input, outputSummary, channel, durationMs }) {
  const db = getDb();
  db.prepare(
    "INSERT INTO commands (user_id, input, output_summary, channel, duration_ms) VALUES (?, ?, ?, ?, ?)"
  ).run(userId, input, outputSummary || null, channel, durationMs || null);
}

// --- Skills cache ---

function getCachedSkills(repoPath) {
  const db = getDb();
  const row = db.prepare("SELECT skills, scanned_at FROM skills_cache WHERE repo_path = ?").get(repoPath);
  if (!row) return null;

  // 5-minute TTL
  const scannedAt = new Date(row.scanned_at + "Z").getTime();
  if (Date.now() - scannedAt > 5 * 60 * 1000) return null;

  return JSON.parse(row.skills);
}

function setCachedSkills(repoPath, skills) {
  const db = getDb();
  db.prepare(
    "INSERT INTO skills_cache (repo_path, skills, scanned_at) VALUES (?, ?, datetime('now')) ON CONFLICT(repo_path) DO UPDATE SET skills = excluded.skills, scanned_at = excluded.scanned_at"
  ).run(repoPath, JSON.stringify(skills));
}

function clearSkillsCache(repoPath) {
  const db = getDb();
  db.prepare("DELETE FROM skills_cache WHERE repo_path = ?").run(repoPath);
}

// --- Artifacts ---

function insertArtifact({ id, type, filePath, ttlMs = 30 * 60 * 1000 }) {
  const db = getDb();
  const expiresAt = new Date(Date.now() + ttlMs).toISOString().replace("T", " ").replace("Z", "");
  db.prepare(
    "INSERT INTO artifacts (id, type, file_path, expires_at) VALUES (?, ?, ?, ?)"
  ).run(id, type, filePath, expiresAt);
}

function getArtifact(id) {
  const db = getDb();
  return db.prepare("SELECT * FROM artifacts WHERE id = ?").get(id) || null;
}

function deleteExpiredArtifacts() {
  const db = getDb();
  return db.prepare(
    "DELETE FROM artifacts WHERE expires_at < datetime('now') RETURNING id, file_path"
  ).all();
}

module.exports = {
  getDb,
  getConfig,
  setConfig,
  logCommand,
  getCachedSkills,
  setCachedSkills,
  clearSkillsCache,
  insertArtifact,
  getArtifact,
  deleteExpiredArtifacts,
};
