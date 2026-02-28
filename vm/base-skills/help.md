---
name: help
description: "Show available commands, skills, and usage tips"
---

# /help [topic]

Show help information.

## Variants

- `/help` - Show all available commands and skills
- `/help clone` - Show detailed help for a specific skill
- `/help git` - Show git-related commands
- `/help deploy` - Show deployment options

## Steps

1. If no topic, list all core commands and available skills with one-line descriptions
2. If a topic matches a skill name, show that skill's full documentation
3. If a topic matches a category (git, deploy, etc.), show related commands

## Notes

- Keep the default help output short and scannable
- Skills from the current repo override base skills with the same name
