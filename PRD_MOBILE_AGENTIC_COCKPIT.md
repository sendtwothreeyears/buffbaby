# PRD: iMessage Agentic Development Cockpit

**Author:** Emmanuel
**Date:** 2026-02-24
**Status:** Draft
**Last Updated:** 2026-02-24
**Model:** Fully cloud-hosted service — users need only an iPhone and internet connection

---

## Problem Statement

_Software engineers using agentic workflows (Claude Code, Codex CLI, Gemini CLI) are tethered to their laptops. The entire agentic development lifecycle — commanding agents, reviewing diffs, previewing apps, triggering deployments — requires a desktop terminal and IDE. There is no way to orchestrate these workflows from a phone, despite the fact that the engineer's role in an agentic workflow is fundamentally about directing, reviewing, and approving — tasks that don't require a full desktop environment._

_iMessage is the most natural interface on a phone. Engineers already live in it. Instead of building yet another app, we put the entire agentic development workflow inside the conversation they're already having — their Messages app. Everything stays in the thread: status updates as text, code diffs as syntax-highlighted images, app previews as screenshots, approvals as simple text replies. No app to install. No browser to open. The conversation thread becomes the project log._

**Who** is affected:
Software engineers who already use agentic development workflows (Claude Code slash commands, multi-agent reviews, compound engineering patterns). Specifically, engineers in bootcamps, startups, and teams who want to stay productive from anywhere — commutes, couches, coffee shops — without carrying a laptop. They need only an iPhone and an internet connection. No laptop, no Mac, no personal server, no hardware of any kind.

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
- The gap is clear: no tool puts agentic workflow orchestration inside the interface engineers already use every day — iMessage.
- Claude-Code-Remote proved the concept works via Telegram/Discord. iMessage is the missing — and most natural — transport for iOS engineers.

**Evidence** (data, quotes, research):
- Replit Mobile hit #1 on the App Store (Developer Tools) — demand for mobile dev is real.
- Rahul Pandita's experiment (Jan 2026): 70% of feature dev work done from a phone over 3 weeks, but identified gaps in touch-first design, code review UX, and agent orchestration visibility.
- Claude Code Remote Control, Kibbler, Moshi, Claude-Code-Remote (Telegram/Discord) all emerged within months of each other — the ecosystem is racing to solve this.
- No existing tool targets engineers who already know agentic workflows. Every tool either targets beginners (Replit, Lovable) or is a raw terminal (SSH + tmux).
- iMessage is the default messaging layer on every Apple device — iPhone, iPad, Mac, Apple Watch. Building on iMessage means the interface works everywhere Apple does, with zero installation.

---

## Goals & Success Metrics

_What does success look like? Define measurable outcomes, not outputs._

| Goal | Metric | Target |
|------|--------|--------|
| Engineers can run agentic workflows via iMessage | % of slash commands executable via iMessage | 100% of existing commands |
| Reduce time-to-action on agent output | Time from agent completion to engineer review/approval | < 60 seconds (iMessage notification is instant) |
| App preview is visible without leaving iMessage | Engineer receives app screenshots (mobile + desktop viewport) in thread | Screenshots delivered within 5 seconds of code change |
| Code review is viable without leaving iMessage | Engineer can review syntax-highlighted diff images and reply to approve/reject | Diff images are readable, pinch-to-zoom, cover all changed files |
| Engineers adopt iMessage as a real workflow surface | % of agentic sessions initiated via iMessage (among active users) | 40%+ within 3 months |
| Conversation thread serves as project log | Engineers can scroll back through iMessage to see full session history | All commands, responses, images, and screenshots preserved in thread |
| Zero-app experience | Engineer never needs to leave iMessage during a workflow | 95%+ of interactions are text replies or image review within the thread |

**Anti-goals** (what we are NOT optimizing for):
- We are NOT building a native app or any web pages. iMessage is the entire interface. Diffs are images. Previews are screenshots. Approvals are text replies.
- We are NOT building a mobile IDE or code editor. The agent writes code; the engineer directs and reviews.
- We are NOT targeting non-technical users. This is for engineers who already understand agentic workflows, git, and deployment.
- We are NOT replacing the desktop experience. iMessage is a complementary surface for when you're away from your laptop.
- We are NOT building our own AI model or agent. We orchestrate existing CLIs (Claude Code, Codex, Gemini).
- We are NOT building cross-platform messaging support in V1. iMessage only. Other transports (Telegram, Discord, SMS) are future considerations.
- We are NOT requiring the engineer to open Safari, a browser, or any other app. Everything happens in the Messages thread.

---

## Target Users

_Who specifically are we building this for? Be precise — not "everyone."_

**Primary user:**
- Description: Software engineers (bootcamp students, junior-to-senior devs) who actively use Claude Code and agentic workflows in their development process. They understand slash commands, multi-agent reviews, git workflows, and deployment pipelines. They use iPhones.
- Key needs: Run `/ship`, `/team_three_review`, `/investigate` and other agentic commands from their phone. See live preview of the app. Review diffs. Approve deployments. Stay productive without a laptop — all without installing a new app or owning any hardware beyond their phone.
- Current workaround: SSH into a remote machine via Blink Shell or Termux, run Claude Code in tmux. Or use Claude Code Remote Control (basic, requires laptop running). All workarounds require owning and maintaining additional hardware. Clunky, no rich UI, no live preview, no contextual notifications.

**Secondary user:**
- Description: Engineering team leads who want visibility into agent activity across a team's projects — what's being built, reviewed, deployed — from their phone.
- Key needs: Monitor multiple agent sessions, review PRs created by agents, approve deployments. Could participate via group iMessage threads tied to projects.

---

## Scope

### In Scope (Requirements)

_Prioritize ruthlessly. Not everything is P0._

**P0 — Must have (launch blockers):**
- [ ] Web-based onboarding: engineer signs up at service website with phone number, connects GitHub via OAuth, enters API keys (BYOK). No hardware required — just a browser for one-time setup (can even do this on their phone in Safari).
- [ ] Cloud-hosted iMessage relay: service-operated Mac instances (Mac Stadium / AWS EC2 Mac) running Messages.app, receiving and sending iMessages on behalf of the service. Engineer texts a service-owned phone number — they never know or care about the infrastructure behind it.
- [ ] Cloud VM provisioning: on-demand VMs (Railway / Fly.io / AWS) with Claude Code CLI, git, Node.js, and a dev server. Spun up per user/session, auto-hibernated on inactivity, torn down after configurable idle period.
- [ ] Text command input: engineer sends text messages (including slash commands) via iMessage to control Claude Code
- [ ] Voice message transcription: engineer sends voice messages via iMessage, server transcribes (Whisper) and routes as commands
- [ ] Agent output as text messages: Claude Code responses sent as iMessage replies — concise status updates, phase progress, and plain-text summaries
- [ ] Diff images: server renders syntax-highlighted diffs as PNG images and sends them as photos in iMessage (one image per file, pinch-to-zoom)
- [ ] App preview screenshots: server captures screenshots of the running app via headless browser (Puppeteer/Playwright) and sends them as photos in iMessage — both mobile viewport (390px) and desktop viewport (1440px)
- [ ] Text-based approvals: engineer replies "approve", "reject", "A", "B", etc. to make decisions — no buttons, no links, just text
- [ ] GitHub integration: connect to repos, clone branches, create PRs — all triggered via iMessage commands
- [ ] Session management: start/stop development sessions via iMessage ("start session authentic-frontend main", "stop session")

**P1 — Important (needed soon after launch):**
- [ ] Conversational app interaction: engineer texts "show me the settings page" or "click the login button" → server navigates/clicks in headless browser → sends new screenshot
- [ ] Multi-agent status updates: when running `/team_three_review`, iMessage updates show each agent's progress ("Agent 3/6 complete: Gemini critical review done")
- [ ] CI/CD status: after PR creation, iMessage sends build/deploy status updates ("GitHub Actions: passed. Deployed to staging.")
- [ ] Change summaries: AI-generated plain-language explanation of what changed and why, sent as text before the diff images
- [ ] Slash command help: text "/help" to get a list of available commands with descriptions
- [ ] Session history: text "/history" to get a summary of recent sessions, branches, and PRs
- [ ] Review summary images: server renders a visual summary of review findings (blockers, warnings, suggestions) as an image
- [ ] Safari fallback links: optionally include tap-through URLs alongside images for engineers who want to interact with the live preview or diff viewer in a browser

**P2 — Nice to have (future consideration):**
- [ ] Group iMessage threads: tie a group thread to a project — multiple engineers see agent activity, can issue commands
- [ ] Native iOS app: a dedicated app for richer interaction — embedded webviews, multi-pane layout, persistent dashboard. Built on top of the same backend.
- [ ] Multi-project management: manage multiple repos/VMs from different iMessage threads (one thread per project)
- [ ] Cost tracking: text "/cost" to see token usage and VM cost for current session
- [ ] Workflow builder: text "/create-command" to define a new slash command via conversation
- [ ] Language overloading triggers: voice-activated trigger words ("loopy", "triple force") transcribed and recognized
- [ ] Apple Watch: approval notifications on your wrist — tap to approve/reject
- [ ] Tapback reactions as commands: react to an agent message with a thumbs-up to approve, thumbs-down to reject
- [ ] Animated GIF previews: instead of static screenshots, send short screen recordings as GIFs showing interactions or animations
- [ ] Side-by-side before/after screenshots: send a composite image showing the app before and after the agent's changes

### Out of Scope (Non-Goals)

_Explicitly state what we will NOT build. This section prevents scope creep._

- A native iOS app in V1. iMessage is the entire interface. A native app is a P2 consideration, built on the same backend.
- A mobile code editor. Engineers will not type code on their phone. The agent writes code; the engineer reviews via diff images in the thread.
- Support for non-Claude-Code agents (e.g., Devin, Replit Agent). We build on Claude Code, Codex CLI, and Gemini CLI.
- Android / non-Apple support in V1. iMessage is Apple-only. Cross-platform messaging (Telegram, Discord, SMS) is a future consideration.
- Offline mode. This product requires an internet connection to communicate with the VM.
- Self-hosted VM management. V1 uses a managed cloud provider. Users don't manage infrastructure.
- Real-time streaming inside iMessage. iMessage delivers complete messages, not character-by-character streams. Agent progress is sent as periodic status updates ("Phase 2 of 11 complete...").
- Web pages as a primary interface. Safari/browser is an optional fallback, not the default experience. The default is: text + images + screenshots, all inside iMessage.

---

## User Flows

_Describe the key interactions from the user's perspective. Include the happy path and important edge cases._

**Flow 1: Start a new development session**
1. User sends iMessage: "start session authentic-frontend main"
2. System replies: "Provisioning VM... Cloning authentic-frontend (branch: main)... Installing dependencies..."
3. System replies: "Session ready. Dev server running. Here's your app:"
4. System sends: 📎 [image: app-screenshot-mobile.png] 📎 [image: app-screenshot-desktop.png]
5. System replies: "Type /help for available commands."
6. User is ready to issue commands — never left iMessage

**Flow 2: Run an agentic workflow**
1. User sends iMessage: "/ship add a dark mode toggle to the settings page"
2. System replies: "Starting /ship workflow (11 phases). I'll text you at each milestone."
3. System replies: "[1/11] Planning complete. Will modify: SettingsPage.tsx, theme.ts, ThemeContext.tsx. Adding: dark-mode.test.ts"
4. System replies: "[3/11] Implementation done. 4 files changed, +187 lines."
5. System sends diff images: 📎 [image: diff-theme.ts.png] 📎 [image: diff-SettingsPage.tsx.png] 📎 [image: diff-ThemeContext.tsx.png] 📎 [image: diff-dark-mode.test.ts.png]
6. System sends updated app screenshots: 📎 [image: app-after-mobile.png] 📎 [image: app-after-desktop.png]
7. System replies: "[5/11] Review complete. 0 blockers, 1 suggestion (unused import in theme.ts). Auto-fixing..."
8. System replies: "[8/11] All fixes applied. Ready to create PR. Reply 'approve' to create PR, or 'reject' to undo."
9. User replies: "approve"
10. System replies: "PR #47 created: 'Add dark mode toggle to settings page'. GitHub Actions: building... passed. Deployed to staging."
11. System sends staging screenshot: 📎 [image: staging-screenshot.png]

**Flow 3: Voice-driven workflow**
1. User holds the iMessage record button and speaks: "investigate why the checkout page is returning 500 errors on the payments endpoint"
2. System transcribes and replies: "Heard: 'investigate why the checkout page is returning 500 errors on the payments endpoint'. Starting /investigate..."
3. System replies: "Spawned 3 investigation agents (Claude, Codex, Gemini). Running in parallel..."
4. System replies (2 min later): "Agent 1/3 complete (Claude): suspects null reference in paymentService.ts"
5. System replies (3 min later): "All 3 agents complete. Synthesizing findings..."
6. System replies: "Root cause: missing null check in paymentService.ts:47 when payment provider returns empty response. All 3 agents agree."
7. System sends: 📎 [image: diff-paymentService.ts.png]
8. System replies: "Reply 'fix' to apply the fix, or 'show more' for the full investigation report."
9. User replies: "fix"
10. System replies: "Fix applied. PR #48 created. Here's the app now:"
11. System sends: 📎 [image: app-checkout-fixed.png]

**Flow 4: Review code changes**
1. User receives iMessage: "/team_three_review complete. 14 findings across 6 agents."
2. System sends review summary: "3 blockers | 5 important | 6 suggestions"
3. System sends: 📎 [image: review-summary.png] — a visual summary card showing findings grouped by severity
4. System lists blockers inline:
   "BLOCKERS:
   1. Race condition in auth.ts:92 (flagged by Claude + Codex)
   2. Missing input sanitization in form.tsx:31
   3. SQL injection risk in query.ts:18"
5. System sends diff images for each blocker: 📎 [image: blocker-1-auth.ts.png] 📎 [image: blocker-2-form.tsx.png] 📎 [image: blocker-3-query.ts.png]
6. User reviews images (pinch-to-zoom), then replies: "fix blockers"
7. System replies: "Fixing 3 blockers... Done. All tests passing."
8. System sends updated diff images showing the fixes
9. User replies: "approve"
10. System replies: "PR #50 created with all fixes."

**Flow 5: Conversational app interaction**
1. User sends: "show me the settings page"
2. System sends: 📎 [image: app-settings-mobile.png] 📎 [image: app-settings-desktop.png]
3. User sends: "click the dark mode toggle"
4. System sends: 📎 [image: app-settings-dark-mode-on.png]
5. User sends: "looks good. now show me the login page in dark mode"
6. System sends: 📎 [image: app-login-dark-mode-mobile.png] 📎 [image: app-login-dark-mode-desktop.png]

**Flow 6: Quick commands**
1. User sends: "/compushar fix login validation bug"
2. System replies: "Committed: 'fix: add null check to login validation'. Pushed to branch aut-92-login-fix. PR #49 created."
3. System sends: 📎 [image: diff-loginValidation.ts.png]

**Flow 7: Session management**
1. User sends: "status"
2. System replies: "Active session: authentic-frontend (branch: aut-92-login-fix). VM running for 47 min. 3 PRs created this session. Dev server healthy."
3. System sends: 📎 [image: app-current-state.png]
4. User sends: "stop session"
5. System replies: "Session stopped. VM hibernated. Resume anytime with 'resume authentic-frontend'."

**Edge cases to handle:**
- VM goes to sleep or is terminated mid-workflow — iMessage: "Your session was interrupted. Last state saved at commit abc123. Reply 'resume' to pick up where you left off."
- Network interruption on phone — agent keeps working on VM. All iMessage updates queue and deliver when connection resumes. Screenshots are generated and queued too.
- Agent gets stuck (thrashing detection) — iMessage: "Agent may be stuck (3 failed attempts on the same issue). Reply 'fresh' to spawn a fresh agent, or 'stop' to cancel."
- Multiple workflows running simultaneously — each update is prefixed with the workflow name: "[/ship] Phase 4 complete..." "[/investigate] Agent 2/3 done..."
- Large diffs (100+ files) — system sends summary text + a composite overview image showing all file names and change counts, then asks "Reply 'show auth.ts' to see a specific file's diff"
- Voice message is unclear — system replies: "I heard: 'fix the log in paje'. Did you mean: 'fix the login page'? Reply 'yes' or re-record."
- User sends a message while a workflow is running — system queues it and replies: "I'm currently running /ship (Phase 6/11). I'll process your next command when this completes. Reply 'cancel' to stop the current workflow."
- Too many images in thread — system batches diff images into a single composite image when > 5 files change, with an option to "Reply 'show [filename]' for individual diffs"

---

## Technical Considerations

_Non-functional requirements and constraints. Don't prescribe implementation — describe what the solution must satisfy._

- **Performance:** iMessage text responses must be sent within 5 seconds of agent output. Screenshots and diff images must be generated and sent within 10 seconds of code changes (headless browser rendering + image compression + iMessage delivery). VM provisioning must complete in under 90 seconds.
- **Image quality:** Diff images must be high-resolution enough to read code when pinch-to-zoomed on iPhone (minimum 2x retina, ~750px wide for mobile viewport). App screenshots must capture at both mobile (390px) and desktop (1440px) viewports. Images should be compressed (PNG for diffs with sharp text, JPEG for app screenshots) to stay under iMessage size limits.
- **Security:** All communication between the relay server and VMs must be encrypted (TLS/WSS). API keys for Claude, Codex, Gemini must never leave the VM. GitHub tokens use OAuth with minimal scopes. iMessage thread authentication: only registered phone numbers can issue commands (allowlist).
- **Scalability:** Each user gets their own isolated VM. The relay server must handle concurrent users without cross-contamination. VMs should auto-hibernate after inactivity to reduce cost. The Mac relay server is a bottleneck — must plan for Mac Mini cluster or Mac Stadium hosting for scale.
- **Integrations:** iMessage (via Messages framework or AppleScript on macOS relay server), GitHub (repos, PRs, Actions), Claude Code CLI, Codex CLI, Gemini CLI, Puppeteer or Playwright (screenshot capture + diff rendering on VM), Whisper (voice transcription on relay server), Vercel / Railway / Fly.io (deployment).
- **Reliability:** The VM must keep running even if the phone disconnects. Agent workflows must be resilient to relay server restarts — use a persistent job queue. iMessage delivery is best-effort (Apple infrastructure). Screenshots and status updates are queued and delivered in order when connection resumes.
- **Accessibility:** Voice transcription must handle programming terminology (function names, file paths, slash commands). Diff images must use high-contrast color schemes readable in both light and dark mode. Font size in rendered images must be configurable per user (reply "/settings font large").

---

## Architecture Overview

_Fully cloud-hosted service. The engineer owns nothing but a phone._

```
┌─────────────────────────────────────────────────┐
│              ENGINEER'S iPHONE                    │
│              (the ONLY thing they own)            │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │               iMessage                       │ │
│  │                                              │ │
│  │  You: /ship add dark mode                    │ │
│  │                                              │ │
│  │  Bot: [1/11] Planning complete.              │ │
│  │  Modifying: theme.ts, SettingsPage.tsx       │ │
│  │                                              │ │
│  │  Bot: [3/11] Implementation done.            │ │
│  │  4 files changed, +187 lines.                │ │
│  │                                              │ │
│  │  📎 [diff-theme.ts.png]                      │ │
│  │  📎 [diff-SettingsPage.tsx.png]              │ │
│  │  📎 [app-screenshot-mobile.png]              │ │
│  │  📎 [app-screenshot-desktop.png]             │ │
│  │                                              │ │
│  │  Bot: Reply 'approve' to create PR.          │ │
│  │                                              │ │
│  │  You: approve                                │ │
│  │                                              │ │
│  │  Bot: PR #47 created. Build passed.          │ │
│  │  📎 [staging-screenshot.png]                 │ │
│  │                                              │ │
│  └─────────────────────────────────────────────┘ │
│           Everything stays in the thread          │
└──────────────────┬───────────────────────────────┘
                   │ iMessage (text + images + voice)
                   │ (via Apple's iMessage infrastructure)
                   ▼
┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
  ALL INFRASTRUCTURE BELOW IS CLOUD-HOSTED
│ OWNED AND OPERATED BY THE SERVICE                │
│ THE USER NEVER SEES, TOUCHES, OR MANAGES ANY OF IT
 ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─

┌──────────────────────────────────────────────────┐
│           CLOUD MAC RELAY CLUSTER                 │
│           (Mac Stadium / AWS EC2 Mac)             │
│           Operated by service, not the user       │
│                                                   │
│  ┌───────────────┐  ┌─────────────────────────┐  │
│  │ Messages.app   │  │ Relay Service           │  │
│  │ (receive/send  │  │ - Parse incoming msgs   │  │
│  │  iMessages)    │→ │ - Authenticate user by  │  │
│  │               │  │   phone number           │  │
│  │               │← │ - Route to user's VM     │  │
│  └───────────────┘  │ - Whisper transcription  │  │
│                      │ - Format text replies    │  │
│                      │ - Send images back       │  │
│                      └──────────┬──────────────┘  │
│                                 │                 │
│  ┌──────────────────────────────┘                 │
│  │ Job Queue (persistent)                         │
│  │ - Track active workflows per user              │
│  │ - Queue status updates + images                │
│  │ - Handle retries                               │
│  │ - Manage user sessions + VM lifecycle          │
│  └──────────────────┬────────────────────────┐   │
│                     │                         │   │
│  ┌──────────────────┘                         │   │
│  │ User Database                              │   │
│  │ - Phone number → user mapping              │   │
│  │ - GitHub OAuth tokens (encrypted)          │   │
│  │ - API keys (encrypted, user-provided)      │   │
│  │ - Session state, preferences               │   │
│  │ - Usage tracking for billing               │   │
│  └────────────────────────────────────────┐  │   │
│                                            │  │   │
└────────────────────────────────────────────┼──┘   │
                                             │       │
                      HTTPS / WSS            │       │
                                             ▼       │
┌──────────────────────────────────────────────────┐
│           CLOUD VM (per user/session)             │
│           (Railway / Fly.io / AWS)                │
│           Provisioned on demand, auto-hibernates  │
│                                                   │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐ │
│  │ Claude Code │  │ Codex CLI  │  │ Gemini CLI │ │
│  │ CLI         │  │ (optional) │  │ (optional) │ │
│  └─────┬──────┘  └────────────┘  └────────────┘ │
│        │                                         │
│  ┌─────▼──────┐  ┌──────────────────────────┐   │
│  │ Git repo   │  │ Dev server (next/vite)    │   │
│  │ (cloned    │  │         +                 │   │
│  │  from      │  │ Headless browser          │   │
│  │  user's    │  │ (Puppeteer/Playwright)    │   │
│  │  GitHub)   │  │ - Captures screenshots    │   │
│  └────────────┘  │ - Renders diff images     │   │
│                  │ - Navigates on command     │   │
│                  └──────────────────────────┘    │
│                                                   │
│  User's API keys loaded from encrypted store      │
│  VM is ephemeral — all state lives in git          │
└──────────────────────────────────────────────────┘
```

### Onboarding Flow (one-time setup)

```
1. Engineer visits service website on their phone
2. Signs up with phone number (SMS verification)
3. Connects GitHub account (OAuth — standard "Authorize" flow)
4. Enters API keys: Claude (required), Codex (optional), Gemini (optional)
5. Receives an iMessage: "You're set up. Text me to start.
   Try: start session [repo-name] [branch]"
6. Done. From now on, everything happens in iMessage.
```

### Service Model

```
WHAT THE USER PROVIDES:          WHAT THE SERVICE PROVIDES:
─────────────────────────        ──────────────────────────
- iPhone with iMessage           - Cloud Mac relay cluster
- Internet connection            - On-demand cloud VMs
- GitHub account                 - Claude Code CLI (pre-installed)
- API keys (BYOK)               - Puppeteer/Playwright
- Monthly subscription           - Whisper transcription
                                 - Image rendering pipeline
                                 - Job queue + session management
                                 - All infrastructure + ops
```

---

## Assumptions & Constraints

**Assumptions** (things we believe to be true but haven't fully validated):
- Engineers are willing to review code diffs via pinch-to-zoom on syntax-highlighted images in iMessage
- Syntax-highlighted diff images at retina resolution are readable enough for meaningful code review on a phone screen
- Voice message transcription quality (Whisper) is sufficient for programming commands, slash command names, and file paths
- iMessage's message delivery latency is acceptable for development workflows (typically < 1 second for text, < 5 seconds for images)
- The conversational screenshot pattern ("show me the settings page" → screenshot) is sufficient for app preview without a live browser
- Engineers prefer using an interface they already have (iMessage) over downloading a new app
- Claude Code CLI can be reliably driven headlessly from a relay server (`claude -p` / headless mode)
- iMessage can handle the volume of images generated during a development session without degradation (estimated 20-50 images per hour during active development)

**Constraints** (hard limits — budget, timeline, legal, technical):
- iMessage is Apple-only. This product only works for iPhone/iPad/Mac users in V1.
- iMessage integration requires Mac hardware running Messages.app. This is service-operated infrastructure (Mac Stadium / AWS EC2 Mac), NOT user-owned hardware. Cost is absorbed by the service and passed to users via subscription.
- Cloud VM costs must be managed aggressively — auto-hibernate after 15 min inactivity, hard session limits (e.g., 4 hours), and usage-based billing to users.
- Claude Code, Codex CLI, and Gemini CLI all require API keys with usage-based pricing — BYOK (bring your own key) for V1 so users control their own AI spend. Managed keys are a future revenue opportunity.
- iMessage has no official bot/business API for consumers. The relay must use Messages.app on macOS. Apple Messages for Business is an alternative path that doesn't require Mac hardware but requires Apple approval. Both paths should be explored.
- iMessage messages are limited in formatting — no markdown rendering, no syntax highlighting in text. All visual content (diffs, app previews, review summaries) must be rendered as images on the server and sent as photos.
- No App Store review needed (no app to review), but Apple could theoretically restrict iMessage automation at scale.
- iMessage has file size limits for attachments. Images must be compressed appropriately. Very large diffs may need to be split across multiple images or summarized.
- Service requires upfront infrastructure investment (cloud Macs + VM capacity) before generating revenue.

**Dependencies** (external teams, services, or decisions we're waiting on):
- Claude Code CLI stability and headless mode compatibility (Anthropic)
- Cloud Mac hosting provider selection (Mac Stadium vs AWS EC2 Mac vs MacinCloud vs Scaleway)
- Cloud VM provider selection (Railway vs Fly.io vs AWS vs GCP) — must support fast provisioning and hibernation
- GitHub OAuth app approval for repo access
- Whisper model for server-side voice transcription
- Apple Messages for Business application (alternative to Mac relay — explore in parallel)

---

## Open Questions & Risks

_Flag what you don't know yet. Better to surface uncertainty than bury it._

| Question / Risk | Owner | Status | Resolution |
|-----------------|-------|--------|------------|
| Is iMessage automation (via Messages.app on a cloud Mac) reliable and scalable enough for a production service? | Emmanuel | Open | Prototype on Mac Stadium or AWS EC2 Mac. Stress test with 10, 50, 100 concurrent conversations. |
| Does Apple's ToS permit automated iMessage responses as a commercial service? | Emmanuel | Open | Legal review. Explore Apple Messages for Business as the compliant path. If gray area, start with invite-only beta to stay under the radar while validating demand. |
| Can Claude Code CLI be driven headlessly (`claude -p`, `claude --headless`) at sufficient reliability for all 11 slash commands? | Emmanuel | Open | Extensive testing required. Some commands spawn sub-agents that may behave differently headlessly. |
| Will Whisper accurately transcribe programming terminology in voice messages? (e.g., "slash ship", "paymentService.ts", "ngrok") | Emmanuel | Open | Test with 50+ sample voice commands from bootcamp engineers. |
| What's the right VM provider for cost, speed, and reliability? (Railway vs Fly.io vs AWS vs GCP) | Emmanuel | Open | Benchmark provisioning time and cost per session. Target: < 90 sec provision, < $0.10/hour per VM. |
| What's the right cloud Mac provider? (Mac Stadium vs AWS EC2 Mac vs MacinCloud) | Emmanuel | Open | Benchmark: cost per Mac instance, Messages.app reliability, concurrent conversation capacity per instance. |
| What's the minimum viable pricing model that covers infrastructure costs? | Emmanuel | Open | Estimate: cloud Mac (~$100/mo shared across users) + VM (~$0.05-0.15/hr per user session). Need to model unit economics. |
| How do we handle API key management — BYOK for V1, managed keys later? | Emmanuel | Open | BYOK for V1 to avoid cost liability. Managed tier is a future revenue model. |
| What happens when a long-running workflow (e.g., `/ship` — 30+ min) exceeds VM idle timeout? | Emmanuel | Open | Need keep-alive mechanism or workflow-aware hibernation. Active workflows should prevent auto-hibernate. |
| Can a single cloud Mac handle 50+ concurrent iMessage conversations? Or do we need a cluster? | Emmanuel | Open | Load testing required. If 1 Mac handles ~20 conversations, plan for 3-5 Macs at launch. |
| What happens if Apple blocks or rate-limits automated iMessage sending? | Emmanuel | Open | Fallback plan: SMS (via Twilio), or pivot to Telegram/Discord/WhatsApp, or build a lightweight native app. Same backend powers all transports. |
| How do we securely store user API keys and GitHub tokens in a multi-tenant cloud service? | Emmanuel | Open | Encrypted at rest (AES-256), per-user encryption keys, never stored in plain text, never logged. Standard practice but must be implemented correctly. |
| What's the upfront infrastructure investment to launch the beta? | Emmanuel | Open | Estimate needed: 1-2 cloud Macs + VM capacity for 10 beta users. See Cost Model section. |

---

## Timeline & Milestones

| Milestone | Target Date | Notes |
|-----------|-------------|-------|
| PRD approved | TBD | This document |
| Architecture design complete | TBD | Cloud Mac provider, VM provider, job queue, image pipeline |
| Provision cloud Mac instance | TBD | Rent a Mac from Mac Stadium or AWS. Set up Messages.app with a dedicated phone number. |
| iMessage relay prototype | TBD | Receive an iMessage on cloud Mac, echo it back. Prove the plumbing works over cloud infrastructure. Send a test image. |
| Cloud VM provisioning pipeline | TBD | Spin up a VM on demand, clone a GitHub repo, start a dev server. Tear down on idle. |
| Claude Code headless integration | TBD | Send a command to Claude Code on cloud VM via relay, get the result back as iMessage |
| Screenshot pipeline | TBD | Puppeteer on VM captures app screenshots, sends to relay, relay sends via iMessage |
| Diff image pipeline | TBD | Syntax-highlighted diff rendering to PNG on VM, sent via relay as iMessage photos |
| Voice message transcription | TBD | Whisper integration on cloud Mac, transcribe voice → command |
| Onboarding website | TBD | Sign up, connect GitHub, enter API keys. Simple web form. |
| End-to-end flow working | TBD | Full loop: sign up → text service number → start session → run /ship → get diffs + screenshots → approve → PR created. All from phone. |
| Beta launch (invite-only, bootcamp cohort) | TBD | 10 engineers using it for real development work. Monitor costs and reliability. |
| Stability + polish | TBD | Error handling, edge cases, session management, image quality tuning |
| Cost model validated | TBD | Confirm unit economics work — infrastructure cost per user per hour is sustainable |
| Wider launch (invite codes) | TBD | Expand beyond bootcamp cohort |

---

## Rollout Strategy

_How will we release this? All at once, phased, A/B tested?_

- **Rollout approach:** Phased, validating each layer before adding the next. No app to ship — just cloud infrastructure. The user only needs a phone number to start.
  - **Phase 1 (Echo):** Cloud Mac relay receives iMessages and echoes them back. Proves iMessage automation works reliably over cloud infrastructure. Send a test image to prove image delivery works.
  - **Phase 2 (Command):** Relay routes text commands to Claude Code on a VM. Agent responses come back as iMessages. Text-only, no images yet.
  - **Phase 3 (Screenshots):** Add Puppeteer/Playwright on VM. After code changes, capture app screenshots and send as photos in iMessage. Engineer can see the app without leaving the thread.
  - **Phase 4 (Diff images):** Add syntax-highlighted diff rendering. Code changes are rendered as PNG images and sent alongside screenshots. Engineer can review code in the thread.
  - **Phase 5 (Voice):** Add Whisper transcription for voice messages. Engineers can speak commands.
  - **Phase 6 (Conversational navigation):** Engineer texts "show me the login page" → server navigates headless browser → sends screenshot. Full app interaction without leaving iMessage.
  - **Phase 7 (Multi-agent):** Add status updates for parallel agent workflows (`/team_three_review`, `/investigate`). Send review summary images.
  - **Phase 8 (CI/CD):** Add deployment status updates and CI/CD integration (GitHub Actions, Vercel).
  - **Phase 9 (Polish):** Session management, error handling, `/help`, `/history`, `/cost`, group threads, image quality settings.

- **Graduation criteria** (what must be true to proceed to wider launch):
  - At least 10 engineers from the bootcamp cohort have used it for 2+ weeks
  - Engineers report being able to complete at least 50% of their agentic workflow sessions via iMessage
  - Cloud Mac relay uptime > 99% over a 2-week period
  - Zero instances of message loss or incorrect routing
  - Voice transcription accuracy > 90% for programming commands

- **Rollback plan:**
  - VMs can be torn down instantly — no persistent user state on the VM (everything is in git)
  - Cloud Mac relay can be disabled — users simply stop receiving responses. No data loss. All code is safe in GitHub.
  - If iMessage automation proves untenable (Apple blocks it), the same backend can power SMS (via Twilio), Telegram, Discord, WhatsApp, or a lightweight native app — the transport is swappable, the backend is the same.
  - User data (GitHub tokens, API keys) can be exported or deleted on request

---

## Learning & Growth

**New technology/skill being implemented:**
- macOS automation (Messages framework, AppleScript, or Shortcuts for iMessage relay)
- Server-side architecture (job queues, WebSocket communication, VM orchestration)
- Cloud VM provisioning and management (Railway / Fly.io / AWS)
- On-device or server-side ML (Whisper for voice transcription)
- Headless browser automation (Puppeteer/Playwright for screenshot capture, diff rendering, and conversational app navigation)
- Image generation pipeline (syntax-highlighted diff rendering to PNG, app screenshot capture, composite image generation)
- Claude Code headless mode and programmatic CLI control
- MCP (Model Context Protocol) server development for extending Claude Code's capabilities

**How this stretches beyond my current abilities:**
- Moving from consuming agentic workflows to building the infrastructure that serves them
- Systems architecture — VM orchestration, real-time messaging, job queues, security
- macOS-level automation — working with Messages.app programmatically, which is underdocumented territory
- Product design — creating a UX that makes complex engineering workflows feel natural in a chat thread
- Solving the "rich content in plain text" problem — rendering diffs, previews, and reviews as images that are readable and useful on a phone screen
- Building an image generation pipeline that turns code changes into visual artifacts fast enough to feel real-time

**What excites me most about this project:**
- The elegance of using iMessage — no app to build, no app to install, the interface already exists
- Proving that the phone can be a real engineering surface, not just a consumption device
- Making the agentic workflows from this repo accessible from anywhere
- Building something that genuinely doesn't exist — nobody has put agentic development workflows inside iMessage
- The potential for this to be the "interface layer" that makes all agentic engineering mobile-first

---

## Cost Model (Estimated)

_Preliminary cost estimates for running the service. All numbers are approximate and need validation._

### Infrastructure Costs (Service Operator)

| Component | Provider | Estimated Cost | Notes |
|-----------|----------|---------------|-------|
| Cloud Mac (relay) | Mac Stadium | ~$79-149/month per Mac Mini | 1 Mac may handle ~20-50 concurrent conversations. Start with 1, scale as needed. |
| Cloud Mac (relay) | AWS EC2 Mac | ~$0.65/hour (~$475/month) | More expensive but integrates with AWS ecosystem. On-demand pricing. |
| Cloud VM (per session) | Railway / Fly.io | ~$0.05-0.15/hour per VM | Auto-hibernate after idle. Average session ~1-2 hours. |
| Cloud VM (per session) | AWS EC2 (t3.medium) | ~$0.04/hour | Cheaper but more setup. |
| Database (user accounts) | Supabase / PlanetScale | Free tier → ~$25/month | User records, session state, encrypted keys |
| Whisper transcription | On relay Mac (local) | $0 (runs on Mac hardware) | Or use OpenAI Whisper API: ~$0.006/minute |
| Onboarding website | Vercel / Netlify | Free tier | Simple sign-up form |

### Cost Per User Session (Estimated)

| Component | Cost Per Hour | Notes |
|-----------|--------------|-------|
| VM compute | $0.05-0.15 | Per active session |
| Mac relay share | ~$0.01-0.05 | Amortized across concurrent users |
| Image generation | ~$0.01 | CPU cost for Puppeteer screenshots + diff rendering |
| **Total infrastructure cost** | **~$0.07-0.21/hour** | **Before AI API costs (user pays those via BYOK)** |

### Pricing Model (V1 — Beta)

| Tier | Price | Includes |
|------|-------|----------|
| **Beta (invite-only)** | Free | 10 hours/month of session time. Validates demand. |
| **Starter** | ~$19/month | 30 hours/month of session time. BYOK for AI APIs. |
| **Pro** | ~$49/month | Unlimited session time. Priority VM provisioning. Group threads. |

_Note: AI API costs (Claude, Codex, Gemini) are NOT included — users bring their own API keys (BYOK). This keeps the service affordable and avoids unpredictable AI cost pass-through._

### Upfront Investment to Launch Beta

| Item | Cost | Notes |
|------|------|-------|
| 1 Mac Stadium Mac Mini (6 months) | ~$475-900 | Relay server |
| Domain + hosting | ~$20 | Onboarding website |
| Phone number (for iMessage) | ~$5/month | Service number users text |
| VM budget (10 beta users, 3 months) | ~$200-500 | Estimated usage |
| **Total to launch beta** | **~$700-1,400** | Before any revenue |

---

## Appendix

_Links to designs, research docs, competitive analysis, technical specs, etc._

### Competitive Landscape
- [Authentic's Agentic Engineering Techniques](./README.md) — The workflow system this product exposes via iMessage
- [Claude Code Remote Control docs](https://code.claude.com/docs/en/remote-control) — Anthropic's basic remote access feature (Feb 2026)
- [Kibbler](https://kibbler.dev/) — Third-party Claude Code mobile wrapper with voice + diffs (requires app install)
- [Moshi](https://getmoshi.app/) — iOS terminal with push notifications for Claude Code (requires app install)
- [Claude-Code-Remote](https://github.com/) — Open source: control Claude Code via Telegram/Discord/Email (closest precedent)
- [Replit Mobile](https://replit.com/mobile-apps) — Closest existing product (targets non-technical audience)
- [v0 iOS app](https://vercel.com/blog/how-we-built-the-v0-ios-app) — Vercel's mobile companion for AI-generated UI

### Research
- [Rahul Pandita's mobile dev experiment](https://rahulpandita.me/blog/2026-01-14-Mobile-Development) — 3-week study of phone-based development (Jan 2026)
- Competitive landscape research (conducted 2026-02-24, see conversation history)

### Technical References
- Apple Messages framework documentation
- Whisper speech-to-text model documentation
- Cloudflare Tunnel documentation
- Claude Code CLI headless mode documentation
