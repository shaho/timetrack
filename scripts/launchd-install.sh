#!/usr/bin/env bash
# Install the timetrack watcher as a launchd agent (starts at login,
# restarts on crash). Idempotent: safe to re-run after editing code paths.
set -euo pipefail

LABEL="com.shaho.timetrack"
PLIST_SRC="$(cd "$(dirname "$0")/.." && pwd)/launchd/${LABEL}.plist"
PLIST_DST="$HOME/Library/LaunchAgents/${LABEL}.plist"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

BUN_BIN="$(command -v bun || true)"
if [[ -z "$BUN_BIN" ]]; then
  echo "error: bun not found in PATH" >&2
  exit 1
fi

echo "bun:   $BUN_BIN"
echo "entry: $REPO_DIR/src/index.ts"
echo "plist: $PLIST_DST"

# If the daemon is running in a terminal somewhere, two copies would
# double-track. Warn loudly.
if pgrep -f "src/index.ts" >/dev/null 2>&1; then
  echo
  echo "WARNING: a tracker process is already running. Stop it (Ctrl-C in"
  echo "its terminal) before installing, or you'll track everything twice."
  read -r -p "Continue anyway? [y/N] " answer
  [[ "$answer" == "y" || "$answer" == "Y" ]] || exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents"
sed -e "s|BUN_PATH|$BUN_BIN|" \
    -e "s|/Users/shaho/Desktop/dev/fable01|$REPO_DIR|" \
    "$PLIST_SRC" > "$PLIST_DST"

# Reload if already installed (modern bootstrap/bootout API).
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST_DST"

echo
echo "Installed and started. Check:"
echo "  launchctl print gui/$(id -u)/$LABEL | head -20"
echo "  tail -f /tmp/timetrack.log"
echo
echo "If window titles show up empty in reports, give bun Screen Recording"
echo "permission: System Settings → Privacy & Security → Screen Recording →"
echo "add $BUN_BIN"
