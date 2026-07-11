#!/usr/bin/env bash
# Stop and remove the timetrack launchd agent. Data is untouched.
set -euo pipefail

LABEL="com.shaho.timetrack"
PLIST_DST="$HOME/Library/LaunchAgents/${LABEL}.plist"

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
rm -f "$PLIST_DST"
echo "Agent stopped and removed. Database and categories.json kept."
