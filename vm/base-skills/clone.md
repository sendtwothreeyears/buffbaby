---
name: clone
description: "Clone a GitHub repo, install dependencies, and start the dev server"
---

# /clone <repo-url> [branch]

Clone a GitHub repository into this VM's workspace.

## Steps

1. Clone the repo to /data/repos/<name> using `gh repo clone` (authenticated via GITHUB_TOKEN)
2. If a branch is specified, check it out
3. Detect project type (package.json -> Node.js, requirements.txt -> Python, Cargo.toml -> Rust, etc.)
4. Install dependencies based on detected type
5. If a `dev` script exists in package.json, start the dev server in the background
6. Report back: repo name, branch, file count, dev server URL (if started)

## Examples

- `/clone https://github.com/user/my-app`
- `/clone https://github.com/user/my-app feat/new-feature`

## Notes

- After cloning, the VM's working directory switches to the cloned repo
- If the repo already exists, pull latest changes instead of re-cloning
