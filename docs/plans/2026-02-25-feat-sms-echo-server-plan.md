---
phase: 1
condensed: true
original: archive/plans/2026-02-25-feat-sms-echo-server-plan.md
---

# Phase 1: WhatsApp Echo Server with Media Test Image (Condensed)

**Stage:** Local Development
**Depends on:** None (first phase)
**Done when:** Texting the Twilio number from an allowlisted phone echoes the message back with a test image via WhatsApp.

## Summary

Built a minimal single-file Express server (`server.js`, ~50 LOC) that receives WhatsApp messages via Twilio webhook, echoes the message body back, and sends a static test image as WhatsApp media. This validated the full Twilio -> ngrok -> localhost -> Twilio round trip as proof of life for the entire pipeline.

## Key Deliverables

- `server.js` — single-file Express server with `POST /webhook` and `GET /test-image.png`
- `package.json` — Express + Twilio SDK dependencies
- `.env.example` — Twilio credentials, ngrok URL, phone allowlist
- `assets/test-image.png` — small PNG for media delivery testing

## Key Technical Decisions

- **Single-file Express server**: Throwaway code (~50 LOC), replaced in Phase 3
- **Phone allowlist from `.env`**: Simplest auth; comma-separated E.164 numbers
- **Silent drop for non-allowlisted senders**: No information leakage, console.log for debugging
- **No webhook signature validation**: Acceptable for local-only testing; deferred to Phase 3
- **Test image served via Express**: No external dependency, works through ngrok

## Status

Completed
