# Phase 13: Multi-Agent

**Stage:** Scale and Polish
**Depends on:** Phase 11 (Beta), Phase 6 (progress streaming infrastructure)
**Done when:** You text a command that triggers a multi-agent workflow and receive individual agent progress updates ("Agent 3/6 complete: Gemini critical review done") followed by a consolidated summary.

## What You Build

Status updates for parallel agent workflows. When a user's Claude Code setup spawns multiple agents (e.g., a multi-agent code review or investigation), the relay parses the output and sends per-agent progress updates as separate SMS messages. A final consolidated summary is sent when all agents complete.

Deliverables:
- Documented understanding of Claude Code's headless multi-agent output format (from spike)
- Relay parses multi-agent output patterns from Claude Code
- Per-agent progress updates sent as individual SMS messages, prefixed with workflow name: `[review] Agent 2/6 done: Codex tactical review`
- Consolidated summary sent when all agents complete
- Review summary images (from user's workflow) sent via MMS
- **Message batching:** If multiple agents complete within seconds of each other, batch their updates into a single SMS to reduce noise and cost
- **Fallback:** If the relay cannot detect multi-agent patterns, fall back to forwarding raw output as regular SMS (Phase 3/6 behavior). Never silently swallow output.

## Tasks

- [ ] Spike: Investigate Claude Code's headless multi-agent output format — document patterns, define parsing strategy
  - Plan: `/workflow:plan multi-agent output format investigation — characterize claude --headless output with sub-agents`
  - Ship: `/workflow:ship docs/plans/YYYY-MM-DD-feat-multi-agent-spike-plan.md` (deliverable: documentation in `docs/`)

- [ ] Implement per-agent progress SMS parsing and delivery with message batching
  - Plan: `/workflow:plan multi-agent status parsing — detect agent boundaries, send per-agent SMS, batch rapid completions`
  - Ship: `/workflow:ship docs/plans/YYYY-MM-DD-feat-multi-agent-parsing-plan.md`

- [ ] Implement consolidated summary detection and review summary image delivery via MMS
  - Plan: `/workflow:plan multi-agent summary — detect completion, send consolidated text + review images via MMS`
  - Ship: `/workflow:ship docs/plans/YYYY-MM-DD-feat-multi-agent-summary-plan.md`

## Notes

- **This phase extends Phase 6's progress streaming infrastructure.** The relay's callback mechanism must support detecting sub-agent output boundaries, not just milestone messages.
- The biggest risk is Claude Code's output format. `claude --headless` output when spawning sub-agents is not formally documented. The spike task de-risks this. If the format is unreliable, consider having the user's CLAUDE.md/skills emit structured markers that the relay can parse deterministically.
- **Interactive reply commands** from the PRD (Flow 4: "fix" / "show more", Flow 5: "fix blockers") require the approval flow state machine from Phase 6 to recognize additional keywords in context. This is a relay-side change.
- Consider message volume: a 6-agent review could generate 12+ SMS messages. Balance granularity with noise. The batching deliverable addresses this.
- Can be worked in parallel with Phase 14 (CI/CD) since they touch different parts of the relay.
