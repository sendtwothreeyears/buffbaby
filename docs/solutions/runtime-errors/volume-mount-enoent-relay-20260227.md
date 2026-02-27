---
module: VM Server
date: 2026-02-27
problem_type: runtime_error
component: fly_io_volume_mount
symptoms:
  - "Screenshot save fails with ENOENT — /data/images directory does not exist"
  - "Fly Volume mounted at /data contains only lost+found, no subdirectories"
  - "Dockerfile mkdir -p /data/images has no effect at runtime when Volume is mounted"
root_cause: "Fly.io Volume mount at /data overlays the container filesystem at runtime, replacing the /data directory (including /data/images created by Dockerfile) with a fresh ext4 volume containing only lost+found. Directories created in the Docker image under a mount point are inaccessible after the Volume is mounted."
resolution_type: code_fix
severity: critical
tags: [fly-io, volume, mount, enoent, docker, filesystem, screenshots, images]
---

# Troubleshooting: Fly Volume Mount Overlays Dockerfile Directories (ENOENT)

## Problem

After deploying the VM container to Fly.io with a 3GB Volume mounted at `/data`, the screenshot endpoint failed with ENOENT when saving JPEG files to `/data/images`. The directory existed in the Docker image but not on the mounted Volume.

## Environment

- Module: VM Server (`vm-server.js`)
- Affected Component: Fly.io Volume mount at `/data`, screenshot storage at `/data/images`
- Date: 2026-02-27

## Symptoms

- WhatsApp screenshot requests return: "screenshot failed with a file system error (ENOENT)"
- SSH into VM confirms `/data` contains only `lost+found` — no `images` subdirectory
- Local Docker (no Volume mount) works fine — `/data/images` exists from Dockerfile

## What Didn't Work

**Attempted Solution 1:** Creating `/data/images` in the Dockerfile

```dockerfile
RUN mkdir -p /tmp/images /data/images && chown appuser:appuser /tmp/images /data/images
```

- **Why it failed:** This creates `/data/images` in the container image layer at build time. At runtime, Fly.io mounts the Volume at `/data`, replacing the entire directory tree with the Volume's ext4 filesystem. The image layer's `/data/images` is hidden behind the mount.

## Solution

Create the directory at application startup, after the Volume is mounted.

**Code change** (`vm-server.js:36-39`):

```javascript
// Before (nothing — relied on Dockerfile mkdir)

// After (runtime initialization)
const fsSync = require("fs");
if (!fsSync.existsSync(IMAGES_DIR)) {
  fsSync.mkdirSync(IMAGES_DIR, { recursive: true });
  console.log(`[STARTUP] Created ${IMAGES_DIR}`);
}
```

Also fixed directory ownership via SSH (immediate unblock while deploying the code fix):

```bash
fly ssh console --app textslash-vm -C "mkdir -p /data/images"
fly ssh console --app textslash-vm -C "chown appuser:appuser /data/images"
```

## Why This Works

Container volume mounts have higher precedence than image layers:

1. **Build time:** Dockerfile creates `/data/images` in the image layer
2. **Runtime:** Fly.io mounts Volume at `/data` — overlays the image layer entirely
3. **After mount:** Application sees only the Volume's filesystem (`lost+found`)

By running `mkdirSync` at startup (after the mount), the directory is created on the **actual mounted Volume**, not in the image layer. The `{ recursive: true }` flag handles missing parent directories and is a no-op if the directory already exists (idempotent across restarts).

## Prevention

- **Rule: directories under mount points must be created at runtime, not in the Dockerfile.** Dockerfile `mkdir` is only reliable for non-mounted paths (e.g., `/tmp/images` works fine).
- **Test with Volume mounts locally** before deploying — add a Docker Compose volume at the same mount point to reproduce production behavior.
- **Log directory state at startup** — the `[STARTUP] Created /data/images` log line makes it immediately obvious when the directory was missing.
- **This applies to all container orchestrators** (Fly.io, Kubernetes, Docker Compose) — volume mounts always overlay image layers.

## Related Issues

- See also: [screenshot-pipeline-architecture-playwright-relay-whatsapp-20260226.md](../best-practices/screenshot-pipeline-architecture-playwright-relay-whatsapp-20260226.md) — Screenshot storage architecture and `/tmp/images` patterns
- See also: [docker-vm-claude-code-headless-setup-20260225.md](../developer-experience/docker-vm-claude-code-headless-setup-20260225.md) — Docker container setup including directory creation and ownership
- See also: [stateful-relay-multi-machine-deploy-20260227.md](../integration-issues/stateful-relay-multi-machine-deploy-20260227.md) — Related Fly.io deployment issue from same phase
