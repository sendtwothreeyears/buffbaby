---
name: session
description: "Show or manage the current Claude Code conversation session"
---

# /session [action]

Manage the Claude Code conversation context.

## Actions

- `/session` (no args) - Show session info: message count, context usage, current repo
- `/session clear` - Reset the conversation context (same as the `clear` command)
- `/session summary` - Summarize what's been done in this session

## Notes

- Clearing the session does not undo file changes - only resets the conversation context
- Use when Claude seems confused or when switching to an unrelated task
