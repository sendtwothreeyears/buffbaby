---
phases: 1-8
condensed: true
originals: archive/plans/
---

# Phases 1–8: Plan Summary

All implementation plans from the initial build-out — echo server through self-hosted provisioning. Each phase built on the previous, progressing from local development through production deployment.

---

## Phase 1: WhatsApp Echo Server

**Stage:** Local Development | **Depends on:** None | **Status:** Completed

Minimal single-file Express server (`server.js`, ~50 LOC). Receives WhatsApp via Twilio webhook, echoes message back with test image. Validated full Twilio → ngrok → localhost → Twilio round trip. Phone allowlist from `.env` (comma-separated E.164). Silent drop for non-allowlisted. No webhook signature validation (local-only). Throwaway code, replaced in Phase 3.

## Phase 2: Docker VM Image

**Stage:** Local Development | **Depends on:** Phase 1 | **Status:** Completed

Docker image with Claude Code CLI, Playwright, Node.js, git, Chromium. Express server (`vm-server.js`) with `POST /command`, `GET /health`, `GET /images/:filename`. `child_process.spawn` (no shell injection, no buffer limits). Boolean mutex concurrency guard (409 if busy). 5-min timeout with process tree kill. Path traversal protection on image serving. Fail-fast if `ANTHROPIC_API_KEY` missing.

## Phase 3: Connect Relay to VM

**Stage:** Local Development | **Depends on:** Phases 1-2 | **Status:** Completed

Replaced echo logic with real Claude Code interaction. Twilio webhook signature validation. Per-user message queue (Map, up to 5). Immediate 200 OK + async processing. AbortController fetch timeout (330s, 30s buffer over VM's 300s). Cold-start retry (wait 4s, retry once on ECONNREFUSED). `--continue` flag for session resume. Idle shutdown timer with `process.exit(0)`.

## Phase 4: Screenshots

**Stage:** Local Development | **Depends on:** Phase 3 | **Status:** Completed

`POST /screenshot` VM endpoint with Playwright capture. Mobile viewport default (390x844 @ 2x DPR). Iterative JPEG compression (start quality 80, reduce by 10 until <600KB). Browser launched per-request (~1-2s cold start). UUID filenames for security. Relay pipes VM response directly to Twilio (no disk write). `vm/CLAUDE.md` teaches Claude Code about `/screenshot`.

## Phase 4.1: Web Chat Dev Tool

**Stage:** Local Development | **Depends on:** Phase 4 | **Status:** Completed

Browser chat interface bypassing Twilio. `POST /chat` JSON API + `GET /` serving `public/index.html`. Single HTML file with inline CSS/JS. Calls same `forwardToVM()` as WhatsApp. No queuing (UI disables send while in-flight). No text truncation (no 4096-char limit). No auth (local dev tool only).

## Phase 4.2: WhatsApp Channel + Pivot

**Stage:** Local Development | **Depends on:** Phase 4.1 | **Status:** Completed

Added WhatsApp via Twilio Sandbox (~20 lines changed). Key `userState` by raw `From` (including `whatsapp:` prefix) — independent state per channel identity. Then pivoted to WhatsApp-only: removed SMS paths, renamed `/sms` to `/webhook`, hardcoded WhatsApp `from`, increased text limit to 4096 chars. Documentation rewrite across 25+ files.

## Phase 4.3: Documentation Sweep

**Stage:** Local Development | **Depends on:** Phase 4.2 | **Status:** Completed

Eliminated all SMS/MMS references from ~20 docs (~300+ refs). Docs-only, zero runtime changes. Substitution rules: SMS→WhatsApp, MMS→media, 160-char→4096-char, A2P 10DLC→Sandbox. Link path safety rule (update display text, preserve file paths). Parallelized across 5 buckets.

## Phase 5: Code Diffs

**Stage:** Local Development | **Depends on:** Phase 4 | **Status:** Completed

`git diff HEAD --no-color` after every `/command`. `collectDiffs()` helper with 2s timeout and 512KB buffer cap. `formatDiffMessage()` and `truncateAtFileBoundary()` in relay. Budget-aware sending: inline when fits, follow-up messages on overflow. Diffs returned on success, error, and timeout paths. `busy` flag moved after `res.json()` to prevent race condition.

## Phase 6: End-to-End Local

**Stage:** Local Development | **Depends on:** Phase 5 | **Status:** Completed

Full local loop. VM line-buffered stdout parser for `::progress::` and `::approval::` markers. Callbacks drained via `Promise.allSettled` before response. Relay state machine: `idle → working → awaiting_approval → idle`. Approve: VM runs Claude Code to commit + create PR. Reject: `git checkout . && git clean -fd`. Cancel: AbortController + process group SIGTERM. 30-min approval timeout.

## Phase 7: Deploy to Fly.io

**Stage:** Production | **Depends on:** Phase 6 | **Status:** Completed

Always-on relay Machine (~$3-5/mo) + auto-stop VM with Volume (~$4-7/mo). Flycast private networking (not `.internal` — needs Fly Proxy for auto-start). 60-min VM idle timeout (outlasts 30-min approval window). VM private-only (public IPs released). Volume at `/data` for screenshot persistence. Cold start: health-check polling every 3s for 30s with "Waking up..." message. SIGTERM graceful shutdown on relay.

## Phase 8: Self-Hosted Provisioning

**Stage:** Production | **Depends on:** Phase 7 | **Status:** Completed

CLI setup script + published Docker images to GHCR. Interactive `scripts/setup.sh`: prerequisite checks, credential collection, app/volume creation, secret setting, deploy, health polling. `scripts/teardown.sh` for clean removal. `--ha=false` + `fly scale count 1` for stateful single-machine apps. Flycast port 80 for inter-app communication. Phone-only deploy wizard deferred.

---

## General: Open-Source Release

**Stage:** Release Preparation | **Status:** Completed

MIT license. README rewrite, ARCHITECTURE.md, SECURITY.md, CONTRIBUTING.md, CHANGELOG.md. `.dockerignore` files. `/setup` skill for AI-native onboarding. `.github/` templates. Renamed `NGROK_URL` to `PUBLIC_URL`. Relay `GET /health` endpoint. Kept git history as-is. Skills-over-features contribution model. Honest security posture in SECURITY.md.
