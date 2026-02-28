---
name: ship
description: "Commit, push, and create a PR from current changes"
---

# /ship [message]

Ship the current changes: commit, push, and create a pull request.

## Steps

1. Check for uncommitted changes - if none, report and stop
2. Stage all changes: `git add -A`
3. Create a commit with the provided message (or auto-generate one from the diff)
4. Push the current branch to origin
5. Create a PR using `gh pr create`
6. Report: PR URL, title, files changed

## Before Creating PR

Always emit `::approval::` and wait for user approval before creating the PR.

## Examples

- `/ship` - Auto-generate commit message from diff
- `/ship feat: add user authentication` - Use provided commit message

## Notes

- If on main/master, create a new branch first (e.g., `feat/<description>`)
- Uses conventional commit format if no message provided
- The PR description is auto-generated from the commits
