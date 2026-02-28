---
name: logs
description: "Show application or system logs"
---

# /logs [source] [lines]

Show logs from the VM or running applications.

## Sources

- `/logs` - Show the dev server logs (if running)
- `/logs app` - Application logs (stdout/stderr from dev server)
- `/logs system` - VM system logs
- `/logs git` - Recent git log (last 10 commits)

## Options

- Lines: `/logs app 50` - Show last 50 lines (default: 20)

## Steps

1. Identify the log source
2. Tail the appropriate log file or process output
3. Format with line numbers and timestamps where available
4. If logs are very long, truncate and offer to show more

## Notes

- Keep output concise for Discord readability
- Highlight errors and warnings
