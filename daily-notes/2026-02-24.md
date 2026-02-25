# 2026-02-24

## Notes

- Explored and developed PRD for **"iMessage Agentic Development Cockpit"** — a fully cloud-hosted service that lets engineers run agentic workflows (Claude Code, Codex, Gemini) entirely via iMessage from their phone. No laptop, no app, no hardware required.

### Key decisions made
- iMessage is the PRIMARY interface, not a stepping stone to a native app
- Diffs are sent as syntax-highlighted PNG images (pinch-to-zoom), not web pages
- App previews are sent as screenshots via Puppeteer/Playwright on the VM, not browser links
- Approvals are simple text replies ("approve", "reject"), not buttons
- Conversational app interaction: "show me the settings page" → server navigates headless browser → sends screenshot
- Fully cloud-hosted: Cloud Mac relay (Mac Stadium/AWS EC2 Mac) + on-demand cloud VMs (Railway/Fly.io)
- User provides only: iPhone + internet + GitHub account + API keys (BYOK)
- Estimated beta launch cost: $700-1,400 for 10 users

### Competitive research
- Nobody has built this. Claude-Code-Remote does Telegram/Discord but not iMessage. Kibbler/Moshi are native apps. Replit targets non-technical users. This is genuinely novel.

### Open questions
- Apple ToS for automated iMessage at scale
- Claude Code headless reliability
- Cloud Mac capacity per concurrent user
- Apple Messages for Business as alternative path

### Artifacts
- PRD saved at: `PRD_MOBILE_AGENTIC_COCKPIT.md`
