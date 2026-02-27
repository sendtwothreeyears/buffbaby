#!/usr/bin/env bash
set -euo pipefail

echo "=== textslash teardown ==="
echo ""

read -rp "App name prefix to destroy: " PREFIX

if [ -z "$PREFIX" ]; then
  echo "Error: prefix cannot be empty."
  exit 1
fi

echo ""
echo "This will permanently destroy:"
echo "  - ${PREFIX}-relay (relay server)"
echo "  - ${PREFIX}-vm (VM server + all data on its volume)"
echo ""
read -rp "Type 'yes' to confirm: " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 1
fi

echo ""
echo "Destroying ${PREFIX}-vm..."
fly apps destroy "${PREFIX}-vm" --yes 2>/dev/null || echo "  (not found or already destroyed)"

echo "Destroying ${PREFIX}-relay..."
fly apps destroy "${PREFIX}-relay" --yes 2>/dev/null || echo "  (not found or already destroyed)"

echo ""
echo "Done. Both apps destroyed."
