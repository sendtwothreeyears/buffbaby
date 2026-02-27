---
date: 2026-02-27
topic: phase-8-provisioning
phase: 8
condensed: true
original: archive/brainstorms/2026-02-27-phase-8-provisioning-brainstorm.md
---

# Phase 8: Self-Hosted Provisioning via Deploy Wizard (Condensed)

## Summary

Designed a web-based deploy wizard that helps users deploy their own textslash stack (relay + VM) to their own Fly.io account entirely from their phone. Uses an open-source self-hosted model where each user's compute runs on their own account and bill, with a thin stateless proxy on our server to forward credentials to the Fly.io Machines API (which lacks CORS support).

## Key Decisions

- **Open-source self-hosted model**: Each user deploys to their own Fly.io account; we don't provision for them or bear compute costs.
- **Thin stateless proxy for credentials**: Fly.io Machines API has no CORS support, so browser-direct calls fail. Proxy forwards without storing/logging credentials. Open-source for auditability.
- **Phone-only end-to-end UX**: Visit wizard URL, enter credentials, click deploy -- no laptop required.
- **Two Fly.io apps per user**: Wizard creates both relay and VM apps on the user's account via Machines API.
- **CLI alternative for power users**: `npx textslash setup` shares the same provisioning logic but runs locally (not Phase 8 scope).

## Outcomes

- Five open questions identified: Docker image registry access for cross-account pulls, app naming convention, teardown UX, Fly secrets API vs CLI-only, and mobile token acquisition flow
- User flow defined as 5-step process: visit wizard, enter credentials, proxy calls Machines API, poll health endpoints, start messaging
- Centralized provisioning and CLI-only setup both evaluated and rejected for MVP in favor of the web wizard approach

## Status

Completed / Implemented in Phase 8
