# Phase 11: Telegram

**Stage:** Multi-Channel Foundation
**Depends on:** Phase 9 (Adapter Refactor)
**Done when:** Send a message to the Telegram bot, get Claude Code's response back — including text, screenshots, and diffs.

## What You Build

A Telegram adapter that plugs into the relay core from Phase 9.

Deliverables:
- Telegram bot created via @BotFather
- Telegram adapter implementing the adapter interface: receives messages via Telegram Bot API, forwards to relay core, sends responses back
- Text responses delivered as Telegram messages (with monospace blocks for diffs)
- Screenshot/diff images delivered as Telegram photos
- Approval flow works: bot asks "Create PR?", user replies "approve" or "reject" (text-based — inline keyboards come in Phase 12)
- Progress updates delivered as message edits (single message updated as work progresses)
- Bot token configured via `.env` (`TELEGRAM_BOT_TOKEN`)

## Tasks

- [x] Build Telegram adapter — bot connects, receives messages, forwards to relay core, sends responses + media
  - Plan: `/workflow:plan Telegram adapter — Bot API, message handling, photo delivery, progress updates via message edits`
  - Ship: `/workflow:ship docs/plans/YYYY-MM-DD-feat-telegram-adapter-plan.md`

## Notes

- Library choice: `grammy` (modern, TypeScript-first, well-maintained) or `node-telegram-bot-api` (simpler, more established). Decide during planning.
- Telegram Bot API is completely free — no per-message costs, no phone number needed.
- Telegram supports 4096-char messages — more generous than Discord (2000) and WhatsApp sandbox (1600).
- Telegram supports photo albums (multiple images in one grouped message) — better than WhatsApp's 1-per-message. Use this for multi-file diffs.
- Progress updates via `editMessageText`: update a single message as work progresses. Rate limit ~20/min — sufficient for milestones.
- Bot created via @BotFather — instant, no approval process.
- For MVP, the bot responds to direct messages only (1:1 chat). Group support deferred.
- Can be worked in parallel with Phase 10 (Discord) since they're independent adapters.
