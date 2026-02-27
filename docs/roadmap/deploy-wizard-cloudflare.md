# Deploy Wizard on Cloudflare Pages

**Date:** 2026-02-27
**Context:** Deferred from Phase 8 planning. The MVP ships without a deploy wizard — users deploy via CLI/manual steps. The wizard is a UX improvement for easy self-hosted setup.

## What

A web-based deploy wizard that helps users deploy their own textslash stack (relay + VM) to their own Fly.io account — entirely from their phone, no laptop required.

## Architecture

```
User's Phone (browser)
    │
    ▼
Cloudflare Pages (static wizard UI)
    │
    │  POST /api/provision → Pages Function (stateless credential proxy)
    │  Function forwards to api.machines.dev with user's Fly.io token
    │
    ▼
User's Fly.io Account
    ├── {prefix}-relay
    └── {prefix}-vm
```

- **Cloudflare Pages**: serves static HTML/CSS/JS wizard form (free tier, global CDN)
- **Pages Functions**: server-side proxy to Fly.io Machines API (avoids CORS limitation, credentials never stored)
- **Separate from the relay**: no changes to `server.js`, clean security boundary

## Why Cloudflare Pages (not on the relay)

The relay handles Twilio webhooks and in-memory user state. Adding public-facing credential-proxying endpoints mixes security concerns. Cloudflare Pages isolates the wizard entirely — different infrastructure, different attack surface, different deployment pipeline.

## Key Design Decisions (from Phase 8 planning)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Docker images | Push to GHCR (public) | User's Fly.io pulls from `ghcr.io/sendtwothreeyears/*` |
| Credential handling | Stateless proxy in Pages Function, never stored/logged | Fly.io Tokenizer pattern |
| App naming | User-chosen prefix → `{prefix}-relay`, `{prefix}-vm` | Simple, globally unique |
| Secrets | Machine config `env` vars (Machines API has no secrets endpoint) | Only option without Fly CLI |
| Progress | SSE stream via `fetch` + `ReadableStream` (not `EventSource` — POST required) | Real-time step updates |
| Rollback | On failure, `DELETE /v1/apps/{name}?force=true` cascades | Cleans up orphaned resources |
| Twilio webhook | Auto-configure via Twilio API (verify sandbox API exists first) | Eliminates manual step |

## Prerequisites

Before building the wizard:
1. Docker images published to GHCR (GitHub Actions workflow)
2. Phase 8 MVP complete (users can deploy manually, proving the architecture works)

## Reference

- Full plan (pre-Cloudflare pivot): `docs/plans/2026-02-27-feat-deploy-wizard-provisioning-plan.md`
- Brainstorm: `docs/brainstorms/2026-02-27-phase-8-provisioning-brainstorm.md`
- Phase spec: `docs/phases/08-phase-provisioning.md`
- Credential proxy security research captured in the plan document

## When to Revisit

After MVP is deployed and working. The wizard is a UX layer on top of proven provisioning mechanics — not a prerequisite for users to deploy.
