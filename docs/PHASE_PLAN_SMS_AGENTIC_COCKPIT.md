# Phase Plan: SMS Agentic Development Cockpit

> **SUPERSEDED:** This file is the original flat phase plan. The canonical version is now in `docs/plans/phases/` with individual files per phase, reflecting the updated platform framing (SMS bridge to Claude Code, not a specific workflow tool). See `docs/plans/phases/00-overview.md`.

**Source PRD:** PRD_SMS_AGENTIC_COCKPIT.md
**Generated:** 2026-02-24 (original), 2026-02-25 (superseded by docs/plans/phases/)
**Method:** `/phase-prd`
**Total:** 16 phases, 27 tasks

---

## Architectural Layers

1. **Messaging layer** — Twilio SMS/MMS (inbound/outbound)
2. **Relay layer** — thin Node.js server (webhook handler + router)
3. **Compute layer** — Docker container with Claude Code + Playwright MCP
4. **Image layer** — screenshot/diff rendering + serving from VM
5. **Onboarding layer** — signup website, database, provisioning, payments

## Dependency Chain

```
Twilio → Relay → Docker/Claude Code → Playwright MCP → Image serving
                                                         ↓
                                              MMS delivery back through Twilio
```

## Core Experience

You text a command, Claude Code executes it, you get the result back as SMS/MMS. Everything else is decoration.

---

## Stage 1: Local Development

_Goal: Prove the core experience works on your Mac._
_Cost: ~$3-5/month (Twilio only)._
_Characteristics: Hardcoded `.env`, no database, no website, no payments._

### Phase 1: Echo
- **Build:** Twilio account + phone number + ngrok + minimal Node.js relay that receives an SMS and echoes it back. Send a test MMS image (any static image) to prove image delivery works.
- **Depends on:** Nothing (first phase)
- **Done when:** You text the Twilio number from your phone, you get your exact message echoed back. You receive a test image via MMS.
- **Tasks:**
  - `/ship` set up Twilio account, phone number, A2P 10DLC registration, ngrok, and a Node.js relay server that echoes incoming SMS back and sends a static test image via MMS

### Phase 2: Docker
- **Build:** Dockerfile containing Claude Code CLI, Playwright MCP, Node.js, git, Chromium. Thin HTTP API wrapper inside the container that accepts a command string and returns Claude Code's text output.
- **Depends on:** Nothing (can be built in parallel with Phase 1)
- **Done when:** `docker run` starts the container, you can `curl` the HTTP endpoint with a prompt, and Claude Code responds with text.
- **Tasks:**
  - `/ship` build Dockerfile with Claude Code CLI + Playwright MCP + Node.js + git + Chromium, expose HTTP API that accepts a command and returns Claude Code headless output

### Phase 3: Command
- **Build:** Connect the relay (Phase 1) to the Docker container (Phase 2). Relay receives SMS, forwards to Claude Code in Docker via HTTP, sends Claude Code's text response back as SMS.
- **Depends on:** Phase 1, Phase 2
- **Done when:** You text "what is 2+2" to the Twilio number, Claude Code answers, you get the answer back as SMS.
- **Tasks:**
  - `/ship` relay forwards incoming SMS text to Claude Code HTTP API in Docker container and sends the response back via Twilio SMS

### Phase 4: Screenshots
- **Build:** Claude Code uses Playwright MCP inside Docker to capture screenshots of the running dev server. Relay fetches the screenshot from the container's image endpoint and sends it via Twilio MMS.
- **Depends on:** Phase 3
- **Done when:** You text "show me the app" and receive a screenshot of the running app on your phone via MMS.
- **Tasks:**
  - `/ship` configure Playwright MCP in Docker container, add image serving endpoint, relay fetches screenshots and sends via Twilio MMS
  - `/ship` start a sample dev server (Next.js or Vite) inside the Docker container that Playwright can capture

### Phase 5: Diffs
- **Build:** Syntax-highlighted diff rendering. When Claude Code makes code changes, generate PNG images of the diffs. Relay sends them via MMS.
- **Depends on:** Phase 4 (image pipeline must already work)
- **Done when:** You text a command that changes code (e.g., "add a console.log to index.ts"), you receive a syntax-highlighted diff image on your phone.
- **Tasks:**
  - `/ship` build diff-to-PNG rendering pipeline inside Docker — capture git diff output, render as syntax-highlighted PNG, serve via image endpoint

### Phase 6: End-to-End Local
- **Build:** Full `/ship` workflow running from your phone. Text a slash command, get milestone updates as SMS, diff images and screenshots as MMS, reply "approve" to create a PR.
- **Depends on:** Phase 3, 4, 5
- **Done when:** You text `/ship add a dark mode toggle`, receive progress updates, diff images, app screenshots, reply "approve", and a PR is created on GitHub. All from your phone, all running on your Mac.
- **Tasks:**
  - `/ship` wire slash command routing — relay detects `/command` prefix and passes to Claude Code with appropriate flags
  - `/ship` implement progress update streaming — relay sends milestone SMS updates as Claude Code progresses through workflow phases
  - `/ship` implement approval flow — relay recognizes "approve"/"reject" replies and passes them to Claude Code

---

## Stage 2: Deploy to Production

_Goal: Same experience, but running in the cloud — works when your laptop is closed._
_Cost: ~$200 upfront._
_Key principle: Same Docker image, different host. Config change, not a rewrite._

### Phase 7: Deploy
- **Build:** Push the same Docker image to Fly.io. Deploy the relay server to Fly.io. Update Twilio webhook URL from ngrok to Fly.io.
- **Depends on:** Phase 6 (full local flow must work first)
- **Done when:** You close your laptop, text the Twilio number, get a response. Same experience as local.
- **Tasks:**
  - `/ship` create Fly.io app configs (fly.toml) for relay server and VM container, deploy both, update Twilio webhook URL

### Phase 8: Provisioning
- **Build:** Automated VM creation via Fly.io Machines API. A backend endpoint that accepts user credentials and creates a new Fly.io machine with the Docker image.
- **Depends on:** Phase 7
- **Done when:** You call the provisioning API with test credentials, a new Fly.io VM is created, and you can text it via the relay.
- **Tasks:**
  - `/ship` build provisioning endpoint that calls Fly.io Machines API to create per-user VMs with encrypted credentials as environment variables

### Phase 9: Onboarding
- **Build:** Simple signup page on Vercel — phone number verification (Twilio), GitHub OAuth, API key entry. Submitting the form triggers the provisioning API from Phase 8. User database on Supabase maps phone numbers to VMs.
- **Depends on:** Phase 8
- **Done when:** A test user visits the signup page, enters their info, receives a welcome SMS, and can immediately start texting commands.
- **Tasks:**
  - `/ship` build Supabase schema for user accounts — phone number, VM address, encrypted GitHub token, encrypted API keys
  - `/ship` build onboarding page on Vercel — phone verification, GitHub OAuth, API key form, triggers provisioning on submit

---

## Stage 3: Scale and Polish

_Goal: Other people can use it._
_Characteristics: Multi-user, error handling, rich features._

### Phase 10: Beta
- **Build:** Invite 10 bootcamp engineers. Monitor costs, reliability, MMS delivery across carriers (AT&T, T-Mobile, Verizon). Fix issues as they surface.
- **Depends on:** Phase 9
- **Done when:** 10 engineers have used it for 2+ weeks, completing real development work via SMS.
- **Tasks:**
  - `/ship` add logging and monitoring — track message delivery, latency, errors, Twilio costs per user
  - `/ship` add MMS image labeling/numbering to handle out-of-order delivery

### Phase 11: Conversational Navigation
- **Build:** Engineer texts "show me the settings page" or "click the login button" → Claude Code navigates via Playwright MCP → sends new screenshot.
- **Depends on:** Phase 10 (validated that basic flow works with real users)
- **Done when:** You text "show me the login page", get a screenshot. Text "click the submit button", get an updated screenshot.
- **Tasks:**
  - `/ship` implement conversational page navigation — relay passes natural language navigation commands to Claude Code, which drives Playwright MCP and returns screenshots

### Phase 12: Multi-Agent
- **Build:** Status updates for parallel agent workflows (`/team_three_review`, `/investigate`). Each agent's progress reported as separate SMS updates.
- **Depends on:** Phase 10
- **Done when:** You text `/team_three_review` and receive individual agent progress updates ("Agent 3/6 complete: Gemini critical review done") followed by a consolidated review summary.
- **Tasks:**
  - `/ship` implement multi-agent status streaming — relay parses Claude Code's multi-agent output and sends per-agent progress updates as separate SMS messages

### Phase 13: CI/CD
- **Build:** After PR creation, SMS sends build/deploy status updates from GitHub Actions, Vercel, etc.
- **Depends on:** Phase 10
- **Done when:** You approve a PR via SMS, then receive "GitHub Actions: passed. Deployed to staging." followed by a staging screenshot.
- **Tasks:**
  - `/ship` add GitHub Actions webhook listener to relay — sends build/deploy status as SMS, captures staging screenshot via Playwright and sends as MMS

### Phase 14: Polish
- **Build:** Session management, error handling, `/help`, `/history`, `/cost`, composite images for large diffs, MMS delivery order handling, thrashing detection.
- **Depends on:** Phase 10
- **Done when:** Edge cases are handled gracefully — VM restart recovery, message queuing, composite images for 10+ file diffs, clear error messages.
- **Tasks:**
  - `/ship` implement session management — "start session repo branch", "stop session", "resume", "status"
  - `/ship` implement `/help` and `/history` commands
  - `/ship` implement composite diff images — batch 5+ file diffs into a single image with "reply 'show filename' for detail"
  - `/ship` implement error recovery — VM restart detection, stale session handling, thrashing detection with "reply 'fresh' to spawn new agent"

---

## Deferred

```
DEFERRED TO STAGE 2 (Deploy):
- Fly.io deployment
- Automated VM provisioning
- Public endpoints without ngrok

DEFERRED TO STAGE 3 (Scale):
- Onboarding website
- User database (Supabase)
- Multi-user routing
- Conversational navigation
- Multi-agent status updates
- CI/CD integration
- Session management
- Error recovery
- Composite images
- /help, /history, /cost commands

DEFERRED BEYOND V1:
- Stripe payments
- Group SMS threads
- Multi-project management
- Native app
- Multi-channel expansion (WhatsApp, Telegram, Discord) _(Note: WhatsApp implemented in Phase 4.2, 2026-02-26)_
- ImageStore migration to R2/S3
```

---

## How to Execute

1. Start with Phase 1 (Echo). Validate from your phone.
2. Phase 2 (Docker) can run in parallel with Phase 1.
3. After both are validated, proceed to Phase 3 (Command).
4. Continue sequentially — each phase adds one new capability.
5. At Phase 6, you have a demoable product running locally.
6. Stage 2 is a deployment exercise, not a code change.
7. Stage 3 is where other people start using it.

Each phase is a demo. Each `/ship` task has a concrete done state. If a phase fails, you know exactly what broke because it only introduced one new thing.
