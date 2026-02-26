# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- Open-source release preparation
- LICENSE (MIT), CONTRIBUTING.md, SECURITY.md, ARCHITECTURE.md, CHANGELOG.md
- `.dockerignore` files for relay and VM
- AI-native `/setup` skill for guided onboarding
- `.github/` issue and PR templates
- Relay server `/health` endpoint

### Changed
- README.md rewritten for open-source audience
- `NGROK_URL` renamed to `PUBLIC_URL` in relay server
- Internal docs (PRD, competitive analysis, phase plan) moved to `docs/`
- `package.json` files updated with public metadata

## [0.1.0-alpha] — 2026-02-26

### Phase 2: Docker VM Image
- Docker container with Claude Code CLI, Chromium, and Playwright
- HTTP API wrapper (`POST /command`, `GET /health`, `GET /images/:filename`)
- Non-root container user (`appuser`)
- Single-command concurrency with configurable timeout
- Path traversal protection on image serving
- 10MB output buffer cap
- Process group management for clean shutdown

### Phase 1: SMS Echo Server
- Express relay server with Twilio webhook integration
- Phone number allowlist authentication
- MMS test image response
- Environment variable validation at startup
- ngrok tunnel for local development
