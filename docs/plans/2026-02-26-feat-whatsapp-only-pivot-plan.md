---
phase: 4.2
condensed: true
original: archive/plans/2026-02-26-feat-whatsapp-only-pivot-plan.md
---

# Phase 4.2: WhatsApp-Only Pivot (Condensed)

**Stage:** Local Development
**Depends on:** Phase 4.1 (Web Chat Dev Tool)
**Done when:** SMS/MMS code removed from server.js, WhatsApp is the sole messaging channel, and documentation rewritten across all tiers.

## Summary

Dropped SMS/MMS support entirely to make WhatsApp the sole messaging channel. Code changes (~30 lines in server.js) removed SMS paths, renamed `/sms` to `/webhook`, hardcoded WhatsApp `from` address, and increased text limit to 4096 chars. Documentation rewrite across 25+ files in 4 tiers replaced the SMS-first product thesis with WhatsApp positioning (2B+ users, rich formatting, reliable delivery).

## Key Deliverables

- `server.js`: Removed `TWILIO_PHONE_NUMBER`, `isWhatsApp` branching, `MAX_MMS_MEDIA`; renamed endpoint `/sms` to `/webhook`; WhatsApp-only `sendMessage()` with 1-media-per-message handling
- `.env.example`: Removed `TWILIO_PHONE_NUMBER`, made `TWILIO_WHATSAPP_NUMBER` required
- PRD renamed to `PRD_WHATSAPP_AGENTIC_COCKPIT.md` with full thesis rewrite
- CLAUDE.md, README.md, ARCHITECTURE.md, phase overview, competitive analysis all updated
- Documented 24-hour session window as a known limitation affecting Phases 9, 14, 15

## Key Technical Decisions

- **WhatsApp-only (not dual-channel)**: Simpler codebase, eliminates SMS-specific constraints (160-char segments, 1MB MMS, carrier testing, A2P 10DLC)
- **Endpoint rename `/sms` to `/webhook`**: Transport-agnostic naming since `forwardToVM()` is already transport-agnostic
- **4-tier documentation approach**: Full rewrite (PRD), significant edits (CLAUDE.md, README, ARCHITECTURE), light edits (phase plans), terminology-only (security, contributing)
- **24-hour session window deferred**: Resolution requires Meta Business verification + approved template messages, a production concern for Stage 2+

## Status

Completed
