---
phases: 1-8
condensed: true
originals: archive/brainstorms/
---

# Phases 1–8: Brainstorm Summary

All brainstorms from the initial build-out of the WhatsApp Agentic Development Cockpit — from echo server proof-of-life through self-hosted provisioning.

---

## Phase 2: Docker VM Image

Designed a Docker image packaging the full compute environment (Claude Code CLI, Playwright, Node.js, git, Chromium) with a thin Express HTTP API. Synchronous API chosen (relay handles async). All files in `vm/` subdirectory. Node.js full base image (not slim/alpine) for Chromium compatibility. `execFile`/`spawn` over `exec` to avoid shell injection. Port 3001 to avoid relay conflict. Playwright requires `--no-sandbox` in Docker.

## Phase 3: Command — Expanded Scope

Connected relay to VM and expanded with three NanoClaw-inspired features. Async webhook pattern (200 OK immediately, process in background, reply via Twilio REST API). Message queue over concurrency guard (queue up to 5, acknowledge receipt). Session resume via `--continue` flag. Idle shutdown checks `!busy` before exiting. In-memory queue acceptable for MVP. Node 22 native `fetch` — no new HTTP client.

## Phase 4: Screenshots

Designed screenshot pipeline: Claude Code → `POST /screenshot` on VM → Playwright capture → relay proxy → Twilio media → user's phone. Playwright CLI over MCP. Dedicated VM endpoint (not Claude Code shelling out). Relay proxies images (no second ngrok tunnel). Ephemeral `/tmp/images/` with TTL cleanup. JPEG compression to <1MB. Mobile (390px) and desktop (1440px) viewports at 2x DPR. No ImageStore abstraction (YAGNI).

## Phase 4.2: WhatsApp Pivot

Twilio's WhatsApp API uses identical webhook format to SMS (just `whatsapp:` prefix on phone numbers) — ~30 lines changed. Twilio sandbox for dev (no Meta Business verification). Same `/webhook` endpoint. Detect channel from `From` field prefix. WhatsApp replaces SMS entirely. VM completely unchanged. WhatsApp advantages: monospace code blocks, 16MB media, in-order delivery, $0.005/msg.

## Phase 4.3: WhatsApp Documentation Sweep

Eliminated ~414 SMS/MMS references across ~20 files. Updated everything including historical phases to reflect WhatsApp reality. Removed A2P 10DLC, toll-free verification, carrier testing, 160-char segments, 1MB MMS ceiling. Phase 5 restructured (monospace code blocks, not PNG). WhatsApp constraints documented: 4096-char limit, 16MB media, 1 media/message, 24-hour session window.

## Phase 5: Code Diffs via WhatsApp

Three approaches evaluated: text-only, text + PNG, text + splitting. Text-only chosen for speed. Auto-detect via `git diff HEAD` after every command. 4096-char budget with truncation at file boundaries. VM server owns diff logic. Per-file diffs combined into one message. Zero new dependencies.

## Phase 6: End-to-End Local

Full local loop: message → Claude Code → progress streaming → diffs/screenshots → approval → PR. Two deliverables: progress streaming (VM POSTs callbacks to relay via `RELAY_CALLBACK_URL`) and approval state machine (idle/working/awaiting_approval). `::progress::` markers in Claude Code stdout. 30-min approval timeout. Cancel kills process group. Phone number as session ID.

## Phase 7: Deploy to Production

Relay as always-on Fly.io Machine (~$3-5/mo). VM with auto-stop + Volume (~$4-7/mo active). Private networking via Flycast (not `.internal` — Flycast routes through Fly Proxy for auto-start). Volume at `/data` for persistent screenshots. Cold start UX: "Waking up..." message then retry. Sprites deferred (no private networking, poor reliability). Total ~$7-12/month single-user.

## Phase 8: Self-Hosted Provisioning

Web deploy wizard for phone-only self-hosted setup. Open-source model: each user deploys to their own Fly.io account. Thin stateless proxy for credentials (Fly.io Machines API lacks CORS). Two apps per user (relay + VM). CLI alternative for power users. Open questions: registry access, app naming, teardown UX, secrets API, mobile token flow.

---

## General Brainstorms

### Competitive Landscape

Four products analyzed: NanoClaw/OpenClaw (general chatbots via Claude Agent SDK + Baileys), Claude Code Remote Control (requires running laptop), Remolt (browser IDE with identical infra). textslash uniquely bets on "no IDE needed" — managed service, full CLI ecosystem, WhatsApp-native engineer UX. Remolt for deep work; textslash for quick interactions.

### NanoClaw Learnings

Three MVP features adopted: session resume (`--continue`), relay-side message queue, container idle shutdown. Three deferred: scheduled tasks, mid-execution injection, explicit session IDs. All MVP features targeted Phase 3. Session resume is a one-line change. Idle shutdown leverages Fly.io auto-start.

### Open-Source Release

Keep current repo (not fork). AI-native `/setup` skill for onboarding. WhatsApp-only by design (no Discord/Telegram/Slack). MIT license. Developers self-host with own Twilio + Fly.io. Adopted from NanoClaw: secrets via stdin, honest SECURITY.md, skills-over-features model, non-root container user. Deliberately different: Twilio webhooks, persistent VMs, Express server, single codebase.
