# Phase 10: Discord

**Stage:** Multi-Channel Foundation
**Depends on:** Phase 9 (Adapter Refactor)
**Done when:** Send a message in a Discord channel, get Claude Code's response back — including text, screenshots, and diffs.

## What You Build

A Discord adapter that plugs into the relay core from Phase 9.

Deliverables:
- Discord bot created via Developer Portal with MESSAGE_CONTENT intent enabled
- Discord adapter implementing the adapter interface: receives messages via discord.js, forwards to relay core, sends responses back
- Text responses delivered as Discord messages (with code blocks for diffs)
- Screenshot/diff images delivered as Discord message attachments
- Approval flow works: bot asks "Create PR?", user replies "approve" or "reject" (text-based, same as WhatsApp — buttons come in Phase 12)
- Progress updates delivered as message edits (single message updated as work progresses)
- Bot token configured via `.env` (`DISCORD_BOT_TOKEN`, `DISCORD_CHANNEL_ID`)

## Tasks

- [x] Build Discord adapter — bot connects, receives messages, forwards to relay core, sends responses + media
  - Plan: `docs/plans/2026-02-27-feat-discord-telegram-adapters-plan.md`
  - Ship: PR pending

## Notes

- discord.js is the standard Discord bot library for Node.js. Well-documented, stable.
- Discord messages have a 2000-char limit. For long responses, split into multiple messages or use code blocks (which render well in Discord).
- Discord allows multiple attachments per message (unlike WhatsApp's 1-per-message limit).
- MESSAGE_CONTENT privileged intent must be enabled in the Discord Developer Portal for the bot to read message content.
- For MVP, the bot listens in a single configured channel (`DISCORD_CHANNEL_ID`). Multi-channel/multi-server support is deferred.
- Progress updates via message editing: post one message, update it as progress callbacks arrive. Discord rate limits edits at ~30/min — sufficient for milestone updates.
- The bot should set a status/activity (e.g., "Listening for commands") so users know it's online.
- Can be worked in parallel with Phase 11 (Telegram) since they're independent adapters.
