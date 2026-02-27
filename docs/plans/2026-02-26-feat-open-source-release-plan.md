---
phase: General
condensed: true
original: archive/plans/2026-02-26-feat-open-source-release-plan.md
---

# Open-Source Release Preparation (Condensed)

**Stage:** Release Preparation
**Depends on:** Phases 1-4 complete
**Done when:** Repo is public-ready with LICENSE, docs, security hardening, AI-native `/setup` skill, and v0.1.0-alpha tag.

## Summary

Prepared textslash for public open-source release under MIT license. Executed in four ordered sub-phases: (1) Security and identity cleanup -- removed old project references, added `.dockerignore` files, verified no secrets in git history; (2) Core documentation -- README rewrite, LICENSE, ARCHITECTURE.md, SECURITY.md, CONTRIBUTING.md, CHANGELOG.md; (3) Code changes -- renamed `NGROK_URL` to `PUBLIC_URL`, added relay health check, updated package.json metadata, committed lockfiles, moved internal docs to `docs/`; (4) Developer experience -- built `/setup` skill for AI-native onboarding, added GitHub issue/PR templates, tagged v0.1.0-alpha.

## Key Deliverables

- MIT LICENSE file
- README.md complete rewrite (quickstart, architecture, honest alpha status)
- ARCHITECTURE.md, SECURITY.md, CONTRIBUTING.md, CHANGELOG.md
- `.dockerignore` files (root and vm/)
- `/setup` skill for AI-native developer onboarding
- `.github/` issue and PR templates
- `PUBLIC_URL` env var (replacing `NGROK_URL`)
- Relay `GET /health` endpoint
- Package metadata and lockfiles committed
- v0.1.0-alpha release tag

## Key Technical Decisions

- **Keep git history as-is (not squash)**: Old project name in early commits is cosmetic; preserving commit provenance outweighs clean history
- **Skills-over-features model**: New capabilities go through Claude Code skills system, not core code; documented in CONTRIBUTING.md
- **AI-native onboarding (`/setup` skill)**: Walks developers through complete setup interactively, preferred over manual docs
- **Honest security posture**: SECURITY.md explicitly documents known limitations (no rate limiting, `--dangerously-skip-permissions`, etc.)
- **`PUBLIC_URL` over `NGROK_URL`**: Decouples config from specific tunneling tool for production readiness

## Status

Completed
