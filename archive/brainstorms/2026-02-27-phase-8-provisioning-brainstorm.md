---
date: 2026-02-27
topic: phase-8-provisioning
---

# Phase 8: Self-Hosted Provisioning via Deploy Wizard

## What We're Building

A web-based deploy wizard hosted on our Fly.io instance that helps users deploy their own textslash stack (relay + VM) to their own Fly.io account — entirely from their phone, no laptop required.

This is an open-source, self-hosted model: each user's compute runs on their own Fly.io account and bill. We only host the lightweight deploy wizard page.

## Architecture

```
User's Phone (browser)
    │
    ▼
Deploy Wizard (hosted on our Fly.io)
    │
    │  Wizard sends credentials to a thin proxy on our server.
    │  Proxy forwards to Fly.io Machines API, does not store credentials.
    │  (Fly.io Machines API does not support CORS — browser-direct calls won't work.)
    │
    ▼
User's Fly.io Account
    ├── Relay app (receives messages from their messaging channel)
    └── VM app (Claude Code + Playwright)
```

**Key property:** User credentials pass through our proxy transiently but are never stored, logged, or persisted. The proxy is a stateless forwarder. The user's Fly.io token, Anthropic key, and channel credentials live only on their own Fly.io machines as encrypted secrets.

## Why This Approach

**Considered alternatives:**
1. ~~Centralized provisioning~~ — We provision VMs on our account for users. Rejected: doesn't scale as open-source, we'd bear compute costs, credential trust issues.
2. ~~CLI setup script~~ — User clones repo, runs `npx textslash setup`. Works but requires a laptop. Will offer as a power-user option alongside the wizard.
3. **Web deploy wizard (chosen)** — Phone-only UX, thin proxy to Fly.io API, user pays their own bill. Best balance of simplicity and trust.

**Why a thin proxy:** The Fly.io Machines API does not support CORS, so browser-direct calls are not possible. A thin proxy on our server forwards requests to Fly.io without storing credentials. The proxy is stateless and open-source — users can verify it doesn't leak secrets. For users who don't trust the proxy, the CLI alternative uses the same provisioning logic locally.

## Key Decisions

- **Open-source self-hosted model:** Each user deploys to their own Fly.io account. We don't provision for them.
- **Thin proxy for credential forwarding:** Credentials pass through our proxy transiently but are never stored. Proxy is stateless and open-source.
- **Phone-only end-to-end UX:** User visits the wizard URL, enters credentials, clicks deploy. No laptop needed.
- **MVP channel: WhatsApp/Twilio:** Current implementation. User provides their own Twilio credentials. Discord + Telegram are future phases.
- **Two Fly.io apps per user:** The wizard creates both a relay app and a VM app on the user's Fly.io account via the Machines API.

## User Flow (Phone-Only)

1. User visits deploy wizard URL on their phone
2. Enters: Fly.io API token, Anthropic API key, channel credentials (Twilio for MVP)
3. Wizard sends credentials to our thin proxy, which calls Fly.io Machines API to create relay + VM on user's account
4. Wizard polls health endpoints until both services are up
5. User opens their messaging app and starts sending commands

## Resolved Questions

- **Fly.io Machines API CORS:** Does not support CORS. Browser-direct calls won't work. Solution: thin proxy on our server that forwards without storing credentials.

## Open Questions

- **Docker image access:** Can the user's Fly.io account pull from our registry (`registry.fly.io/textslash-vm:latest`), or does the image need to be on a public registry (Docker Hub / GitHub Container Registry)?
- **App naming:** How to name the Fly.io apps created on the user's account? (e.g., `textslash-relay-<username>`, `textslash-vm-<username>`)
- **Teardown:** How does a user destroy their deployment? A "teardown" button on the wizard? CLI command?
- **Secrets injection:** The Machines API can set env vars at machine creation time. But can it set Fly secrets (encrypted at rest) via the API, or only via `fly secrets set` CLI?
- **User prerequisites:** User needs a Fly.io account and API token. Getting a token on mobile may be non-trivial — should the wizard link to instructions or handle Fly.io OAuth?

## Notes

- **CLI alternative:** A `npx textslash setup` CLI can reuse the same provisioning logic for power users who prefer terminal. Not Phase 8 scope but shares the same backend.

## Next Steps

> `/workflow:plan` for implementation details
