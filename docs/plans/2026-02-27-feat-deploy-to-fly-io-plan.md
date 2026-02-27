---
phase: 7
condensed: true
original: archive/plans/2026-02-27-feat-deploy-to-fly-io-plan.md
---

# Phase 7: Deploy to Fly.io (Condensed)

**Stage:** Production
**Depends on:** Phase 6 (E2E Local)
**Done when:** Send a WhatsApp message with laptop closed and receive a response; cold start sends "Waking up..." then processes successfully.

## Summary

Deployed the WhatsApp Agentic Cockpit to Fly.io with two Machines: an always-on relay server (~$3-5/month) and an auto-stop VM with persistent Volume storage (~$4-7/month active). Uses Flycast private networking for relay-to-VM communication with auto-start capability. Cold start UX sends a "Waking up..." acknowledgment then polls `/health` every 3s for up to 30s.

## Key Deliverables

- Relay Dockerfile (Node.js slim, 3 deps) and `fly.toml` (always-on, public HTTPS, 512MB)
- VM `fly.toml` (auto-stop, Flycast-only, 2GB RAM, Volume at `/data`)
- `IMAGES_DIR` env var in VM server (configurable `/tmp/images` vs `/data/images`)
- Cold start retry loop in relay: health-check polling every 3s for 30s with "Waking up..." message
- SIGTERM graceful shutdown handler on relay
- 5-phase deploy sequence: code changes, relay Dockerfile, Fly config, deploy (VM first, then relay), Twilio webhook cutover

## Key Technical Decisions

- **Flycast (not `.internal` DNS)**: `.internal` bypasses Fly Proxy so stopped VMs won't auto-start; Flycast routes through Fly Proxy enabling auto-start
- **60-min VM idle timeout**: Outlasts the 30-min approval window to prevent VM shutdown during code review
- **VM private-only**: Public IPs released after deploy, Flycast allocated; `/command` endpoint not publicly accessible
- **Image persistence via Volume**: Fly Volume at `/data` persists screenshots across VM stop/start cycles; `IMAGES_DIR` configurable via env
- **Ephemeral working directory (MVP limitation)**: Git repos lost on VM stop; only `/data/images` persists; repo persistence deferred

## Status

Completed
