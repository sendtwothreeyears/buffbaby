---
name: install
description: "Install additional tools or runtimes on demand"
---

# /install <tool>

Install a tool or runtime that isn't pre-installed on the VM.

## Pre-installed Tools

Already available: node, npm, pnpm, yarn, bun, gh, flyctl, vercel, netlify, wrangler, railway, jq, ripgrep, tree, htop, tmux, sqlite3, psql, redis-cli, git-lfs

## On-Demand Installs

| Tool | Method |
|------|--------|
| AWS CLI v2 | `curl` + unzip to `~/bin` |
| gcloud SDK | `curl` + extract to `~/google-cloud-sdk` |
| Azure CLI | `pip install --user azure-cli` |
| Docker CLI | `curl` binary to `~/bin` |
| Deno | `curl -fsSL https://deno.land/install.sh \| sh` |
| Go | Download tarball to `~/go` |
| Rust/cargo | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh -s -- -y` |

## Steps

1. Check if the tool is already installed: `which <tool>`
2. If installed, report the version and stop
3. Download/install to user-space paths (`~/bin`, `~/tools`, etc.)
4. Add to PATH if needed: `export PATH="$HOME/bin:$PATH"`
5. Verify the install: `<tool> --version`
6. Report: installed version, install location

## Notes

- The VM runs as appuser (non-root) - cannot use apt-get
- On-demand tools live in the container filesystem and are lost on redeploy
- For persistent tools across redeploys, install to `/data/tools/` (Fly Volume)
