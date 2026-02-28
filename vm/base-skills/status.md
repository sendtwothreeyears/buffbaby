---
name: status
description: "Show current repo, branch, changed files, and VM state"
---

# /status

Show the current state of the VM workspace.

## Steps

1. Show current working directory
2. If in a git repo:
   - Current branch
   - Ahead/behind remote
   - Changed files (staged and unstaged)
   - Last commit (hash + message)
3. Show running dev servers (if any)
4. Show disk usage of /data

## Output Format

Keep it concise. Example:

```
Repo: my-app (main)
Last commit: abc1234 feat: add login page
Changes: 2 modified, 1 new
Dev server: http://localhost:3000
Disk: 1.2GB / 10GB
```
