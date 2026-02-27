# Security

## Threat Model

textslash runs Claude Code with `--dangerously-skip-permissions` on a Docker VM. This grants full system access within the container. The security model relies on:

1. **Container isolation** (Docker)
2. **Network isolation** (VM not exposed to public internet directly)
3. **Phone number allowlist** (relay server)
4. **Twilio as trusted transport**

## What's Implemented

- **Twilio webhook signature validation** — incoming requests verified using `twilio.webhook()` middleware
- **Phone number allowlist** — only configured numbers can send commands (`whatsapp:` prefix stripped before allowlist check)
- **Non-root container user** — limits container escape impact
- **Path traversal protection** on VM image endpoint (`/images/:filename`) — `path.resolve` + `startsWith` check
- **Relay image proxy validation** — UUID regex whitelist (`/^[0-9a-f-]+\.jpeg$/`) prevents path traversal
- **10MB output buffer cap** — prevents OOM attacks via large Claude Code output
- **Process group killing** — prevents orphan processes after timeout or shutdown
- **Env var validation** — fail-fast on missing required configuration
- **Single-command concurrency** — prevents resource exhaustion from parallel requests
- **Per-user message queue** — caps at 5 messages to prevent relay-side resource exhaustion

## Known Limitations

These are intentional tradeoffs for the alpha stage:

- **No authentication on VM `/command` endpoint** — the VM trusts all HTTP requests. The VM should only be accessible from the relay server (Docker network or localhost).
- **In-memory message queue** — relay queue state is lost on restart; queued messages and busy flags reset
- **`--dangerously-skip-permissions`** — required for headless Claude Code operation. The container can execute any command within its boundaries.
- **No rate limiting** — a compromised phone number could flood the VM with commands.
- **No encryption at rest** — project files on the VM are unencrypted.
- **Relay image proxy is publicly accessible** — Twilio requires public URLs for WhatsApp media. Mitigated by UUID filenames (unguessable) and 30-minute TTL. Token-based auth deferred to Phase 7.
- **Playwright URL navigation** — Claude Code could screenshot external URLs from within the container. Container is sandboxed; Chromium runs headless with `--no-sandbox` (required in Docker). URL allowlisting deferred to pre-public release.
- **WhatsApp Sandbox limitations** — 24-hour session window (can only reply within 24h of last user message), users must send a join code to opt in, sandbox webhook URL must be configured separately in Twilio Console

## Responsible Disclosure

If you discover a security vulnerability, please email the maintainer directly rather than opening a public issue. You can find contact information in the git history (`git log --format='%ae' | head -1`).

## For Self-Hosters

- **Never expose the VM port (3001) to the public internet** — it has no authentication
- Use strong, unique credentials in `.env` files
- Rotate Twilio and Anthropic API keys regularly
- Review the phone number allowlist — each number has full access to the VM
- Consider running behind a VPN or private network
- Monitor Docker container resource usage
