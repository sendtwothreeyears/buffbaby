# Phase 13: Multi-Agent

**Stage:** Scale and Polish
**Depends on:** Phase 11 (Beta), Phase 6 (progress streaming infrastructure)
**Done when:** You text a command that triggers a multi-agent workflow and receive individual agent progress updates ("Agent 3/6 complete: Gemini critical review done") followed by a consolidated summary.

## What You Build

Status updates for parallel agent workflows. When a user's Claude Code setup spawns multiple agents (e.g., a multi-agent code review or investigation), the relay parses the output and sends per-agent progress updates as separate messages. A final consolidated summary is sent when all agents complete.

Deliverables:
- Documented understanding of Claude Code's headless multi-agent output format (from spike)
- Relay parses multi-agent output patterns from Claude Code
- Per-agent progress updates sent as individual messages, prefixed with workflow name: `[review] Agent 2/6 done: Codex tactical review`
- Consolidated summary sent when all agents complete
- Review summary images (from user's workflow) sent via WhatsApp media
- **Message batching:** If multiple agents complete within seconds of each other, batch their updates into a single message to reduce noise and cost
- **Fallback:** If the relay cannot detect multi-agent patterns, fall back to forwarding raw output as regular WhatsApp messages (Phase 3/6 behavior). Never silently swallow output.

## Tasks

- [ ] Spike: Investigate Claude Code's headless multi-agent output format — document patterns, define parsing strategy
  - Plan: `/workflow:plan multi-agent output format investigation — characterize claude --headless output with sub-agents`
  - Ship: `/workflow:ship docs/plans/YYYY-MM-DD-feat-multi-agent-spike-plan.md` (deliverable: documentation in `docs/`)

- [ ] Implement per-agent progress message parsing and delivery with message batching
  - Plan: `/workflow:plan multi-agent status parsing — detect agent boundaries, send per-agent WhatsApp messages, batch rapid completions`
  - Ship: `/workflow:ship docs/plans/YYYY-MM-DD-feat-multi-agent-parsing-plan.md`

- [ ] Implement consolidated summary detection and review summary image delivery via WhatsApp media
  - Plan: `/workflow:plan multi-agent summary — detect completion, send consolidated text + review images via WhatsApp media`
  - Ship: `/workflow:ship docs/plans/YYYY-MM-DD-feat-multi-agent-summary-plan.md`

## Notes

- **This phase extends Phase 6's progress streaming infrastructure.** The relay's callback mechanism must support detecting sub-agent output boundaries, not just milestone messages.
- The biggest risk is Claude Code's output format. `claude --headless` output when spawning sub-agents is not formally documented. The spike task de-risks this. If the format is unreliable, consider having the user's CLAUDE.md/skills emit structured markers that the relay can parse deterministically.
- **Interactive reply commands** from the PRD (Flow 4: "fix" / "show more", Flow 5: "fix blockers") require the approval flow state machine from Phase 6 to recognize additional keywords in context. This is a relay-side change.
- Consider message volume: a 6-agent review could generate 12+ messages. Balance granularity with noise. The batching deliverable addresses this.
- **WhatsApp formatting advantage:** Use monospace blocks (triple-backtick) for per-agent status, making multi-agent output easier to scan than plain text.
- Can be worked in parallel with Phase 14 (CI/CD) since they touch different parts of the relay.
