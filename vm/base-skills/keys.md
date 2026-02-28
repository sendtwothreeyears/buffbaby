---
name: keys
description: "Manage SSH keys and environment secrets"
---

# /keys [action]

Manage SSH keys and secrets on this VM.

## Actions

- `/keys ssh-keygen` - Generate a new SSH key pair for this VM
- `/keys ssh-show` - Show the public key (for adding to GitHub/servers)
- `/keys set <NAME> <value>` - Set an environment variable for the current session
- `/keys list` - List configured environment variable names (not values)

## Steps

For ssh-keygen:
1. Generate ED25519 key: `ssh-keygen -t ed25519 -C "textslash-vm" -f ~/.ssh/id_ed25519 -N ""`
2. Show the public key
3. Suggest: "Add this to GitHub at Settings > SSH Keys"

For set:
1. Export the variable: `export NAME=value`
2. Append to ~/.bashrc for persistence
3. Confirm: "Set NAME (value hidden)"

## Notes

- Never display secret values - only names
- SSH keys persist in the container across restarts
