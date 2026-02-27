# Phase 12: Channel Polish

**Stage:** Polish & Extend
**Depends on:** Phases 10, 11 (Discord + Telegram both working)
**Done when:** Approve a PR via Discord button tap. Use Telegram inline keyboard to reject. `/help` returns a command list on all three channels. `status` returns VM state. Message queuing works during active commands.

## What You Build

Channel-native UX enhancements and resilience features that make BuffBaby feel polished for daily use.

Deliverables:
- **Discord:** Approve/reject as button components (not text). Status updates as rich embeds (colored sidebar, fields). Bot slash command registration (`/status`, `/help`, `/cancel`).
- **Telegram:** Approve/reject as inline keyboard buttons. `/help` and `/status` in the bot commands menu (visible in Telegram UI).
- **WhatsApp:** No changes needed — text-based approve/reject already works.
- **All channels:** `/help` command returns available actions and example workflows. `status` command returns current VM state (idle/working, last command, git status). Message queuing during active work (queue incoming messages instead of dropping them, process after current task completes).
- **Error recovery:** VM health check every 30s. If VM unreachable, notify user: "VM appears to be down." Thrashing detection: 3+ similar errors → offer fresh agent or cancel.

## Tasks

- [ ] Add Discord buttons, embeds, and slash commands for approve/reject/status/help
  - Plan: `/workflow:plan Discord channel-native UX — button components, rich embeds, slash commands`
  - Ship: `/workflow:ship docs/plans/YYYY-MM-DD-feat-discord-native-ux-plan.md`

- [ ] Add Telegram inline keyboards and bot commands for approve/reject/status/help
  - Plan: `/workflow:plan Telegram channel-native UX — inline keyboards, bot commands menu`
  - Ship: `/workflow:ship docs/plans/YYYY-MM-DD-feat-telegram-native-ux-plan.md`

- [ ] Add cross-channel resilience: /help, status, message queuing, VM health monitoring, thrashing detection
  - Plan: `/workflow:plan relay resilience — help command, status, message queuing, health checks, thrashing detection`
  - Ship: `/workflow:ship docs/plans/YYYY-MM-DD-feat-relay-resilience-plan.md`

## Notes

- Discord buttons use the Interaction API — the bot posts a message with button components, user clicks, bot receives an interaction event. Different from message-based flow.
- Discord slash commands require registration via the API. They appear in Discord's UI with autocomplete. Register: `/status`, `/help`, `/cancel`. Regular messages still work for commands to Claude Code.
- Telegram inline keyboards attach to a message. User taps a button, bot receives a callback query. Acknowledge with `answerCallbackQuery` to dismiss the loading spinner.
- Telegram bot commands menu: set via `setMyCommands` API. Appears when user types `/` in the chat.
- Message queuing replaces the current "Still working..." rejection. Queue up to 5 messages, process FIFO after current task completes. Reply with position: "Queued (1 ahead of you)."
- Thrashing detection is simple heuristics: count similar error strings in Claude Code output within a 5-minute window. No ML, no AI — just pattern matching.
- The three tasks can be worked in parallel (Discord UX, Telegram UX, and cross-channel resilience touch different parts of the codebase).
