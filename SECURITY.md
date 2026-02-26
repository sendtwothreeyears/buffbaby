# Security

## Threat Model

textslash runs Claude Code with `--dangerously-skip-permissions` on a Docker VM. This grants full system access within the container. The security model relies on:

1. **Container isolation** (Docker)
2. **Network isolation** (VM not exposed to public internet directly)
3. **Phone number allowlist** (relay server)
4. **Twilio as trusted transport**

## What's Implemented

- **Phone number allowlist** — only configured numbers can send commands
- **Non-root container user** — limits container escape impact
- **Path traversal protection** on image endpoint (`/images/:filename`)
- **10MB output buffer cap** — prevents OOM attacks via large Claude Code output
- **Process group killing** — prevents orphan processes after timeout or shutdown
- **Env var validation** — fail-fast on missing required configuration
- **Single-command concurrency** — prevents resource exhaustion from parallel requests

## Known Limitations

These are intentional tradeoffs for the alpha stage:

- **No Twilio webhook signature validation** — anyone who discovers the webhook URL can spoof messages. Planned for Phase 3.
- **No authentication on VM `/command` endpoint** — the VM trusts all HTTP requests. The VM should only be accessible from the relay server (Docker network or localhost).
- **`--dangerously-skip-permissions`** — required for headless Claude Code operation. The container can execute any command within its boundaries.
- **No rate limiting** — a compromised phone number could flood the VM with commands.
- **No encryption at rest** — project files on the VM are unencrypted.

## Responsible Disclosure

If you discover a security vulnerability, please email the maintainer directly rather than opening a public issue. You can find contact information in the git history (`git log --format='%ae' | head -1`).

## For Self-Hosters

- **Never expose the VM port (3001) to the public internet** — it has no authentication
- Use strong, unique credentials in `.env` files
- Rotate Twilio and Anthropic API keys regularly
- Review the phone number allowlist — each number has full access to the VM
- Consider running behind a VPN or private network
- Monitor Docker container resource usage
