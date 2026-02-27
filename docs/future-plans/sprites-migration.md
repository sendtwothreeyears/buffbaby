# Future Plan: Migrate VM Layer to Fly.io Sprites

**Created:** 2026-02-27
**Status:** Deferred — revisit when Sprites matures
**Depends on:** Phase 7 deployed with Fly.io Machines

## Why Sprites

Fly.io Sprites are stateful sandbox VMs (launched Jan 2026) that offer:

- **Auto-sleep/wake:** 30s idle → sleep, ~1-2s wake on HTTP request. Zero compute billing when asleep.
- **Persistent 100GB storage:** Installed packages, git repos, project files survive across sleep/wake cycles. No Volumes needed.
- **Checkpoint/restore:** Snapshot entire VM state in ~300ms, rollback in <1s. Like `git` for the whole system.
- **Pre-installed tools:** Node.js 22, Claude Code CLI, Git, Python, Go — already there.
- **Services API:** Define processes that auto-restart on wake (replaces Docker's `CMD`).
- **No Docker required:** Setup via shell commands, not Dockerfiles.

### Cost Model (pay-per-use)

| Resource | Rate |
|----------|------|
| CPU | $0.07/CPU-hour |
| Memory | $0.04375/GB-hour |
| Hot storage (while awake) | $0.000683/GB-hour |
| Cold storage (while asleep) | $0.000027/GB-hour |

A 4-hour Claude Code session: ~$0.44. A workload running 3 hrs/day: ~$4-14/month depending on resource usage.

## Why Not Now (Feb 2026)

### Dealbreakers

1. **No private networking with Fly Machines.** Sprites use `fdf::/64`, not Fly's 6PN (`fdaa::/`). `.internal` DNS doesn't resolve. The relay Machine cannot reach a Sprite over private network — all traffic must go over public HTTPS with bearer token auth. Confirmed by community testing; no Fly staff response to the networking thread.

2. **Reliability is poor.** Multiple Feb 2026 community reports: "1 in 5 succeed, rest timeout", "503s and occasional successes", sprites becoming completely unresponsive after usage. Still in beta (API version rc30-rc39).

3. **No forking/cloning.** Can't use a golden checkpoint as a template for new user Sprites. Each new Sprite requires running the full setup script (~1-2 min). Fly staff confirmed forking is "coming" but gave no timeline.

### Other Gaps

- **No region selection** — can't pin Sprite to same region as relay Machine
- **Port 8080 only** for external HTTP (our VM uses 3001; would need to change or use WebSocket TCP proxy)
- **`@fly/sprites` SDK requires Node.js 24+** — relay currently runs Node 22
- **No custom base images** — stuck with Ubuntu 24.04 LTS base
- **No startup/init scripts** — community feature request is open
- **Sparse documentation** — multiple community members flagged this

## Migration Path

When Sprites matures, the migration is a **config change, not a rewrite**. The relay doesn't care what the VM is — just its URL.

### What Changes

| Component | Current (Machines) | Future (Sprites) |
|-----------|-------------------|-------------------|
| `CLAUDE_HOST` | `http://vm-app.internal:3001` | `https://user-sprite.sprites.app` |
| VM setup | `Dockerfile` + `fly deploy` | Setup script + `sprite checkpoint` |
| Storage | Fly Volume at `/data` | Built-in 100GB persistent filesystem |
| Process mgmt | Docker `CMD` + `restart: unless-stopped` | Sprites Services API |
| Auth | Private networking (no auth needed) | Bearer token on every request |
| Cold start | 10-20s (Docker boot) | 1-2s (Firecracker resume) |
| Idle behavior | Self-managed shutdown + auto-start | Auto-sleep after 30s |

### What Doesn't Change

- Relay server code (`server.js`) — same HTTP calls, different URL
- VM server code (`vm-server.js`) — runs identically inside a Sprite
- Twilio integration — unchanged
- WhatsApp UX — unchanged (just faster cold starts)

### Prerequisites for Migration

- [ ] Sprites supports private networking with Fly Machines (or we accept public URL + auth)
- [ ] Reliability stabilizes (community reports consistent uptime)
- [ ] Fork/clone from checkpoint is available (for multi-user provisioning)
- [ ] Region pinning is available (or latency is acceptable)
- [ ] Documentation improves to production-grade

## Research Sources

- [Sprites.dev — Official Site](https://sprites.dev/)
- [Sprites Documentation](https://docs.sprites.dev/)
- [Fly.io Blog — Code And Let Live](https://fly.io/blog/code-and-let-live/)
- [Fly.io Blog — Design & Implementation of Sprites](https://fly.io/blog/design-and-implementation/)
- [Simon Willison — Fly's new Sprites.dev](https://simonwillison.net/2026/Jan/9/sprites-dev/)
- [HN Discussion — Sprites](https://news.ycombinator.com/item?id=46563308)
- [Community — Can Sprites reach .internal?](https://community.fly.io/t/can-sprites-reach-internal-fly-services-6pn-internal/27059)
- [Community — Sprites reliability issues](https://community.fly.io/t/trouble-with-sprites-stability/27104)
- [Community — Clone Sprite?](https://community.fly.io/t/sprites-clone-sprite/26728)
- [@fly/sprites npm SDK](https://github.com/superfly/sprites-js)
