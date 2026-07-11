#!/usr/bin/env bash
# Stop and remove both timetrack launchd agents. Data is untouched.
set -euo pipefail

LABELS=("com.shaho.timetrack" "com.shaho.timetrack.server")

for label in "${LABELS[@]}"; do
  launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
  rm -f "$HOME/Library/LaunchAgents/${label}.plist"
  echo "removed: $label"
done

echo "Agents stopped and removed. Database and categories.json kept."
