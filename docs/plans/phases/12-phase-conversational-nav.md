# Phase 12: Conversational Navigation

**Stage:** Scale and Polish
**Depends on:** Phase 11 (Beta — validated that basic flow works with real users)
**Done when:** You text "show me the login page", get a screenshot. Text "click the submit button", get an updated screenshot. Three-step chain works: navigate → interact → navigate to a different page referencing prior state.

## What You Build

Validate and optimize conversational page navigation via Playwright MCP through the messaging bridge. The engineer texts natural language navigation commands ("show me the settings page", "click the login button"). Claude Code drives Playwright MCP to navigate, interact, and capture screenshots. The relay sends the updated screenshots back via WhatsApp.

This is primarily a user-side capability — Claude Code + Playwright MCP already support this. The phase validates it works smoothly through the messaging bridge, profiles latency, and makes any relay-side adjustments needed.

Deliverables:
- Validated conversational navigation flow through WhatsApp (single-step and multi-step chains)
- Latency profiled and optimized: navigation + screenshot + WhatsApp delivery < 10 seconds for 90% of requests
- Any relay-side adjustments needed (e.g., context preservation, faster image delivery)
- Error handling: when Playwright can't find the requested element, Claude Code returns a helpful error + current page screenshot
- Viewport switching: "show desktop" / "show mobile" recognized as context for the next screenshot

## Tasks

- [ ] Validate and optimize conversational navigation through messaging bridge — latency profiling, multi-step chains, error handling
  - Plan: `/workflow:plan conversational navigation validation — latency benchmarks, multi-step context, error states`
  - Ship: `/workflow:ship docs/plans/YYYY-MM-DD-feat-conversational-nav-plan.md`

## Notes

- This capability is mostly provided by Claude Code + Playwright MCP. The platform work is ensuring the messaging bridge handles it smoothly.
- Key concern: latency. Navigation + screenshot + WhatsApp delivery should be < 10 seconds total. Profile and optimize if needed. If the Playwright browser needs warming up, keep it running.
- The relay should preserve conversation context so Claude Code knows "click the submit button" refers to the page it just showed.
- Default to mobile viewport (390px) for navigation screenshots since the user is on their phone. "show desktop" switches to 1440px.
- **Multi-step context test:** PRD Flow 6 shows "show me the settings page" → "click the dark mode toggle" → "now show me the login page in dark mode." The third step requires both navigation context AND application state to be preserved.
- If this all works out-of-the-box through the existing bridge, this phase may complete in 1-2 days. Budget additional time only if latency optimization or relay-side context preservation is needed.
