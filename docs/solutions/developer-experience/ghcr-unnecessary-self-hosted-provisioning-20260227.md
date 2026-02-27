---
module: provisioning
date: 2026-02-27
problem_type: developer_experience
component: docker_deployment
symptoms:
  - "GHCR workflow adds unnecessary complexity for self-hosted open-source projects"
  - "Package visibility defaults to private, requiring manual GitHub Settings change"
  - "Users already have Dockerfiles from cloning the repo"
root_cause: "Over-engineering — pre-built registry images unnecessary when users clone the repo and have local Dockerfiles"
resolution_type: workflow_improvement
severity: high
tags: [deployment, docker, ghcr, simplification, self-hosted, provisioning, fly-io]
---

# Troubleshooting: GHCR Unnecessary for Self-Hosted Open-Source Provisioning

## Problem

Built a GitHub Actions workflow to publish Docker images to GHCR and a setup script that pulled pre-built images — but users clone the repo to get the setup script, so they already have the Dockerfiles. The registry layer added complexity with no benefit.

## Environment
- Module: Provisioning (Phase 8)
- Affected Component: Docker deployment pipeline
- Date: 2026-02-27

## Symptoms
- GHCR packages default to private — requires manual visibility change in GitHub Settings
- Setup script depends on external registry (`ghcr.io/sendtwothreeyears/...`)
- CI workflow (`publish-images.yml`) needed maintenance for every Dockerfile change
- Users get 401 errors if package visibility isn't set to public

## What Didn't Work

**Attempted Solution: Pre-built images on GHCR**
- Built `.github/workflows/publish-images.yml` with matrix strategy to push relay + VM images
- Setup script used `fly deploy --image ghcr.io/.../textslash-relay:latest`
- **Why it failed:** Added 3 layers of unnecessary complexity (CI workflow, registry visibility, pull authentication) for a self-hosted open-source project where users already have the source

## Solution

Changed the setup script to build from local Dockerfiles using Fly.io's remote builders. Deleted the GHCR workflow entirely.

**Code changes:**

```bash
# Before (broken — unnecessary registry dependency):
GHCR_ORG="sendtwothreeyears"
fly deploy --app "${PREFIX}-relay" \
  --image "ghcr.io/${GHCR_ORG}/textslash-relay:latest"

fly deploy --app "${PREFIX}-vm" \
  --image "ghcr.io/${GHCR_ORG}/textslash-vm:latest"

# After (fixed — builds from user's own Dockerfiles):
fly deploy --app "${PREFIX}-relay" \
  --dockerfile "${REPO_DIR}/Dockerfile"

fly deploy --app "${PREFIX}-vm" \
  --dockerfile "${REPO_DIR}/vm/Dockerfile"
```

Also deleted: `.github/workflows/publish-images.yml`

## Why This Works

Fly.io's `fly deploy --dockerfile` sends the Dockerfile and build context to Fly.io's remote builders, which compile the image and deploy it — all in one step. Users don't need Docker installed locally, and there's no registry to manage.

The GHCR approach makes sense for:
- Closed-source projects where users don't have the source
- SaaS platforms deploying a fixed image to many environments
- Performance-critical hot paths where build caching matters

It does NOT make sense when:
- Users clone the repo (they already have the Dockerfiles)
- The deployment target can build from source (`fly deploy --dockerfile`)
- The project is open-source and self-hosted

## Prevention

- **Gate decision:** Before adding CI that publishes images, ask: "Does the deployment target support building from source?" If yes, skip the registry.
- **Watch for:** New `.github/workflows/` files that push to GHCR/Docker Hub in open-source repos. Question whether the registry adds value.
- **Principle:** If your deployment target can build from source, skip the registry. Simpler is better.

## Related Issues

- See also: [docker-vm-claude-code-headless-setup-20260225.md](../developer-experience/docker-vm-claude-code-headless-setup-20260225.md) — Docker setup patterns for the VM
