---
module: Docker VM
date: 2026-02-26
problem_type: developer_experience
component: docker-compose.yml
symptoms:
  - "Memory limit defined under deploy.resources.limits.memory in docker-compose.yml"
  - "Container runs without enforced memory cap when started via docker compose up"
  - "No warning or error emitted — limit silently ignored in standalone Compose mode"
root_cause: "deploy.resources.limits is a Docker Swarm-only configuration block; standalone docker compose up silently ignores it, so the intended 4g memory cap was never enforced"
resolution_type: config_change
severity: medium
tags: [docker, docker-compose, mem-limit, deploy-resources-limits, memory-cap, swarm, standalone-compose, phase-2]
---

# Troubleshooting: Docker Compose Memory Limit Silently Ignored in Standalone Mode

## Problem

The `docker-compose.yml` specified a 4GB memory limit using `deploy.resources.limits.memory`, but the container ran without any memory cap. Docker Compose in standalone mode silently ignores the entire `deploy` block — no warning, no error.

## Environment

- **Module:** Docker VM
- **Component:** docker-compose.yml
- **Date:** 2026-02-26
- **Phase:** 2 (Docker) — discovered during open-source release re-review
- **Stack:** Docker Compose v2, standalone mode (not Swarm)

## Symptoms

- `docker compose up` starts the container without any memory cap
- `docker inspect <container> --format '{{.HostConfig.Memory}}'` returns `0` (no limit)
- The YAML appears correct and Docker Compose accepts it without complaint
- Only discovered during a manual re-review — no runtime error signals the misconfiguration

## What Didn't Work

**Attempted:** Using `deploy.resources.limits.memory` to set a 4GB cap.
- **Why it failed:** The `deploy` block is part of the Docker Compose Swarm deployment spec (`docker stack deploy`). Plain `docker compose up` silently ignores the entire block. The YAML is syntactically valid, so no error or warning is emitted.

## Solution

Replace `deploy.resources.limits.memory` with the top-level `mem_limit` directive:

```yaml
# Before (broken — Swarm-only, silently ignored in standalone mode):
services:
  vm:
    deploy:
      resources:
        limits:
          memory: 4g

# After (fixed — enforced in standalone Docker Compose):
services:
  vm:
    mem_limit: 4g
```

## Why This Works

1. **ROOT CAUSE:** Docker Compose has two overlapping configuration surfaces — one for standalone mode and one for Swarm/stack mode — sharing the same `docker-compose.yml` file. The `deploy` block exists in both but is only acted upon in Swarm mode. This creates a silent misconfiguration trap.

2. **Why the solution works:** `mem_limit` is a first-class standalone Docker Compose directive. It maps directly to the `--memory` flag passed to the container runtime. The kernel enforces a hard memory ceiling on the cgroup; if the container exceeds it, the OOM killer is invoked.

3. **Underlying issue:** Docker Compose accepts Swarm-only keys without warning in standalone mode. The config is valid, the tool doesn't complain, but the intended constraint is never applied. This is a well-documented Docker footgun.

## Prevention

### Docker Resource Limits Checklist

- Memory limits must use `mem_limit` at the service level, not `deploy.resources.limits`
- After `docker compose up`, verify: `docker inspect <container> --format '{{.HostConfig.Memory}}'` should be non-zero
- Add a comment in the compose file explaining the choice:
  ```yaml
  # mem_limit (not deploy.resources.limits) — Swarm-only syntax is silently ignored
  mem_limit: 4g
  ```

### Validation Pattern: "Config Then Verify"

Never assume a Docker config option works as expected. After any new resource constraint:
1. Apply it in the compose file
2. Start the container
3. Inspect the container to confirm the constraint was applied
4. Document what you verified and how

### Automated Check

```bash
# Fails if the Swarm-only pattern is present in docker-compose.yml
grep -q "deploy:" docker-compose.yml && \
  grep -A5 "deploy:" docker-compose.yml | grep -q "memory:" && \
  echo "WARNING: deploy.resources.limits.memory is Swarm-only — use mem_limit instead" && exit 1
```

## Related Issues

- See also: [Docker VM with Claude Code Headless Setup](docker-vm-claude-code-headless-setup-20260225.md) — Phase 2 primary solution doc (non-root user, process management, path traversal)
- See also: [WhatsApp Echo Server with Twilio/ngrok Setup](sms-echo-server-twilio-ngrok-setup-20260225.md) — Phase 1 solution doc
