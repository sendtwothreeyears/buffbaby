---
name: utilities:meta-learn
description: "Analyze conversation history to identify patterns, friction points, and opportunities for improvement"
argument-hint: "[optional: timeframe like '2 weeks' or '1 month']"
disable-model-invocation: true
---

# Meta-Learn

Analyze conversation history to identify patterns, friction points, and opportunities for improvement. Creates actionable recommendations for slash commands, CLAUDE.md updates, and process improvements.

**Usage:** `/utilities:meta-learn [optional: timeframe like "2 weeks" or "1 month"]`

**Default:** 2 weeks of conversation history

---

## Process

### Step 0: Project Selection

**Ask the user which project(s) to analyze:**

```
Which project(s) should I analyze?

1. [List available projects from ~/.claude/projects/]
2. All projects
3. Specific project path

Also, what timeframe? (default: 2 weeks)
```

Check for previous meta-learn runs:
```bash
ls -la notes/meta-learning-session-summary-*.md 2>/dev/null | tail -1
```

If found, note: "Last meta-learn was run on [date]. Analyzing conversations since then may be sufficient."

### Step 1: Extract Conversation History

Claude Code stores conversations in `~/.claude/projects/` as `.jsonl` files organized by project path.

```bash
# Find all conversation files from the timeframe
find ~/.claude/projects -name "*.jsonl" -mtime -14 -type f
```

Filter to only the user's selected project(s):

```bash
# Extract user messages from .jsonl files
# Each line is a JSON object; filter for user role messages
```

### Step 2: Parallel Analysis (6 Agents)

Spawn 6 agents simultaneously, each analyzing the full dataset through a different lens:

| Agent | Focus Area | Output File |
|-------|------------|-------------|
| 1 | Slash Command Opportunities | /tmp/analysis_slash_commands.md |
| 2 | Friction Patterns | /tmp/analysis_friction.md |
| 3 | CLAUDE.md Knowledge Gaps | /tmp/analysis_knowledge_gaps.md |
| 4 | Successful Patterns | /tmp/analysis_successes.md |
| 5 | Tool Usage Patterns | /tmp/analysis_tools.md |
| 6 | Workflow Patterns | /tmp/analysis_workflows.md |

**Agent Prompt Template:**
```
You are analyzing {count} user prompts from Claude Code conversations.

Your focus: {focus_area}

Look for:
- {specific_patterns_for_this_lens}

Output a numbered list of findings with:
- The pattern observed
- Frequency/importance
- Concrete recommendation

Be specific and actionable. Cite example prompts when relevant.
```

### Step 3: Synthesis

Combine all 6 analysis files into a single consolidated document:

1. Read all agent outputs
2. Merge overlapping findings
3. Organize into categories:
   - Part 1: Slash Commands to Create
   - Part 2: CLAUDE.md Improvements
   - Part 3: Process Improvements
   - Part 4: Expert-Level Feedback
4. Number all items continuously (1-N)
5. Save to `notes/meta-learning-analysis-[YYYYMMDD].md`

### Step 4: Interactive Review

Present findings to user section by section:

```
═══════════════════════════════════════════════════════════════
PART 1: SLASH COMMANDS (Items 1-12)
═══════════════════════════════════════════════════════════════

1. **[Command Name]**
   Pattern: [What was observed]
   Frequency: [How often]
   Recommendation: [What to create]

2. ...

Which items should we implement? (e.g., "1, 3, 5" or "all" or "skip")
```

### Step 5: Implementation

For each approved item:
1. Create/update the relevant file
2. Confirm with user before moving to next category
3. Track what was done

### Step 6: Summary

Create a session summary at `notes/meta-learning-session-summary-[YYYYMMDD].md`:

- What we did (phases)
- Artifacts created (files, commands)
- Key insights discovered
- Items intentionally skipped
- Process learnings

---

## Analysis Lenses Explained

### 1. Slash Command Opportunities
Look for:
- Repeated multi-step tasks ("commit, push, open PR" pattern)
- Frequent tool combinations
- Tasks that could be automated
- Phrases like "every time I..." or "I always have to..."

### 2. Friction Patterns
Look for:
- Confusion or clarification requests
- Retries after failures
- "Wait, that's not what I meant"
- Environment/configuration issues
- Debugging rabbit holes

### 3. CLAUDE.md Knowledge Gaps
Look for:
- Questions answered that should be documented
- Repeated explanations of the same concept
- Project-specific conventions that trip up agents
- "How does X work in this codebase?"

### 4. Successful Patterns
Look for:
- Tasks that went smoothly
- Effective prompt patterns
- Good agent collaboration
- Workflows worth preserving/documenting

### 5. Tool Usage Patterns
Look for:
- Underutilized tools (MCPs, features)
- Overreliance on certain tools
- Tool misuse or inefficiency
- Missing integrations

### 6. Workflow Patterns
Look for:
- Cross-session patterns
- Ticket lifecycle patterns
- Review/testing workflows
- Collaboration patterns

---

## Notes

- 2 weeks is usually sufficient signal; longer may dilute recent patterns
- Exclude unrelated projects to improve focus
- The 6-lens framework provides good coverage without redundancy
- User-in-the-loop review prevents implementing unhelpful suggestions
- Consider running quarterly to maintain improvement momentum

---

Now extract conversation history and begin analysis.
