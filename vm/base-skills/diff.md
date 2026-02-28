---
name: diff
description: "Show a summary of uncommitted changes or branch diff"
---

# /diff [target]

Show code changes in the current repo.

## Variants

- `/diff` - Show uncommitted changes (staged + unstaged)
- `/diff staged` - Show only staged changes
- `/diff main` - Show diff between current branch and main
- `/diff HEAD~3` - Show last 3 commits

## Steps

1. Run the appropriate `git diff` command
2. Summarize: files changed, insertions, deletions
3. Show the diff with syntax highlighting in code blocks
4. If the diff is very large (>100 lines), show a summary and ask if the user wants the full diff

## Notes

- Keep output concise - the user is reading on Discord
- Group changes by file for readability
