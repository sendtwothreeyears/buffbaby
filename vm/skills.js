const fs = require("fs");
const path = require("path");
const { getCachedSkills, setCachedSkills, clearSkillsCache } = require("./db");

/**
 * Scan .claude/skills/ directory for project skills.
 * Returns array of { name, description, filename }.
 */
function scanSkills(repoPath, { useCache = true } = {}) {
  if (useCache) {
    const cached = getCachedSkills(repoPath);
    if (cached) return cached;
  } else {
    clearSkillsCache(repoPath);
  }

  const skillsDir = path.join(repoPath, ".claude", "skills");
  if (!fs.existsSync(skillsDir)) {
    setCachedSkills(repoPath, []);
    return [];
  }

  let files;
  try {
    files = fs.readdirSync(skillsDir).filter((f) => f.endsWith(".md"));
  } catch {
    setCachedSkills(repoPath, []);
    return [];
  }

  const skills = files.map((f) => {
    const content = fs.readFileSync(path.join(skillsDir, f), "utf-8");
    const name = f.replace(".md", "");

    // Try YAML frontmatter description first
    const descMatch = content.match(/description:\s*"?([^"\n]+)/);
    if (descMatch) {
      return { name, description: descMatch[1].trim(), filename: f };
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
        return { name, description: trimmed.slice(0, 100), filename: f };
      }
    }

    return { name, description: name, filename: f };
  });

  setCachedSkills(repoPath, skills);
  return skills;
}

module.exports = { scanSkills };
