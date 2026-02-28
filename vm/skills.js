const fs = require("fs");
const os = require("os");
const path = require("path");
const { getCachedSkills, setCachedSkills, clearSkillsCache } = require("./db");

const BASE_SKILLS_DIR = path.join(os.homedir(), ".claude", "skills");

/**
 * Parse a single skill .md file into { name, description, filename, source }.
 */
function parseSkillFile(filePath, source) {
  const content = fs.readFileSync(filePath, "utf-8");
  const filename = path.basename(filePath);
  const name = filename.replace(".md", "");

  // Try YAML frontmatter description first
  const descMatch = content.match(/description:\s*"?([^"\n]+)/);
  if (descMatch) {
    return { name, description: descMatch[1].trim(), filename, source };
  }

  // Fall back to first non-empty, non-frontmatter line
  const lines = content.split("\n");
  let inFrontmatter = false;
  for (const line of lines) {
    if (line.trim() === "---") {
      inFrontmatter = !inFrontmatter;
      continue;
    }
    if (inFrontmatter) continue;
    const trimmed = line.replace(/^#+\s*/, "").trim();
    if (trimmed && !trimmed.startsWith("#")) {
      return { name, description: trimmed.slice(0, 100), filename, source };
    }
  }

  return { name, description: name, filename, source };
}

/**
 * Scan a directory for .md skill files.
 * Returns array of { name, description, filename, source }.
 */
function scanDir(dir, source) {
  if (!fs.existsSync(dir)) return [];
  try {
    return fs.readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => parseSkillFile(path.join(dir, f), source));
  } catch {
    return [];
  }
}

/**
 * Scan base skills (~/.claude/skills/) and repo skills (.claude/skills/).
 * Repo skills override base skills on name collision.
 * Returns array of { name, description, filename, source }.
 */
function scanSkills(repoPath, { useCache = true } = {}) {
  if (useCache) {
    const cached = getCachedSkills(repoPath);
    if (cached) return cached;
  } else {
    clearSkillsCache(repoPath);
  }

  const baseSkills = scanDir(BASE_SKILLS_DIR, "base");
  const repoSkills = repoPath
    ? scanDir(path.join(repoPath, ".claude", "skills"), "repo")
    : [];

  // Merge: repo overrides base on name collision
  const merged = new Map();
  for (const skill of baseSkills) merged.set(skill.name, skill);
  for (const skill of repoSkills) merged.set(skill.name, skill);

  const skills = Array.from(merged.values());
  setCachedSkills(repoPath, skills);
  return skills;
}

module.exports = { scanSkills };
