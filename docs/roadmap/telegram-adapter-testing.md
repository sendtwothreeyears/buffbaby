# Telegram Adapter Testing

**Status:** Blocked — Telegram account signup currently banned
**Branch:** feat/adapter (PR #14)
**Depends on:** Telegram account access

## What's Done

- Telegram adapter fully implemented (`adapters/telegram.js`, 249 LOC)
- grammy dependency added
- server.js loads Telegram adapter when `TELEGRAM_BOT_TOKEN` is set
- `.env.example` updated with Telegram vars
- Code reviewed and cleaned up
- Discord adapter tested and working

## What's Needed

1. Get Telegram account access
2. DM @BotFather, send `/newbot`, get a token
3. Add `TELEGRAM_BOT_TOKEN=<token>` to `.env`
4. Restart relay, confirm `[TELEGRAM] Bot ready: @bot_name` in logs
5. Run through manual test checklist (see plan)

## Manual Test Checklist

- [ ] Bot connects via long polling
- [ ] `/start` returns welcome message
- [ ] Text DMs forwarded to VM
- [ ] Group messages silently dropped
- [ ] Non-text messages get "text only" reply
- [ ] Progress updates edit in place
- [ ] Screenshots delivered as photos
- [ ] Diffs rendered in `<pre>` blocks
- [ ] `/cancel` and `cancel` both work
- [ ] Approval flow works end-to-end

## References

- Plan: `docs/plans/2026-02-27-feat-telegram-adapter-plan.md`
- Phase doc: `docs/phases/11-phase-telegram.md`
- PR: #14
