// Output type detection for smart rendering

const LINE_THRESHOLD = 30;

/**
 * Classify output text for rendering decisions.
 * @param {string} text - The command output text
 * @param {string|null} diffs - Git diffs if present
 * @returns {{ type: string, isLong: boolean }}
 */
function classifyOutput(text, diffs) {
  const lineCount = (text || "").split("\n").length;
  const isLong = lineCount >= LINE_THRESHOLD;

  if (diffs) return { type: "diff", isLong };

  if (/(\d+\s+(passed|failed|errors?|warnings?)|PASS|FAIL|✓|✗|BUILD)/i.test(text)) {
    return { type: "build", isLong };
  }

  if (/^(import |from |const |function |class |def |export )/m.test(text)) {
    return { type: "code", isLong };
  }

  return { type: "general", isLong };
}

/**
 * Create a short inline summary for long output.
 * @param {string} text - The full output text
 * @param {{ type: string }} classification - Output from classifyOutput
 * @param {{ diffs: string|null, diffSummary: string|null }} context
 * @returns {string} Summary text for inline display
 */
function createInlineSummary(text, classification, context) {
  const { type } = classification;
  const lines = (text || "").split("\n");

  switch (type) {
    case "diff":
      return context.diffSummary || "Files changed (see full diff)";

    case "build":
      return extractBuildSignal(lines);

    case "code":
      return lines.slice(0, 15).join("\n");

    case "general":
    default:
      return lines.slice(0, 20).join("\n");
  }
}

/**
 * Extract pass/fail signal from build/test output.
 */
function extractBuildSignal(lines) {
  const signalLines = [];
  const seen = new Set();

  for (const line of lines) {
    const trimmed = line.trim();
    if (seen.has(trimmed)) continue;

    // Match common test/build result patterns
    const isResult = /(\d+\s+(passed|failed|errors?|warnings?|skipped)|PASS|FAIL|✓|✗|Tests?:|Suites?:|BUILD\s+(SUCCESS|FAIL))/i.test(line);
    // Also capture failure messages (lines starting with common failure indicators)
    const isFailure = /^\s*(FAIL|ERROR|✗|×|✕)\s/i.test(line);

    if (isResult || isFailure) {
      signalLines.push(trimmed);
      seen.add(trimmed);
    }
  }

  if (signalLines.length === 0) {
    // Fallback: return last few lines which often contain summary
    return lines.slice(-5).join("\n");
  }

  return signalLines.join("\n");
}

module.exports = { classifyOutput, createInlineSummary };
