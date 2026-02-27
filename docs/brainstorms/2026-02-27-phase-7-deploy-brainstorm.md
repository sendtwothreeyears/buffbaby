---
date: 2026-02-27
topic: phase-7-deploy
phase: 7
condensed: true
original: archive/brainstorms/2026-02-27-phase-7-deploy-brainstorm.md
---

# Phase 7: Deploy to Production (Condensed)

## Summary

Designed the production deployment architecture for the WhatsApp Agentic Cockpit on Fly.io. The relay runs as an always-on Machine (~$3-5/mo) to handle Twilio webhooks instantly, while the VM runs with auto-stop and a persistent Volume (~$4-7/mo active). Fly.io Sprites were evaluated and deferred due to networking limitations and reliability concerns.

## Key Decisions

- **Relay as always-on Fly.io Machine**: Required for Twilio's 15s webhook timeout; lightweight Express server at ~$3-5/mo.
- **VM as Fly.io Machine with auto-stop + Volume**: Same Docker image as local dev; self-managed idle shutdown via existing `IDLE_TIMEOUT_MS`; Fly Proxy auto-starts on request.
- **Private networking via `.internal` DNS**: Relay-to-VM over `http://vm-app.internal:3001`; no application-level auth needed -- network isolation is the auth layer.
- **Fly Volume at `/data`**: Persistent storage for screenshots, survives stop/start cycles.
- **Cold start UX**: Relay detects ECONNREFUSED, immediately sends "Waking up..." WhatsApp message before retrying.
- **Sprites deferred**: No private networking with Machines, poor reliability (beta), no fork/clone. Analysis saved to `docs/future-plans/sprites-migration.md`.

## Outcomes

- Total estimated cost: ~$7-12/month for single-user deployment
- Eight deliverables identified: relay Dockerfile, two fly.toml configs, secrets setup, Twilio webhook update, Volume mount changes, cold start acknowledgment, production env template
- Config changes documented for local-to-production transition (PUBLIC_URL, CLAUDE_HOST, RELAY_CALLBACK_URL, image storage path)
- Git repo persistence and relay state persistence deferred to post-deploy enhancements

## Status

Completed / Implemented in Phase 7
