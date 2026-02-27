# Phase 13: Multi-Agent

**Stage:** Polish & Extend
**Depends on:** Phase 12 (Channel Polish)
**Done when:** User sends "use codex" in any channel, next command runs on Codex CLI instead of Claude Code. "use gemini" switches to Gemini CLI. "use claude" switches back.

## What You Build

Multi-provider agent support. The VM server abstraction layer that treats Claude Code, Codex CLI, and Gemini CLI as interchangeable backends.

Deliverables:
- **Agent abstraction on VM:** `vm-server.js` uses a configurable CLI command instead of hardcoded `claude`. Each agent adapter handles: CLI invocation, output parsing, progress marker extraction, error detection.
- **Agent switching via message:** User sends "use codex" / "use gemini" / "use claude" on any channel. Relay stores the preference per-user. Subsequent commands use the selected agent.
- **Codex CLI adapter:** Spike Codex CLI headless mode. Build adapter that maps to the same VM server interface (`/command`, `/approve`, `/cancel`).
- **Gemini CLI adapter:** Spike Gemini CLI headless mode. Build adapter that maps to the same VM server interface.
- **Fallback:** If selected agent isn't installed or API key is missing, reply with a clear error: "Codex CLI not configured. Set OPENAI_API_KEY in your VM environment."

## Tasks

- [ ] Spike Codex CLI and Gemini CLI headless modes — document output format, progress markers, approval patterns, differences from Claude Code
  - Plan: `/workflow:plan multi-agent spike — characterize Codex and Gemini CLI headless output`
  - Ship: `/workflow:ship docs/plans/YYYY-MM-DD-feat-multi-agent-spike-plan.md`

- [ ] Build agent abstraction layer on VM + agent switching command on relay
  - Plan: `/workflow:plan multi-agent support — VM agent adapters, relay agent switching, per-user preference`
  - Ship: `/workflow:ship docs/plans/YYYY-MM-DD-feat-multi-agent-plan.md`

## Notes

- The spike is critical. Codex CLI and Gemini CLI headless modes may differ significantly from Claude Code's. Key questions: Do they support `--dangerously-skip-permissions` equivalent? Do they emit progress markers? Do they have approval flows? How do they handle `stdin` prompts?
- If an agent CLI doesn't support approval flows, the VM adapter should skip the approval step and auto-commit (with a warning to the user).
- Agent preference is stored in the relay's in-memory state (per-user). Lost on restart, which is acceptable — defaults to Claude Code.
- The VM Dockerfile needs to include all three CLIs. Codex requires `OPENAI_API_KEY`, Gemini requires `GOOGLE_API_KEY`. Both optional — only needed if the user wants to switch.
- Don't build this until Phase 12 is stable. Multi-agent adds complexity to the VM layer, and the channel adapters should be solid first.
- The spike task should be done first — its findings may change the architecture of the agent abstraction.
