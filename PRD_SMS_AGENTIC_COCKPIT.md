# PRD: SMS Agentic Development Cockpit

**Author:** Emmanuel
**Date:** 2026-02-24
**Status:** Draft
**Last Updated:** 2026-02-24
**Model:** Fully cloud-hosted service — users need only a phone and internet connection

---

## Problem Statement

_Software engineers using agentic workflows (Claude Code, Codex CLI, Gemini CLI) are tethered to their laptops. The entire agentic development lifecycle — commanding agents, reviewing diffs, previewing apps, triggering deployments — requires a desktop terminal and IDE. There is no way to orchestrate these workflows from a phone, despite the fact that the engineer's role in an agentic workflow is fundamentally about directing, reviewing, and approving — tasks that don't require a full desktop environment._

_SMS is the one universal interface that exists on every phone ever made — iPhone, Android, flip phones. No app to download. No account to create. No onboarding friction. The engineer texts a phone number and the entire agentic development workflow is at their fingertips: status updates as text, code diffs as images, app previews as screenshots, approvals as simple text replies. The conversation thread becomes the project log._

**Who** is affected:
Software engineers who already use agentic development workflows (Claude Code slash commands, multi-agent reviews, compound engineering patterns). Specifically, engineers in bootcamps, startups, and teams who want to stay productive from anywhere — commutes, couches, coffee shops — without carrying a laptop. They need only a phone and a cell signal. No laptop, no Mac, no personal server, no hardware of any kind. iPhone or Android — it doesn't matter.

**What** they struggle with:
- Agentic workflows are locked to the terminal. You can't run `/ship`, `/team_three_review`, or `/investigate` from your phone.
- No way to see live app previews, code diffs, or deployment status on mobile.
- Existing mobile dev tools (Replit, Codespaces) are either non-technical (targeting beginners) or have terrible mobile UX (desktop IDE crammed into a phone browser).
- Engineers who know these workflows have no mobile-native way to leverage them.
- Every "solution" requires downloading another app. Engineers don't want another app — they want the tools to meet them where they already are.

**Why now** (urgency/opportunity):
- Claude Code Remote Control just launched (Feb 2026) — proves the concept of phone-to-CLI is viable, but it's barebones (chat only, requires laptop to stay on).
- Third-party tools (Kibbler, Moshi) are emerging but fragmented — voice here, diffs there, no unified experience. All require installing new apps.
- Agentic workflows have matured (multi-agent orchestration, 11+ slash commands, phase-based workflows) but remain desktop-only.
- OpenClaw proves multi-channel AI assistants work (WhatsApp, Telegram, Discord, Slack) but targets general-purpose automation, not engineering workflows — and still requires third-party app installation.
- The gap is clear: no tool puts agentic workflow orchestration inside the one interface that requires zero installation — SMS.

**Evidence** (data, quotes, research):
- Replit Mobile hit #1 on the App Store (Developer Tools) — demand for mobile dev is real.
- Rahul Pandita's experiment (Jan 2026): 70% of feature dev work done from a phone over 3 weeks, but identified gaps in touch-first design, code review UX, and agent orchestration visibility.
- Claude Code Remote Control, Kibbler, Moshi, OpenClaw, Claude-Code-Remote (Telegram/Discord) all emerged within months of each other — the ecosystem is racing to solve this.
- No existing tool targets engineers who already know agentic workflows. Every tool either targets beginners (Replit, Lovable) or is a raw terminal (SSH + tmux).
- Every competitor requires downloading an app or creating an account on a third-party platform. SMS requires nothing — it comes pre-installed on every phone.

---

## Core Differentiator: Zero-Install, Universal Access

Every competing product requires the user to download an app or create an account on a third-party platform:

| Product | Requires |
|---------|----------|
| Kibbler | Download an iOS app |
| Moshi | Download an iOS app |
| Replit Mobile | Download an app (iOS/Android) |
| v0 iOS | Download an iOS app |
| OpenClaw | WhatsApp, Telegram, Discord, or Slack account + app |
| Claude Code Remote | Browser tab open on laptop |
| Claude-Code-Remote | Telegram or Discord account + app |

**This product requires: nothing.** Every phone on earth already has an SMS app. iPhone, Android, even a flip phone. No download, no account creation, no onboarding friction. The activation energy is "send a text."

This is not just a transport choice — it's the core product thesis. SMS is the one universal messaging channel that comes pre-installed on every phone ever manufactured.

---

## Goals & Success Metrics

| Goal | Metric | Target |
|------|--------|--------|
| Engineers can run agentic workflows via SMS | % of slash commands executable via SMS | 100% of existing commands |
| Reduce time-to-action on agent output | Time from agent completion to engineer review/approval | < 60 seconds (SMS notification is instant) |
| App preview is visible without leaving Messages | Engineer receives app screenshots (mobile + desktop viewport) via MMS | Screenshots delivered within 10 seconds of code change |
| Code review is viable on a phone | Engineer can review syntax-highlighted diff images via MMS and reply to approve/reject | Diff images are readable when zoomed, cover all changed files |
| Engineers adopt SMS as a real workflow surface | % of agentic sessions initiated via SMS (among active users) | 40%+ within 3 months |
| Conversation thread serves as project log | Engineers can scroll back through Messages to see full session history | All commands, responses, and images preserved in thread |
| Cross-platform from day one | Works on both iPhone and Android | 100% feature parity across platforms |
| Zero-app experience | Engineer never needs to leave their Messages app during a workflow | 95%+ of interactions are text replies or image review within the thread |

**Anti-goals** (what we are NOT optimizing for):
- We are NOT building a native app. SMS/MMS is the entire user-facing interface. Diffs are images. Previews are screenshots. Approvals are text replies. (A minimal onboarding website exists only for one-time signup — users never return to it.)
- We are NOT building a mobile IDE or code editor. The agent writes code; the engineer directs and reviews.
- We are NOT targeting non-technical users. This is for engineers who already understand agentic workflows, git, and deployment.
- We are NOT replacing the desktop experience. SMS is a complementary surface for when you're away from your laptop.
- We are NOT building our own AI model or agent. We orchestrate Claude Code (and optionally Codex CLI, Gemini CLI).
- We are NOT building voice call support in V1. Input is text (typed or dictated via the phone's native keyboard dictation).
- We are NOT requiring the engineer to open a browser, download an app, or leave their Messages thread. Everything happens in SMS/MMS.

---

## Target Users

**Primary user:**
- Description: Software engineers (bootcamp students, junior-to-senior devs) who actively use Claude Code and agentic workflows in their development process. They understand slash commands, multi-agent reviews, git workflows, and deployment pipelines. They have a phone — iPhone or Android.
- Key needs: Run `/ship`, `/team_three_review`, `/investigate` and other agentic commands from their phone. See live preview of the app. Review diffs. Approve deployments. Stay productive without a laptop — all without installing a new app or owning any hardware beyond their phone.
- Current workaround: SSH into a remote machine via Blink Shell or Termux, run Claude Code in tmux. Or use Claude Code Remote Control (basic, requires laptop running). All workarounds require owning and maintaining additional hardware. Clunky, no rich UI, no live preview, no contextual notifications.

**Secondary user:**
- Description: Engineering team leads who want visibility into agent activity across a team's projects — what's being built, reviewed, deployed — from their phone.
- Key needs: Monitor multiple agent sessions, review PRs created by agents, approve deployments. Could participate via group SMS threads tied to projects.

---

## Scope

### In Scope (Requirements)

**P0 — Must have (launch blockers):**
- [ ] Twilio SMS/MMS integration: service owns a Twilio phone number. Engineer texts this number. Twilio webhooks route to the relay server. Responses sent back via Twilio API.
- [ ] Docker image for VM environment: a single Docker image containing Claude Code CLI, Playwright MCP, Node.js, git, and Chromium. This image runs identically on a developer's Mac (local) and on Fly.io (production). Build once, run anywhere — no environment differences between local and production.
- [ ] Thin relay server: lightweight Node.js server that receives Twilio webhooks, authenticates the user by phone number, forwards commands to Claude Code on the user's VM (or local Docker container), and sends responses back via Twilio SMS/MMS. This is the only custom code — Claude Code does all the real work.
- [ ] Local development mode: relay server + Docker container run on the developer's Mac. ngrok exposes the relay to Twilio webhooks. Hardcoded config (phone number, API keys, GitHub token in `.env` file). Same code, same behavior as production — only the host changes. Cost: ~$3-5/month (Twilio only).
- [ ] Always-on cloud VM per user (production): Fly.io Machines running the Docker image, one per user, always on — no cold starts, no hibernation. Engineer texts, gets an immediate response.
- [ ] Automated VM provisioning (production): when a new user signs up, the onboarding backend calls the Fly.io Machines API to create a new VM from the Docker image, passing the user's encrypted credentials as environment variables. No manual setup per user.
- [ ] Text command input: engineer sends SMS messages (including slash commands like `/ship`, `/investigate`, `/compushar`) to control Claude Code on their VM.
- [ ] Dictation support: engineer uses their phone's native keyboard dictation (iOS/Android built-in) to speak commands. By the time the SMS reaches the service, it's already text. No voice infrastructure needed on our end.
- [ ] Agent output as text messages: Claude Code responses sent as SMS replies — concise status updates, phase progress, and plain-text summaries.
- [ ] Diff images via MMS: server renders syntax-highlighted diffs as PNG images and sends them as MMS photos (one image per file, pinch-to-zoom on phone).
- [ ] App preview screenshots via MMS: Claude Code captures screenshots of the running app via Playwright MCP (headless browser) and sends them as MMS photos — both mobile viewport (390px) and desktop viewport (1440px).
- [ ] Playwright MCP pre-installed: every VM comes with the Playwright MCP server configured in `.mcp.json`. Claude Code uses it natively for screenshots, navigation, and page interaction — no custom screenshot pipeline.
- [ ] Text-based approvals: engineer replies "approve", "reject", "A", "B", etc. to make decisions — no buttons, no links, just text.
- [ ] GitHub integration: connect to repos, clone branches, create PRs — all triggered via SMS commands.
- [ ] Session management: start/stop development sessions via SMS ("start session authentic-frontend main", "stop session").
- [ ] Images served from VM: screenshots and diff images are generated and served from the always-on VM. The relay fetches them and sends via Twilio MMS.

**P1 — Important (needed for beta launch with real users):**
- [ ] Onboarding website: simple sign-up page where users enter phone number (SMS verification), connect GitHub (OAuth), and enter API keys (BYOK). NOT needed for development or demos — only needed when onboarding other people.
- [ ] User database: store phone number → VM mapping, encrypted GitHub tokens, encrypted API keys, session state. NOT needed for development (hardcoded `.env` is sufficient).
- [ ] Conversational app interaction: engineer texts "show me the settings page" or "click the login button" → Claude Code navigates via Playwright MCP → sends new screenshot via MMS.
- [ ] Multi-agent status updates: when running `/team_three_review`, SMS updates show each agent's progress ("Agent 3/6 complete: Gemini critical review done").
- [ ] CI/CD status: after PR creation, SMS sends build/deploy status updates ("GitHub Actions: passed. Deployed to staging.").
- [ ] Change summaries: AI-generated plain-language explanation of what changed and why, sent as text before the diff images.
- [ ] Slash command help: text "/help" to get a list of available commands with descriptions.
- [ ] Session history: text "/history" to get a summary of recent sessions, branches, and PRs.
- [ ] Review summary images: server renders a visual summary of review findings (blockers, warnings, suggestions) as an image.
- [ ] Composite diff images: when > 5 files change, batch diff images into a single composite image to reduce MMS count. Option to "Reply 'show [filename]' for individual diffs."
- [ ] Image storage abstraction: `ImageStore` interface with `upload()` and `getUrl()` methods. V1 implementation uses local VM filesystem. Swappable to Cloudflare R2, S3, or other providers later for persistence and scalability.

**P2 — Nice to have (needed for paid launch):**
- [ ] Stripe integration: credit card payment on the onboarding website. $29/month subscription. NOT needed until you're charging real users.
- [ ] Group SMS threads: tie a group thread to a project — multiple engineers see agent activity, can issue commands.
- [ ] Native app: a dedicated app for richer interaction — built on top of the same backend.
- [ ] Multi-project management: manage multiple repos/VMs from different SMS threads (one thread per project).
- [ ] Cost tracking: text "/cost" to see token usage and VM cost for current session.
- [ ] Workflow builder: text "/create-command" to define a new slash command via conversation.
- [ ] Multi-channel expansion: add WhatsApp, Telegram, Discord, Slack as additional transport layers. Same backend, different channels. (OpenClaw's channel abstraction could be useful here.)
- [ ] Side-by-side before/after screenshots: send a composite image showing the app before and after the agent's changes.

### Out of Scope (Non-Goals)

- A native app in V1. SMS/MMS is the entire interface. A native app is a P2 consideration, built on the same backend.
- A mobile code editor. Engineers will not type code on their phone. The agent writes code; the engineer reviews via diff images.
- Support for non-Claude-Code agents (e.g., Devin, Replit Agent) as the primary runtime. We build on Claude Code, with Codex CLI and Gemini CLI as optional secondary agents.
- Voice call support in V1. Input is text — typed or dictated via the phone's native keyboard.
- Offline mode. This product requires a cell signal to send/receive SMS.
- Self-hosted VM management. V1 uses a managed cloud provider. Users don't manage infrastructure.
- Real-time streaming inside SMS. SMS delivers complete messages, not character-by-character streams. Agent progress is sent as periodic status updates ("Phase 2 of 11 complete...").
- OpenClaw integration in V1. The architecture is a thin relay server talking directly to Claude Code. OpenClaw could be considered in the future if multi-channel expansion (WhatsApp, Telegram, Discord) becomes a priority.

---

## User Flows

**Flow 1: Onboarding (phased — grows with the product)**

_Development & Demo (no website needed):_
1. Developer hardcodes phone number, GitHub token, and API keys in `.env`
2. Starts Docker container + relay server on their Mac
3. Starts ngrok to expose relay to Twilio
4. Texts the Twilio number — it works. That's it.

_Beta (invite-only, free):_
1. Engineer visits simple signup page
2. Enters phone number (Twilio sends SMS verification code)
3. Connects GitHub account (OAuth)
4. Enters API keys: Claude (required), Codex (optional), Gemini (optional)
5. Backend auto-provisions their Fly.io VM
6. Receives an SMS: "You're set up. Text me to start. Try: start session [repo-name] [branch]"
7. Done. No payment required during beta.

_Paid launch:_
1. Same as beta, plus Stripe payment ($29/month) before VM is provisioned
2. Everything else identical

**Flow 2: Start a new development session**
1. User sends SMS: "start session authentic-frontend main"
2. System replies: "Cloning authentic-frontend (branch: main)... Installing dependencies..."
3. System replies: "Session ready. Dev server running. Here's your app:"
4. System sends MMS: [app-screenshot-mobile.png] [app-screenshot-desktop.png]
5. System replies: "Type /help for available commands."
6. User is ready to issue commands — never left Messages

**Flow 3: Run an agentic workflow**
1. User sends SMS: "/ship add a dark mode toggle to the settings page"
2. System replies: "Starting /ship workflow (11 phases). I'll text you at each milestone."
3. System replies: "[1/11] Planning complete. Will modify: SettingsPage.tsx, theme.ts, ThemeContext.tsx. Adding: dark-mode.test.ts"
4. System replies: "[3/11] Implementation done. 4 files changed, +187 lines."
5. System sends diff images via MMS: [diff-theme.ts.png] [diff-SettingsPage.tsx.png] [diff-ThemeContext.tsx.png] [diff-dark-mode.test.ts.png]
6. System sends updated app screenshots via MMS: [app-after-mobile.png] [app-after-desktop.png]
7. System replies: "[5/11] Review complete. 0 blockers, 1 suggestion (unused import in theme.ts). Auto-fixing..."
8. System replies: "[8/11] All fixes applied. Ready to create PR. Reply 'approve' to create PR, or 'reject' to undo."
9. User replies: "approve"
10. System replies: "PR #47 created: 'Add dark mode toggle to settings page'. GitHub Actions: building... passed. Deployed to staging."
11. System sends staging screenshot via MMS: [staging-screenshot.png]

**Flow 4: Voice-dictated workflow**
1. User holds the microphone button on their keyboard and speaks: "investigate why the checkout page is returning 500 errors on the payments endpoint"
2. Phone's native dictation converts speech to text. SMS is sent as plain text.
3. System replies: "Starting /investigate..."
4. System replies: "Spawned 3 investigation agents (Claude, Codex, Gemini). Running in parallel..."
5. System replies (2 min later): "Agent 1/3 complete (Claude): suspects null reference in paymentService.ts"
6. System replies (3 min later): "All 3 agents complete. Synthesizing findings..."
7. System replies: "Root cause: missing null check in paymentService.ts:47 when payment provider returns empty response. All 3 agents agree."
8. System sends MMS: [diff-paymentService.ts.png]
9. System replies: "Reply 'fix' to apply the fix, or 'show more' for the full investigation report."
10. User replies: "fix"
11. System replies: "Fix applied. PR #48 created. Here's the app now:"
12. System sends MMS: [app-checkout-fixed.png]

**Flow 5: Review code changes**
1. User receives SMS: "/team_three_review complete. 14 findings across 6 agents."
2. System sends review summary: "3 blockers | 5 important | 6 suggestions"
3. System sends MMS: [review-summary.png] — a visual summary card showing findings grouped by severity
4. System lists blockers inline:
   "BLOCKERS:
   1. Race condition in auth.ts:92 (flagged by Claude + Codex)
   2. Missing input sanitization in form.tsx:31
   3. SQL injection risk in query.ts:18"
5. System sends diff images for each blocker via MMS: [blocker-1-auth.ts.png] [blocker-2-form.tsx.png] [blocker-3-query.ts.png]
6. User reviews images (pinch-to-zoom), then replies: "fix blockers"
7. System replies: "Fixing 3 blockers... Done. All tests passing."
8. System sends updated diff images showing the fixes via MMS
9. User replies: "approve"
10. System replies: "PR #50 created with all fixes."

**Flow 6: Conversational app interaction**
1. User sends: "show me the settings page"
2. System sends MMS: [app-settings-mobile.png] [app-settings-desktop.png]
3. User sends: "click the dark mode toggle"
4. System sends MMS: [app-settings-dark-mode-on.png]
5. User sends: "looks good. now show me the login page in dark mode"
6. System sends MMS: [app-login-dark-mode-mobile.png] [app-login-dark-mode-desktop.png]

**Flow 7: Quick commands**
1. User sends: "/compushar fix login validation bug"
2. System replies: "Committed: 'fix: add null check to login validation'. Pushed to branch aut-92-login-fix. PR #49 created."
3. System sends MMS: [diff-loginValidation.ts.png]

**Flow 8: Session management**
1. User sends: "status"
2. System replies: "Active session: authentic-frontend (branch: aut-92-login-fix). VM running. 3 PRs created this session. Dev server healthy."
3. System sends MMS: [app-current-state.png]
4. User sends: "stop session"
5. System replies: "Session stopped. Resume anytime with 'resume authentic-frontend'."

**Edge cases to handle:**
- VM goes down or restarts — SMS: "Your session was interrupted. Last state saved at commit abc123. Reply 'resume' to pick up where you left off."
- Network interruption on phone — agent keeps working on VM. All SMS/MMS updates queue in Twilio and deliver when connection resumes.
- Agent gets stuck (thrashing detection) — SMS: "Agent may be stuck (3 failed attempts on the same issue). Reply 'fresh' to spawn a fresh agent, or 'stop' to cancel."
- Multiple workflows running simultaneously — each update is prefixed with the workflow name: "[/ship] Phase 4 complete..." "[/investigate] Agent 2/3 done..."
- Large diffs (100+ files) — system sends summary text + a composite overview image showing all file names and change counts, then asks "Reply 'show auth.ts' to see a specific file's diff"
- Dictation errors — system replies: "Received: 'fix the log in paje'. Did you mean: 'fix the login page'? Reply 'yes' or re-record."
- User sends a message while a workflow is running — system queues it and replies: "I'm currently running /ship (Phase 6/11). I'll process your next command when this completes. Reply 'cancel' to stop the current workflow."
- Too many images in thread — system batches diff images into a single composite image when > 5 files change, with an option to "Reply 'show [filename]' for individual diffs"
- SMS character limit (160 chars per segment) — long responses are sent as multi-segment SMS (Twilio handles concatenation automatically, charged per segment)

---

## Technical Considerations

- **Performance:** SMS text responses must be sent within 5 seconds of agent output. MMS images (screenshots and diff images) must be generated and sent within 10 seconds of code changes (Playwright capture + image compression + Twilio delivery). VM is always-on — no provisioning delay.
- **Image quality:** Diff images must be high-resolution enough to read code when pinch-to-zoomed on a phone (minimum 2x retina, ~750px wide for mobile viewport). App screenshots must capture at both mobile (390px) and desktop (1440px) viewports. Images must be compressed to stay under MMS carrier limits (~1MB): PNG for diffs (sharp text), JPEG for app screenshots.
- **MMS cost management:** Each MMS costs ~$0.02 via Twilio. A heavy workflow (8 diff images + 2 screenshots) costs ~$0.20 in MMS fees. Composite images (batching multiple diffs into one image) reduce cost when > 5 files change. Long-term, the `ImageStore` abstraction allows switching to hosted links (SMS + URL) to eliminate MMS costs entirely.
- **Security:** All communication between the relay server and VMs must be encrypted (TLS/WSS). API keys for Claude, Codex, Gemini must never leave the VM. GitHub tokens use OAuth with minimal scopes. SMS authentication: only registered phone numbers can issue commands (allowlist matched against Twilio's `From` field). Twilio webhook signature validation on all incoming requests.
- **Scalability:** Each user gets their own always-on VM. The relay server is stateless and horizontally scalable. VMs are isolated per user — no cross-contamination. Twilio handles SMS/MMS delivery at any scale.
- **Integrations:** Twilio (SMS/MMS), Claude Code CLI (headless mode), Playwright MCP (screenshot capture + page interaction), GitHub (repos, PRs, Actions), Codex CLI (optional), Gemini CLI (optional), Vercel / Railway / Fly.io (deployment).
- **Reliability:** The VM is always running — no cold starts. The relay server must be stateless and recoverable. Twilio queues undelivered messages automatically. Agent workflows must be resilient to relay server restarts — use a persistent job queue.
- **SMS-specific constraints:** SMS has no formatting — no markdown, no syntax highlighting in text. All visual content (diffs, app previews, review summaries) must be rendered as images and sent via MMS. SMS segments are 160 characters (GSM-7) or 70 characters (UCS-2/emoji). Long messages span multiple segments — Twilio handles concatenation but charges per segment.

---

## Architecture Overview

_Radically simple. The engineer owns nothing but a phone._

```
┌─────────────────────────────────────────────────────┐
│              ENGINEER'S PHONE                        │
│              (iPhone or Android — any phone)          │
│              THE ONLY THING THEY OWN                  │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │           Native Messages App                    │ │
│  │           (pre-installed on every phone)          │ │
│  │                                                   │ │
│  │  You: /ship add dark mode                        │ │
│  │                                                   │ │
│  │  Bot: [1/11] Planning complete.                  │ │
│  │  Modifying: theme.ts, SettingsPage.tsx           │ │
│  │                                                   │ │
│  │  Bot: [3/11] Implementation done.                │ │
│  │  4 files changed, +187 lines.                    │ │
│  │                                                   │ │
│  │  [diff-theme.ts.png]                             │ │
│  │  [diff-SettingsPage.tsx.png]                     │ │
│  │  [app-screenshot-mobile.png]                     │ │
│  │  [app-screenshot-desktop.png]                    │ │
│  │                                                   │ │
│  │  Bot: Reply 'approve' to create PR.              │ │
│  │                                                   │ │
│  │  You: approve                                    │ │
│  │                                                   │ │
│  │  Bot: PR #47 created. Build passed.              │ │
│  │  [staging-screenshot.png]                        │ │
│  │                                                   │ │
│  └─────────────────────────────────────────────────┘ │
│           Everything stays in the thread              │
└──────────────────┬────────────────────────────────────┘
                   │ SMS/MMS
                   │ (via cell network)
                   ▼
┌──────────────────────────────────────────────────────┐
│                    TWILIO                              │
│                                                       │
│  - Receives SMS from engineer's phone                 │
│  - Webhooks to relay server                           │
│  - Sends SMS/MMS responses back to engineer           │
│  - Handles message queuing, delivery, retry           │
│  - One phone number for the service                   │
│                                                       │
└──────────────────┬────────────────────────────────────┘
                   │ HTTPS webhook
                   ▼
┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
  ALL INFRASTRUCTURE BELOW IS CLOUD-HOSTED
│ OWNED AND OPERATED BY THE SERVICE                     │
  THE USER NEVER SEES, TOUCHES, OR MANAGES ANY OF IT
└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘

┌──────────────────────────────────────────────────────┐
│            RELAY SERVER (single instance)              │
│            (Railway / Fly.io / AWS)                    │
│            ~200-300 lines of code                      │
│                                                       │
│  ┌──────────────────────────────────────────────┐    │
│  │ Twilio Webhook Handler                        │    │
│  │ - Validate Twilio signature                   │    │
│  │ - Extract phone number + message body         │    │
│  │ - Authenticate user by phone number           │    │
│  └───────────────────┬──────────────────────────┘    │
│                      │                                │
│  ┌───────────────────▼──────────────────────────┐    │
│  │ Router                                        │    │
│  │ - Look up user's VM by phone number           │    │
│  │ - Forward command to Claude Code on VM         │    │
│  │ - Receive output (text + image paths)          │    │
│  │ - Format response for SMS                      │    │
│  │ - Fetch images from VM                         │    │
│  │ - Send SMS/MMS via Twilio API                  │    │
│  └───────────────────┬──────────────────────────┘    │
│                      │                                │
│  ┌───────────────────▼──────────────────────────┐    │
│  │ User Database                                 │    │
│  │ - Phone number → user mapping                 │    │
│  │ - Phone number → VM address mapping           │    │
│  │ - GitHub OAuth tokens (encrypted)             │    │
│  │ - API keys (encrypted, user-provided)         │    │
│  │ - Session state, preferences                  │    │
│  │ - Usage tracking for billing                  │    │
│  └──────────────────────────────────────────────┘    │
│                                                       │
└──────────────────┬────────────────────────────────────┘
                   │ HTTPS / WSS
                   ▼
┌──────────────────────────────────────────────────────┐
│            CLOUD VM (always-on, per user)              │
│            (Railway / Fly.io / AWS)                    │
│                                                       │
│  ┌────────────────────────────────────────────────┐  │
│  │ Claude Code CLI (headless mode)                 │  │
│  │ - Receives commands from relay                  │  │
│  │ - Executes slash commands (/ship, /investigate) │  │
│  │ - Orchestrates multi-agent workflows            │  │
│  │ - Returns text output + triggers screenshots    │  │
│  └─────────┬──────────────────────────────────────┘  │
│            │                                          │
│  ┌─────────▼──────────────────────────────────────┐  │
│  │ Playwright MCP (pre-configured in .mcp.json)    │  │
│  │ - Headless Chromium browser                     │  │
│  │ - Screenshot capture (mobile + desktop)         │  │
│  │ - Page navigation on command                    │  │
│  │ - Click/interact on command                     │  │
│  │ - Claude Code calls it natively as MCP tools    │  │
│  └────────────────────────────────────────────────┘  │
│                                                       │
│  ┌────────────────┐  ┌────────────────────────────┐  │
│  │ Git repo        │  │ Dev server (next/vite)     │  │
│  │ (cloned from    │  │ - Always running           │  │
│  │  user's GitHub) │  │ - Playwright captures it   │  │
│  └────────────────┘  └────────────────────────────┘  │
│                                                       │
│  ┌────────────────────────────────────────────────┐  │
│  │ Image Store (local filesystem, V1)              │  │
│  │ - /tmp/images/*.png                             │  │
│  │ - Served via simple HTTP endpoint               │  │
│  │ - Relay fetches images, sends via Twilio MMS    │  │
│  │ - Swappable to R2/S3 later via ImageStore       │  │
│  │   interface                                     │  │
│  └────────────────────────────────────────────────┘  │
│                                                       │
│  ┌────────────┐  ┌────────────┐                      │
│  │ Codex CLI  │  │ Gemini CLI │  (optional)          │
│  │            │  │            │                       │
│  └────────────┘  └────────────┘                      │
│                                                       │
│  User's API keys loaded from encrypted store          │
│  VM is always-on — no cold starts                     │
│  All persistent state lives in git                    │
└──────────────────────────────────────────────────────┘
```

### What The User Provides vs. What The Service Provides

```
WHAT THE USER PROVIDES:          WHAT THE SERVICE PROVIDES:
─────────────────────────        ──────────────────────────
- A phone (any phone)           - Twilio phone number + SMS/MMS
- Cell signal or WiFi           - Relay server (~200 lines)
- GitHub account                - Always-on cloud VM per user
- API keys (BYOK)              - Claude Code CLI (pre-installed)
- Monthly subscription          - Playwright MCP (pre-configured)
                                - Dev server runtime
                                - Image generation pipeline
                                - User database + session mgmt
                                - All infrastructure + ops
```

### Why This Architecture Is Simple

The key insight: **Claude Code already does everything.** It handles slash commands, multi-agent orchestration, Playwright screenshots, git operations, code review, and deployment. The only missing piece was a way to send it commands from a phone.

The relay server is not an orchestration layer. It's a translator:
- SMS text → Claude Code command
- Claude Code output → SMS text
- Claude Code screenshot → MMS image

That's it. ~200-300 lines of code. One server. One VM per user. Twilio handles messaging. Claude Code handles engineering.

### Docker-First Development (Local → Production with Zero Friction)

Everything runs inside a Docker container from day one — even during local development. This eliminates the "works on my machine" problem and makes the move to production a config change, not a rewrite.

**The Docker image contains:**
- Claude Code CLI (headless mode)
- Playwright MCP (pre-configured in `.mcp.json`)
- Node.js, git, Chromium
- Thin API wrapper (HTTP endpoint that accepts commands, returns output + image paths)
- Image directory (`/tmp/images/`) served via HTTP

**The same image runs everywhere:**

```
# Local development: run the container on your Mac
docker build -t sms-cockpit-vm .
docker run -p 3000:3000 sms-cockpit-vm

# Production: Fly.io runs the exact same container
fly deploy   # pushes the same Docker image to Fly.io
```

The relay server talks to the container via HTTP — it doesn't know or care whether the container is on your Mac or on Fly.io. The only difference is the URL:

```
# Local development (.env)
CLAUDE_HOST=http://localhost:3000
IMAGE_HOST=http://localhost:3000/images

# Production (.env)
CLAUDE_HOST=https://user-vm-123.fly.dev
IMAGE_HOST=https://user-vm-123.fly.dev/images
```

**The user never sees Docker.** Docker is a development and deployment tool — it packages everything into a portable container. Users text a phone number. They don't know Docker, Fly.io, or VMs exist.

### Local Development Setup

For developing and testing the product, everything runs on your Mac. Cost: ~$3-5/month (just Twilio).

```
┌─────────────┐     SMS      ┌─────────┐    webhook    ┌─────────┐
│ Your iPhone  │ ──────────→ │  Twilio  │ ──────────→  │  ngrok   │
│ (test user)  │ ←────────── │          │ ←────────── │          │
└─────────────┘    SMS/MMS   └─────────┘    response   └────┬─────┘
                                                             │
                                                             │ localhost
                                                             ▼
                                              ┌──────────────────────────┐
                                              │    YOUR MAC               │
                                              │                           │
                                              │  ┌──────────────────┐    │
                                              │  │  Relay Server     │    │
                                              │  │  (Node.js)        │    │
                                              │  └────────┬─────────┘    │
                                              │           │               │
                                              │  ┌────────▼─────────┐    │
                                              │  │  Docker Container  │    │
                                              │  │  ┌──────────────┐ │    │
                                              │  │  │ Claude Code   │ │    │
                                              │  │  │ Playwright MCP│ │    │
                                              │  │  │ Dev Server    │ │    │
                                              │  │  │ Git Repo      │ │    │
                                              │  │  └──────────────┘ │    │
                                              │  └──────────────────┘    │
                                              │                           │
                                              └──────────────────────────┘
```

**What you need:**
- Docker Desktop (runs the VM container locally)
- ngrok (exposes your local relay to Twilio's webhooks)
- Twilio account + phone number (~$3-5/month)
- Your own API keys for Claude, Codex, Gemini

**What happens:** You text your Twilio number from your iPhone. Twilio webhooks to ngrok, which tunnels to your local relay server. The relay forwards the command to Claude Code running inside the Docker container on your Mac. Claude Code does the work, takes screenshots via Playwright MCP, and the relay sends the result back via Twilio SMS/MMS to your phone.

**Limitation:** Stops working when your Mac sleeps. For development this is fine — you're at your laptop anyway.

### Production Setup (Fly.io)

When ready to deploy for real users, push the same Docker image to Fly.io. The relay server moves to Fly.io too (or stays separate). ngrok is replaced by Fly.io's public URL.

```
┌─────────────┐     SMS      ┌─────────┐    webhook    ┌─────────────────────┐
│ User's Phone │ ──────────→ │  Twilio  │ ──────────→  │  Fly.io              │
│ (any phone)  │ ←────────── │          │ ←────────── │                      │
└─────────────┘    SMS/MMS   └─────────┘    response   │  ┌───────────────┐  │
                                                        │  │ Relay Server   │  │
                                                        │  └───────┬───────┘  │
                                                        │          │          │
                                                        │  ┌───────▼───────┐  │
                                                        │  │ User VM        │  │
                                                        │  │ (Docker image) │  │
                                                        │  │ Claude Code    │  │
                                                        │  │ Playwright MCP │  │
                                                        │  │ Dev Server     │  │
                                                        │  └───────────────┘  │
                                                        │                      │
                                                        │  (one VM per user,   │
                                                        │   always-on)         │
                                                        └─────────────────────┘
```

### Phased Onboarding (Build Only What You Need, When You Need It)

The onboarding system grows with the product. You don't build a signup page until you have users. You don't add Stripe until you're charging.

```
DEVELOPMENT & DEMO          BETA (FREE)                 PAID LAUNCH
────────────────────        ─────────────────           ──────────────────
.env file with:             Simple signup page:         Full signup page:
- Your phone number         - Phone verification        - Phone verification
- Your GitHub token         - GitHub OAuth              - GitHub OAuth
- Your API keys             - API key entry             - API key entry
                            - Auto-provision VM         - Stripe payment
No database.                                            - Auto-provision VM
No website.                 Database:
No Stripe.                  - phone → VM mapping        Everything from Beta
                            - encrypted credentials     + payment processing
Just text and go.
```

**Development & Demo mode:** The relay server reads from `.env`. One phone number, one set of credentials, one Docker container. You text, it works. When you demo in front of people, they see the SMS experience on your phone screen — indistinguishable from the production product.

**Beta mode:** Add a simple signup page (Vercel) and a database (Supabase free tier). Users enter their info, backend calls Fly.io Machines API to auto-provision their VM. No payment — you're validating demand.

**Paid launch:** Add Stripe to the signup page. Payment triggers VM provisioning. Everything else is identical.

### Automated VM Provisioning (Beta & Beyond)

When a new user signs up, the onboarding backend automatically creates their VM via the Fly.io Machines API:

```
1. User signs up on website (phone number, GitHub OAuth, API keys)
2. Backend calls Fly.io Machines API:
   POST https://api.machines.dev/v1/apps/sms-cockpit/machines
   {
     "image": "registry.fly.io/sms-cockpit-vm:latest",
     "config": {
       "env": {
         "GITHUB_TOKEN": "<encrypted>",
         "ANTHROPIC_API_KEY": "<encrypted>"
       },
       "services": [{ "ports": [{ "port": 3000 }] }]
     }
   }
3. Fly.io returns machine ID + public URL
4. Backend stores: phone number → machine URL in database
5. User receives welcome SMS: "You're set up. Text me to start."
6. Every future SMS from that phone number routes to their VM.
```

**Teardown:** If a user cancels, the backend calls `DELETE /machines/{id}` and the VM is gone. All code is safe in GitHub.

**Scaling:** Each `fly deploy` pushes the latest Docker image. New users get the latest version automatically. Existing users can be updated via `fly machines update`.

### Local → Production Migration (Zero Friction)

The move from local development to production requires **no code changes**:

| Step | What changes |
|------|-------------|
| 1. Push Docker image to Fly.io registry | `fly deploy` (one command) |
| 2. Deploy relay server to Fly.io | `fly deploy` (one command) |
| 3. Update Twilio webhook URL | Change from ngrok URL to Fly.io URL (one Twilio console edit) |
| 4. Done | Same code, same container, different host |

The relay code, the Docker image, the Twilio phone number, the Claude Code configuration — all identical between local and production. The only thing that changes is where the containers run.

---

## Assumptions & Constraints

**Assumptions** (things we believe to be true but haven't fully validated):
- Engineers are willing to review code diffs via pinch-to-zoom on syntax-highlighted images in their Messages app
- Syntax-highlighted diff images at retina resolution are readable enough for meaningful code review on a phone screen
- SMS/MMS delivery latency is acceptable for development workflows (typically < 3 seconds for SMS, < 10 seconds for MMS)
- The conversational screenshot pattern ("show me the settings page" → screenshot) is sufficient for app preview without a live browser
- Engineers prefer using an interface that requires zero installation (SMS) over downloading a new app
- Claude Code CLI can be reliably driven headlessly (`claude -p` / `claude --headless`) for all slash commands
- Phone keyboard dictation (iOS/Android built-in) is accurate enough for programming commands and slash command names
- MMS can handle the volume of images generated during a development session (estimated 20-50 images per hour during active development) without carrier throttling

**Constraints** (hard limits):
- SMS has no formatting — no markdown, no syntax highlighting, no clickable buttons. All visual content must be rendered as images and sent via MMS.
- MMS has carrier-specific size limits (~1MB per image). Images must be compressed appropriately.
- MMS costs ~$0.02 per message via Twilio. Image-heavy workflows have a non-trivial messaging cost.
- SMS segments are 160 characters. Long messages are split into multiple segments (Twilio handles this but charges per segment at ~$0.0079 each).
- Always-on VMs cost ~$5-15/month per user. This is a fixed cost regardless of usage.
- Claude Code, Codex CLI, and Gemini CLI all require API keys with usage-based pricing — BYOK for V1.
- SMS is subject to carrier filtering and rate limiting. High-volume automated SMS from a single number may trigger spam filters. Twilio provides tools to manage this (A2P 10DLC registration, toll-free verification).
- No real-time streaming. SMS delivers complete messages. Progress updates are periodic ("Phase 2 of 11 complete...").
- MMS images may arrive out of order. The relay should number or label images to maintain context.

**Dependencies:**
- Docker (for building and running the VM container — development and production)
- Twilio account + phone number + A2P 10DLC registration (for reliable SMS delivery)
- ngrok (local development only — tunnels Twilio webhooks to localhost)
- Claude Code CLI stability and headless mode compatibility (Anthropic)
- Playwright MCP server (`@playwright/mcp`) stability
- Fly.io account (production deployment and automated VM provisioning)
- GitHub OAuth app approval for repo access

---

## Open Questions & Risks

| Question / Risk | Owner | Status | Resolution |
|-----------------|-------|--------|------------|
| Can Claude Code CLI be driven headlessly at sufficient reliability for all 11+ slash commands? | Emmanuel | Open | Extensive testing required. Some commands spawn sub-agents that may behave differently headlessly. |
| Will MMS images arrive in the correct order, or do we need to label/number them? | Emmanuel | Open | Test with Twilio — send 5+ MMS in sequence and verify delivery order across carriers (AT&T, T-Mobile, Verizon). |
| Will carrier spam filters block high-volume automated SMS from a Twilio number? | Emmanuel | Open | Register for A2P 10DLC via Twilio. Test sustained message volume (50+ messages/hour to a single number). |
| What's the right VM provider for cost, speed, and always-on reliability? | Emmanuel | Decided | **Fly.io** — cheapest option (~$5/month per VM), Docker-native, Machines API for automated provisioning. |
| What's the minimum viable pricing model that covers infrastructure costs? | Emmanuel | Decided | **$29/month** per user. Infrastructure cost ~$26/month for a power user (Fly.io VM $5 + Twilio $20 + relay $1). ~$3/month margin at heaviest usage, more for lighter users. |
| How do we handle API key management — BYOK for V1, managed keys later? | Emmanuel | Open | BYOK for V1 to avoid cost liability. Managed tier is a future revenue model. |
| What happens when a long-running workflow (e.g., `/ship` — 30+ min) generates dozens of status updates and images? Will it overwhelm the SMS thread? | Emmanuel | Open | Design message batching and summary patterns. Don't spam the user — send milestone updates, not every line of output. |
| How do we securely store user API keys and GitHub tokens in a multi-tenant cloud service? | Emmanuel | Open | Encrypted at rest (AES-256), per-user encryption keys, never stored in plain text, never logged. |
| Is phone keyboard dictation accurate enough for programming terminology? (e.g., "slash ship", "paymentService.ts") | Emmanuel | Open | Test with 50+ sample dictated commands from engineers on both iOS and Android. |
| How do we handle the `ImageStore` migration from local VM to R2/S3 when scaling? | Emmanuel | Open | Design the interface now, implement local-only for V1. Migration is a config change, not a rewrite. |

---

## Timeline & Milestones

### Phase A: Local Development (your Mac, ~$3-5/month)

| Milestone | Target Date | Notes |
|-----------|-------------|-------|
| PRD approved | TBD | This document |
| Twilio account + phone number | TBD | Register, get number, configure A2P 10DLC (~$20 one-time) |
| SMS echo prototype | TBD | Twilio → ngrok → local server → echo back. Send a test MMS image. Prove plumbing works. |
| Docker image v1 | TBD | Dockerfile with Claude Code CLI + Playwright MCP + Node.js + git + Chromium. Runs locally via `docker run`. |
| Relay server prototype | TBD | Twilio webhook → ngrok → relay → Claude Code in Docker → response back via SMS. All on your Mac. |
| Screenshot pipeline | TBD | Claude Code uses Playwright MCP inside Docker to capture app screenshots, relay sends via MMS |
| Diff image pipeline | TBD | Syntax-highlighted diff rendering to PNG inside Docker, sent via relay as MMS |
| End-to-end local flow | TBD | Full loop on your Mac: text service number → relay → Claude Code in Docker → /ship → diffs + screenshots → approve → PR created. All from your phone. |

### Phase B: Deploy to Production (Fly.io, ~$200 upfront)

| Milestone | Target Date | Notes |
|-----------|-------------|-------|
| Push Docker image to Fly.io | TBD | `fly deploy` — same image that runs locally, now runs on Fly.io |
| Deploy relay server to Fly.io | TBD | `fly deploy` — swap ngrok URL for Fly.io URL in Twilio config |
| Update Twilio webhook URL | TBD | Point Twilio to Fly.io public URL instead of ngrok |
| Automated VM provisioning | TBD | Onboarding backend calls Fly.io Machines API to create per-user VMs on signup |
| Onboarding website | TBD | Sign up, connect GitHub, enter API keys. Simple web form on Vercel. |
| End-to-end production flow | TBD | Full loop: sign up → text service number → VM auto-created → /ship → diffs + screenshots → approve → PR. Laptop closed the whole time. |

### Phase C: Beta & Scale

| Milestone | Target Date | Notes |
|-----------|-------------|-------|
| Beta launch (invite-only, bootcamp cohort) | TBD | 10 engineers using it for real development work. Monitor costs and reliability. |
| Stability + polish | TBD | Error handling, edge cases, session management, image quality tuning, MMS delivery order testing |
| Cost model validated | TBD | Confirm unit economics: $29/month subscription covers ~$26/month infrastructure per power user |
| Wider launch (invite codes) | TBD | Expand beyond bootcamp cohort |

---

## Rollout Strategy

- **Rollout approach:** Build locally first, deploy to Fly.io second, onboard users third. Docker-first development ensures zero friction between phases.

  **Local Development (your Mac):**
  - **Phase 1 (Echo):** Twilio → ngrok → local relay → echo back. Send a test MMS image. Proves SMS plumbing works end-to-end.
  - **Phase 2 (Docker):** Build the Docker image with Claude Code + Playwright MCP. Run it locally. Relay talks to the local container.
  - **Phase 3 (Command):** Relay routes text commands to Claude Code in Docker. Agent responses come back as SMS. Text-only, no images yet.
  - **Phase 4 (Screenshots):** Claude Code uses Playwright MCP inside Docker to capture app screenshots. Relay sends them as MMS.
  - **Phase 5 (Diff images):** Add syntax-highlighted diff rendering. Code changes rendered as PNG, sent as MMS alongside screenshots.
  - **Phase 6 (End-to-end local):** Full `/ship` workflow from your phone, all running on your Mac in Docker. Validate the complete experience.

  **Production Deployment (Fly.io):**
  - **Phase 7 (Deploy):** Push Docker image to Fly.io. Deploy relay server. Swap Twilio webhook URL. Same code, different host.
  - **Phase 8 (Provisioning):** Build automated VM creation via Fly.io Machines API. New user signs up → VM auto-created.
  - **Phase 9 (Onboarding):** Build the sign-up website (phone number, GitHub OAuth, API keys). Connect to provisioning pipeline.

  **Scale & Polish:**
  - **Phase 10 (Beta):** Invite 10 bootcamp engineers. Monitor costs, reliability, MMS delivery across carriers.
  - **Phase 11 (Conversational navigation):** Engineer texts "show me the login page" → Claude Code navigates via Playwright MCP → sends screenshot via MMS.
  - **Phase 12 (Multi-agent):** Add status updates for parallel agent workflows (`/team_three_review`, `/investigate`). Send review summary images.
  - **Phase 13 (CI/CD):** Deployment status updates and CI/CD integration (GitHub Actions, Vercel).
  - **Phase 14 (Polish):** Session management, error handling, `/help`, `/history`, `/cost`, composite images, MMS delivery order handling.

- **Graduation criteria** (what must be true to proceed to wider launch):
  - At least 10 engineers from the bootcamp cohort have used it for 2+ weeks
  - Engineers report being able to complete at least 50% of their agentic workflow sessions via SMS
  - Relay server uptime > 99% over a 2-week period
  - Zero instances of message loss or incorrect routing
  - MMS images are readable and arrive in correct order across major carriers
  - Works on both iPhone and Android without platform-specific issues

- **Rollback plan:**
  - VMs can be reprovisioned instantly — all persistent state lives in git
  - Relay server is stateless — restart or redeploy at any time
  - Twilio number can be deactivated — users simply stop receiving responses. No data loss. All code is safe in GitHub.
  - If SMS proves untenable (carrier blocking, cost explosion), the same backend can power WhatsApp (via Twilio), Telegram, Discord, or a lightweight native app — the transport is swappable, the backend is the same. OpenClaw's channel abstraction could accelerate multi-channel expansion.
  - User data (GitHub tokens, API keys) can be exported or deleted on request

---

## Cost Model

### Your Development Cost (Building & Testing)

Everything runs on your Mac during development. Minimal spend.

| Component | Cost | Notes |
|-----------|------|-------|
| Docker Desktop | Free | Runs the VM container locally |
| ngrok | Free tier | Tunnels Twilio webhooks to localhost |
| Twilio number + A2P 10DLC | ~$3-5/month + $15 one-time | SMS/MMS for testing |
| Your API keys (Claude, etc.) | Your existing keys | No additional cost |
| **Total to develop & test** | **~$3-5/month** | Everything runs on your Mac |

### Production Infrastructure Costs (Fly.io)

| Component | Provider | Cost | Notes |
|-----------|----------|------|-------|
| Twilio phone number | Twilio | ~$1.15/month | One number for the service |
| Twilio A2P 10DLC registration | Twilio | ~$15 one-time + $2/month | Required for reliable SMS delivery to US numbers |
| Relay server | Fly.io | ~$5/month | Single instance, stateless, lightweight |
| Cloud VM (per user, always-on) | Fly.io | ~$5/month per user | Docker container, always-on |
| Database (user accounts) | Supabase | Free tier → ~$25/month | User records, session state, encrypted keys |
| Onboarding website | Vercel | Free tier | Simple sign-up form |

### Twilio Messaging Costs (Per Message)

| Message Type | Direction | Cost |
|-------------|-----------|------|
| SMS | Outbound | ~$0.0079 |
| SMS | Inbound | ~$0.0075 |
| MMS | Outbound | ~$0.02 |
| MMS | Inbound | ~$0.01 |

### Cost Per Workflow (Estimated)

| Workflow | SMS messages | MMS images | Twilio cost |
|----------|------------|------------|-------------|
| `/ship` (full 11-phase) | ~15 texts | ~10 images | ~$0.32 |
| `/compushar` (quick commit+PR) | ~3 texts | ~2 images | ~$0.06 |
| `/investigate` (3-agent) | ~8 texts | ~3 images | ~$0.12 |
| `/team_three_review` (6-agent) | ~10 texts | ~5 images | ~$0.18 |
| Simple command ("status", "show me X") | ~2 texts | ~1 image | ~$0.04 |

### Cost Per User Per Month (Power User on Fly.io)

| Component | Cost | Notes |
|-----------|------|-------|
| VM (always-on, Fly.io) | $5 | Fixed cost |
| Twilio messaging (~10 workflows/day) | $20 | Variable — heaviest cost driver |
| Relay server share | ~$1 | Amortized across all users |
| **Total infrastructure per user** | **~$26/month** | **Before AI API costs (user pays via BYOK)** |

### Pricing Model

| Tier | Price | Includes |
|------|-------|----------|
| **Beta (invite-only)** | Free | Full access. Validates demand. Service absorbs infra cost for ~10 users. |
| **Launch** | **$29/month** | Always-on VM + unlimited SMS/MMS. BYOK for AI APIs. ~$3/month margin at power-user level, more margin for lighter users. |
| **Pro** | $59/month | Priority support. Group threads. Multi-project. |

_Note: AI API costs (Claude, Codex, Gemini) are NOT included — users bring their own API keys (BYOK). This keeps the service affordable and avoids unpredictable AI cost pass-through._

### Upfront Investment to Launch Beta

| Item | Cost | Notes |
|------|------|-------|
| Twilio account + number + A2P 10DLC | ~$20 | One-time setup |
| Relay server on Fly.io (3 months) | ~$15 | Single instance |
| 10 user VMs on Fly.io (3 months) | ~$150 | $5/month × 10 users × 3 months |
| Domain | ~$15 | Onboarding website on Vercel free tier |
| **Total to launch beta** | **~$200** | Before any revenue |

_Note: This is significantly cheaper than the iMessage approach, which required cloud Mac infrastructure at ~$700-1,400 upfront. SMS via Twilio eliminates the most expensive component entirely._

---

## Learning & Growth

**New technology/skill being implemented:**
- Docker containerization (building images, multi-stage builds, running identical containers locally and in production)
- Twilio SMS/MMS API integration (webhooks, message sending, A2P 10DLC compliance)
- Fly.io deployment and Machines API (automated VM provisioning per user)
- Server-side architecture (relay server, job queues, WebSocket communication with VMs)
- Playwright MCP configuration and headless browser automation
- Image generation pipeline (syntax-highlighted diff rendering to PNG, screenshot capture)
- Claude Code headless mode and programmatic CLI control
- Multi-tenant cloud service architecture (user isolation, encrypted key storage, session management)
- ngrok for local development tunneling

**How this stretches beyond my current abilities:**
- Moving from consuming agentic workflows to building the infrastructure that serves them
- Systems architecture — VM orchestration, real-time messaging relay, user management, security
- Solving the "rich content in plain text" problem — rendering diffs, previews, and reviews as images that are readable on a phone screen
- Building a multi-tenant service with proper user isolation, encrypted secrets, and billing
- Twilio compliance (A2P 10DLC, carrier filtering, message throughput management)

**What excites me most about this project:**
- The radical simplicity — no app, no download, no setup. Text a number and you're coding.
- Cross-platform from day one — iPhone and Android, no platform lock-in
- The architecture is ~200 lines of relay code + Claude Code doing all the real work
- Upfront cost is ~$200-500 to launch a beta, not $700-1,400
- Proving that the phone can be a real engineering surface, not just a consumption device
- Making agentic workflows accessible to anyone with a phone and a cell signal

---

## Appendix

### Competitive Landscape
- [Authentic's Agentic Engineering Techniques](./README.md) — The workflow system this product exposes via SMS
- [Claude Code Remote Control docs](https://code.claude.com/docs/en/remote-control) — Anthropic's basic remote access feature (Feb 2026)
- [Kibbler](https://kibbler.dev/) — Third-party Claude Code mobile wrapper with voice + diffs (requires iOS app install)
- [Moshi](https://getmoshi.app/) — iOS terminal with push notifications for Claude Code (requires iOS app install)
- [OpenClaw](https://openclaw.ai/) — Open-source AI assistant with multi-channel support (WhatsApp, Telegram, Discord, Slack — all require third-party app). Could be useful for future multi-channel expansion.
- [Claude-Code-Remote](https://github.com/) — Open source: control Claude Code via Telegram/Discord/Email (requires third-party app)
- [Replit Mobile](https://replit.com/mobile-apps) — Closest existing product (targets non-technical audience, requires app install)
- [v0 iOS app](https://vercel.com/blog/how-we-built-the-v0-ios-app) — Vercel's mobile companion for AI-generated UI (requires iOS app install)

### Key Architectural Decision: Why Not OpenClaw?
OpenClaw was evaluated as a potential orchestration layer. It provides multi-channel messaging, browser automation, and Claude Code integration via plugins. However:
- **SMS is not a first-class channel** — would require building a custom extension or using the community Clawphone plugin (voice-first, SMS secondary).
- **Claude Code already does everything** — slash commands, multi-agent orchestration, Playwright MCP, git operations. OpenClaw would be a middleman adding complexity without capability.
- **The relay is trivially simple** — ~200-300 lines of code. Not worth adding a dependency on a full orchestration platform.
- **Future consideration:** If multi-channel expansion (WhatsApp, Telegram, Discord) becomes a priority, OpenClaw's channel abstraction could accelerate that work. The backend is designed to be transport-agnostic.

### Research
- [Rahul Pandita's mobile dev experiment](https://rahulpandita.me/blog/2026-01-14-Mobile-Development) — 3-week study of phone-based development (Jan 2026)
- Competitive landscape research (conducted 2026-02-24)
- OpenClaw documentation review (conducted 2026-02-24)

### Technical References
- [Twilio SMS/MMS API documentation](https://www.twilio.com/docs/sms)
- [Twilio A2P 10DLC registration](https://www.twilio.com/docs/messaging/compliance/a2p-10dlc)
- [Playwright MCP server](https://github.com/anthropics/playwright-mcp)
- Claude Code CLI headless mode documentation
- [Cloudflare R2 documentation](https://developers.cloudflare.com/r2/) (future image storage option)
