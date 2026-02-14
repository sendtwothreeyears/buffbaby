#!/bin/bash
# sync-commands-to-codex.sh
# Syncs Claude Code commands to Codex CLI prompts via hardlinks

set -e

CLAUDE_COMMANDS_DIR="$HOME/.claude/commands"
CODEX_PROMPTS_DIR="$HOME/.codex/prompts"

mkdir -p "$CODEX_PROMPTS_DIR"

synced=0
skipped=0
changed=()

for file in "$CLAUDE_COMMANDS_DIR"/*.md; do
    filename=$(basename "$file")
    target="$CODEX_PROMPTS_DIR/$filename"

    # Skip if already hardlinked (same inode)
    if [[ -f "$target" ]] && [[ "$(stat -f %i "$file")" == "$(stat -f %i "$target")" ]]; then
        ((skipped++))
        continue
    fi

    ln -f "$file" "$target"
    changed+=("$filename")
    ((synced++))
done

total=$((synced + skipped))

if [[ $synced -eq 0 ]]; then
    echo "All $total commands already in sync"
else
    echo "Synced $synced of $total commands:"
    for cmd in "${changed[@]}"; do
        echo "  → $cmd"
    done
fi
