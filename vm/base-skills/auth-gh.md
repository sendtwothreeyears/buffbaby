---
name: auth-gh
description: "Authenticate with GitHub using a personal access token"
---

# /auth-gh <token>

Set up GitHub authentication on this VM.

## Steps

1. Store the token securely: `echo "<token>" | gh auth login --with-token`
2. Verify authentication: `gh auth status`
3. Configure git to use the token: `gh auth setup-git`
4. Report: authenticated user, token scopes

## Notes

- The token is stored in the container and persists across restarts
- Required scopes: `repo`, `read:org` (minimum for clone + PR workflows)
- If already authenticated, show current status and ask before replacing
