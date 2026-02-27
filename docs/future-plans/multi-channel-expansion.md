# Future Plan: Multi-Channel Expansion (Telegram + Discord)

**Created:** 2026-02-27
**Status:** Deferred — MVP is WhatsApp-only. Add channels after core flow is proven.
**Depends on:** MVP deployed and working end-to-end on WhatsApp

## Why

WhatsApp is the broadest-reach channel (2B+ users, zero install friction), but Telegram and Discord are arguably **better** for developer-focused users:

- **No phone number needed for bots.** Telegram bots are created via @BotFather, Discord bots via Developer Portal. No WhatsApp Business API approval, no Twilio fees.
- **Free transport.** Both Telegram Bot API and Discord Bot API are completely free. WhatsApp costs $0.005-0.08 per conversation via Twilio/Meta.
- **Richer UI.** Telegram has inline keyboards, custom buttons, file uploads, and albums (multiple images in one message). Discord has slash commands, buttons, dropdown menus, embeds, threads, and voice channels.
- **Higher message limits.** Discord embeds bypass the 2000-char limit. Telegram supports 4096 chars plus albums for grouping images.
- **Developer audience.** Many engineers already live in Telegram and Discord. These channels meet them where they are — same thesis as WhatsApp, different audience.

## What

Add Telegram and Discord as transport channels alongside WhatsApp. Same relay server, same VM, different inbound/outbound adapters.

### Channel Comparison

| | WhatsApp | Telegram | Discord |
|---|---|---|---|
| **Bot setup** | Phone number + Business API | @BotFather (instant) | Developer Portal (instant) |
| **User friction** | Zero (already installed) | Must install Telegram + find bot | Must install Discord + join server |
| **Rich formatting** | Basic (monospace, bold, italic) | Markdown, inline keyboards, buttons, file uploads | Full markdown, embeds, threads, reactions, buttons |
| **Message limits** | 4096 chars, 1 media/msg | 4096 chars, albums (multi-image) | 2000 chars (embeds bypass), multi-attachment |
| **Bot capabilities** | Text in, text/media out. No buttons. | Inline keyboards, commands menu, reply markup | Slash commands, buttons, dropdowns, threads |
| **Transport cost** | Twilio/Meta fees per conversation | Free | Free |
| **Audience** | Everyone (2B+) | Tech-savvy, developers | Developers, gamers, communities |
| **Phone number needed?** | Yes (both sides) | User: yes. Bot: no. | Neither side |

### Architecture

The relay server's transport layer is thin (~50-100 lines per channel). Adding a channel means:

1. **New webhook handler** — receives messages from Telegram/Discord API
2. **New send adapter** — formats and sends responses via Telegram/Discord API
3. **Channel-agnostic core** — the routing, VM forwarding, image proxy, and state machine remain unchanged

```
                  WhatsApp (Twilio)  ──┐
                  Telegram Bot API  ───┼──→  Relay Core  ──→  User's VM
                  Discord Bot API   ──┘     (unchanged)
```

### Channel-Specific UX Improvements

**Telegram:**
- Inline keyboard buttons for approve/reject (instead of typing "approve")
- Bot commands menu (`/clone`, `/status`, `/diff`) visible in Telegram UI
- Image albums — send multiple diff images as a single grouped message
- File uploads — send raw diff files for large changes

**Discord:**
- Slash commands with autocomplete (`/clone repo:my-app branch:main`)
- Button components for approve/reject/show-more
- Embed messages for status updates (colored sidebar, fields, thumbnails)
- Thread per session — keep different projects in separate threads
- Voice channel potential (future: voice commands via Discord voice)

## Why Not Now

1. **MVP first.** WhatsApp proves the core thesis — phone-to-cloud-VM agentic development works. Adding channels before the core flow is solid is premature.
2. **Transport is the easy part.** The hard problems are VM management, Claude Code headless reliability, image pipelines, approval flows. Channels are a ~50-100 line adapter each.
3. **Avoids scope creep.** One channel, one user, one VM — validate this before scaling horizontally.

## Key Decisions

### 1. One relay, multiple channels vs. separate relays per channel
- **Recommendation:** One relay, adapter pattern. Channel handlers normalize messages into a common format, relay core processes them identically.
- **Tradeoff:** Slightly more complex relay, but avoids duplicating routing/state logic.

### 2. Channel per project vs. channel per user
- **WhatsApp:** One thread = all projects (P2 is multi-project via group chats)
- **Telegram:** Could use separate bot conversations per project, or one conversation with project prefixes
- **Discord:** Natural fit for one server with channel-per-project

### 3. Feature parity vs. channel-native UX
- **Option A:** Same features everywhere, lowest-common-denominator UI
- **Option B:** Channel-native UX (Telegram buttons, Discord embeds) with feature parity
- **Recommendation:** Option B. Each channel should feel native, not like a port.

### 4. User identity across channels
- Same user might use WhatsApp from phone and Discord from desktop. Need a unified identity (likely GitHub account as the anchor) that works across channels.

## When to Revisit

- MVP is deployed and working on WhatsApp
- At least 5 users have completed real development sessions via WhatsApp
- User feedback indicates demand for Telegram or Discord
- Core relay architecture is stable (no major rewrites planned)

## Research Sources

- [Telegram Bot API documentation](https://core.telegram.org/bots/api)
- [Discord Developer Portal](https://discord.com/developers/docs)
- [Meta WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api)
- NanoClaw — uses WhatsApp (Baileys), extensible to Telegram via skills
- OpenClaw — supports WhatsApp, Telegram, Discord, Slack, iMessage out of the box
- PRD competitive analysis: [docs/competitive-analysis.md](../competitive-analysis.md)
