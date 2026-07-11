#!/usr/bin/env bash
# Install the timetrack watcher + API server as launchd agents (start at
# login, restart on crash). Idempotent: re-running reloads both agents,
# so use it to apply code-path or plist changes too.
set -euo pipefail

LABELS=("com.shaho.timetrack" "com.shaho.timetrack.server")
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

BUN_BIN="$(command -v bun || true)"
if [[ -z "$BUN_BIN" ]]; then
  echo "error: bun not found in PATH" >&2
  exit 1
fi

echo "bun:  $BUN_BIN"
echo "repo: $REPO_DIR"

# A tracker or server still running in a terminal would double-track /
# fight over the port once the agents start. Warn loudly.
if pgrep -f "src/(index|server)\.ts" >/dev/null 2>&1; then
  echo
  echo "WARNING: a tracker or server process is already running in a"
  echo "terminal. Stop it (Ctrl-C) first, or you'll get double tracking"
  echo "or a port conflict."
  read -r -p "Continue anyway? [y/N] " answer
  [[ "$answer" == "y" || "$answer" == "Y" ]] || exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents"

for label in "${LABELS[@]}"; do
  src="$REPO_DIR/launchd/${label}.plist"
  dst="$HOME/Library/LaunchAgents/${label}.plist"

  sed -e "s|BUN_PATH|$BUN_BIN|" \
      -e "s|/Users/shaho/Desktop/dev/fable01|$REPO_DIR|" \
      "$src" > "$dst"

  launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$dst"
  echo "loaded: $label"
done

echo
echo "Done. Dashboard: http://localhost:4242 (build it once: cd web && bun run build)"
echo "Logs: /tmp/timetrack.log /tmp/timetrack-server.log (+ .err)"
echo
echo "If window titles show up empty in reports, give bun Screen Recording"
echo "permission: System Settings → Privacy & Security → Screen Recording →"
echo "add $BUN_BIN"
