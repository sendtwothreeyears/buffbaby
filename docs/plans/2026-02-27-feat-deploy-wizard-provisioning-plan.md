---
phase: 8
condensed: true
original: archive/plans/2026-02-27-feat-deploy-wizard-provisioning-plan.md
---

# Phase 8: Self-Hosted Provisioning (Condensed)

**Stage:** Production
**Depends on:** Phase 7 (Deploy to Fly.io)
**Done when:** A user clones the repo, runs `scripts/setup.sh`, enters credentials, and gets a working relay + VM on their own Fly.io account.

## Summary

Enabled self-hosted deployment via a CLI setup script and published Docker images. Users clone the repo, run an interactive Bash script that creates Fly.io apps, sets encrypted secrets, deploys from GHCR images, and prints next steps. Includes a teardown script for clean removal. Phone-only deploy wizard deferred to a future phase.

## Key Deliverables

- GitHub Actions workflow (`.github/workflows/publish-images.yml`) publishing relay and VM images to GHCR on push to main
- Interactive setup script (`scripts/setup.sh`): prerequisite checks, credential collection, app/volume creation, secret setting, deploy from GHCR, health polling
- Teardown script (`scripts/teardown.sh`): destroys both apps with confirmation
- Template fly.toml files (`deploy/relay.fly.toml`, `deploy/vm.fly.toml`) used by `fly deploy --config`
- Self-hosting documentation in README

## Key Technical Decisions

- **CLI-first (not wizard-first)**: Simpler (no proxy/web UI/Cloudflare), more secure (credentials stay local), and proves mechanics that a wizard would build on
- **GHCR for Docker images**: Public registry, no auth needed for pulls, aligns with GitHub workflow
- **`fly secrets set` for all sensitive values**: Encrypted at rest, better than Machines API env vars
- **`--ha=false` + `fly scale count 1`**: Prevents Fly.io's default 2-machine HA creation for stateful single-machine apps
- **Flycast port 80 for inter-app communication**: `http://{prefix}-vm.flycast` (not `:3001`); Fly Proxy maps 80 to internal_port

## Status

In Progress (GHCR images and scripts working; end-to-end fresh-account test pending)
