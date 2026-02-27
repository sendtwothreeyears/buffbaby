---
date: 2026-02-26
topic: Open-Source Release
phase: General
condensed: true
original: archive/brainstorms/2026-02-26-open-source-release-brainstorm.md
---

# Open-Source Release (Condensed)

## Summary

Planned the open-source release strategy for textslash. Decided to keep the current repo (not fork or start fresh), make it public-ready with security scrubbing and documentation, and adopt NanoClaw's best patterns (AI-native `/setup` skill, honest security docs, skills-over-features contribution model) while staying WhatsApp-only.

## Key Decisions

- **Keep current repo**: Good architecture, clean code (~220 LOC), structured docs. Additive work to make public-ready.
- **AI-native setup**: Adopted from NanoClaw -- `clone -> run claude -> /setup`. The agent IS the installer.
- **Channel abstraction**: Clean interface for future extensibility, but WhatsApp-only by design. No other platforms.
- **WhatsApp only**: Deliberate constraint, not a limitation. One deeply integrated channel is the product. Adding Discord/Telegram/Slack would dilute thesis and compete directly with NanoClaw.
- **License**: MIT.
- **Audience**: Developers first (self-host with own Twilio + Fly.io), non-technical users later as hosted service.
- **Patterns adopted from NanoClaw**: Secrets via stdin, honest SECURITY.md, key-files routing in CLAUDE.md, skills-over-features model, non-root container user.
- **Patterns deliberately different**: Twilio webhooks (not polling), persistent VMs (not ephemeral), Express HTTP server, single canonical codebase, WhatsApp-only focus.

## Outcomes

- Release checklist defined: security scrubbing (git history, credential rotation), documentation (README, ARCHITECTURE, SECURITY, CONTRIBUTING, LICENSE), developer experience (/setup skill, Channel interface, CHANGELOG)
- Positioning clarified: textslash is not competing with NanoClaw -- fills a different gap (WhatsApp-native, managed service path, full Claude Code CLI)

## Status

Completed -- release preparation ongoing, checklist items being addressed across phases.
