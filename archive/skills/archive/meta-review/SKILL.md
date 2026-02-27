---
name: archive:meta-review
description: "Meta Review: Consolidate Multi-Agent Code Review Feedback"
disable-model-invocation: true
---

# Meta Review: Consolidate Multi-Agent Code Review Feedback

You have received code review feedback from multiple agents. Your task is to synthesize this feedback into a single, actionable analysis and create a parallelized fix plan.

## Input

The user will provide code review outputs from multiple agents (e.g., Claude Opus, Codex, other reviewers). These reviews may have overlapping findings, conflicting opinions, or varying levels of detail.

## Process

### Step 1: Extract & Deduplicate

- Read through all provided reviews
- Identify every unique issue mentioned
- Merge duplicates (same issue found by multiple reviewers)
- Note when multiple reviewers flag the same issue (stronger signal)

### Step 2: Categorize & Prioritize

Organize all issues into a **single continuously-numbered list** with three sections:

**MUST FIX**
- Security vulnerabilities
- Bugs that will cause runtime errors
- Data corruption or loss risks
- Breaking changes to public APIs
- Critical performance issues

**SUGGESTED FIX**
- Code quality improvements
- Performance optimizations (non-critical)
- Better error handling
- Improved type safety
- Maintainability concerns
- Missing tests for important logic

**DON'T WORRY ABOUT**
- Style nitpicks already covered by linters
- Subjective preferences
- False positives after investigation
- Acceptable tradeoffs given context
- Over-engineering suggestions

### Step 3: Validate & Research

For each issue in MUST FIX and SUGGESTED FIX:

1. **Investigate the actual code** — Read the relevant files to confirm the issue exists
2. **Assess validity** — Is this a real problem or a false positive?
3. **Understand context** — Are there reasons the code is written this way?

If an issue is invalid after investigation, move it to DON'T WORRY ABOUT with an explanation.

### Step 4: Recommend Actions

For each validated issue, provide:

1. **Possible approaches** — List different ways to address it (if multiple exist)
2. **Recommended action** — State which approach you recommend and why

**IMPORTANT:** Never provide time estimates. Focus on what needs to be done, not how long it takes.

### Step 5: Parallelization Plan

After completing the analysis, create a plan for parallelized fixes using the Task tool with `subagent_type: "general-purpose"`.

**Guiding Principles:**

1. **Conservative dependency grouping** — If there's ANY chance that fixing one issue could affect another (same file, related modules, shared state), assign them to the SAME agent. Err heavily on the side of caution here.

2. **Parallelize only straightforward fixes** — Simple, isolated, low-risk changes are ideal for parallel agents:
   - Adding missing null checks in independent files
   - Fixing typos or improving error messages
   - Adding missing type annotations
   - Independent refactors with clear scope

3. **Keep complex work in main thread** — The following should NOT be parallelized:
   - Issues requiring architectural decisions
   - Fixes with unclear scope or multiple valid approaches
   - Changes that touch shared utilities or core modules
   - Anything the user should watch progress on
   - Issues where you're uncertain about the right solution

4. **Create up to 10 buckets** — Group issues into a maximum of 10 agent assignments. It's perfectly fine to have fewer buckets if that's what makes sense.

5. **Main thread is valuable** — Having 1-2 complex issues handled in the main conversation (not delegated) gives the user visibility and control. This is a feature, not a limitation.

## Output Format

```
## Meta Review Summary

**Reviews Analyzed:** [number] agents
**Total Unique Issues:** [number]
- Must Fix: [count]
- Suggested Fix: [count]
- Don't Worry About: [count]

---

## MUST FIX

### 1. [Issue Title]
**Found by:** [Agent name(s)]
**Location:** `path/to/file.ts:line`
**Problem:** [Description]
**Validated:** Yes/No — [brief explanation]

**Possible Actions:**
- A) [First approach]
- B) [Second approach]

**Recommendation:** [A/B] — [Why this approach]

---

### 2. [Next issue...]

---

## SUGGESTED FIX

### 3. [Continues numbering...]

---

## DON'T WORRY ABOUT

### 7. [Issue Title]
**Found by:** [Agent name(s)]
**Reason to skip:** [Why this is not worth fixing]

---

## Parallelization Plan

### Main Thread (Handle Here)
These issues require careful attention or user visibility:
- **Issue #X:** [Brief reason to handle here]
- **Issue #Y:** [Brief reason]

### Parallel Agent Buckets

**Bucket 1:** Issues #A, #B
- Focus: [Brief description]
- Why grouped: [Dependency or thematic reason]

**Bucket 2:** Issue #C
- Focus: [Brief description]
- Why isolated: [No dependencies, straightforward fix]

[...up to 10 buckets...]

### Dependency Notes
[Explain any non-obvious grouping decisions or why certain issues must be sequential]

---

## Ready to Execute?

When you're ready, I'll:
1. Handle main thread issues first (so you can watch)
2. Launch parallel agents for the buckets above
3. Monitor and report results

Confirm which issues to proceed with, or adjust the plan as needed.
```

## Notes

- If reviewers disagree on severity, investigate and make your own judgment
- Issues flagged by multiple reviewers deserve extra attention
- Consider the project's context (startup vs enterprise, MVP vs mature product)
- Be practical — not every suggestion is worth implementing
- When in doubt about dependencies, group issues together rather than risk conflicts

---

**Ready to analyze.** Please paste the code review outputs from your agents.
