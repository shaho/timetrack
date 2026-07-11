# timetrack

Local-first macOS time tracker. A small Bun daemon samples the frontmost window every few seconds, merges consecutive samples into intervals (the [ActivityWatch](https://activitywatch.net/) heartbeat trick), and stores everything in a local SQLite database. No cloud, no accounts, your data stays on your machine.

## Architecture

```
┌─────────────┐  poll 5s   ┌──────────────┐          ┌──────────────┐
│ get-windows │──────────▶ │   Tracker    │─────────▶│    SQLite    │
│ (active app,│            │ (heartbeat   │  upsert  │  intervals   │
│  title, url)│            │  merge + AFK)│          │    table     │
└─────────────┘            └──────────────┘          └──────┬───────┘
┌─────────────┐  idle sec        ▲                          │
│ ioreg (HID  │──────────────────┘                   ┌──────▼───────┐
│  IdleTime)  │                                      │  report CLI  │
└─────────────┘                                      │  + API/web   │
                                                     └──────────────┘
```

Design decisions:

- **Heartbeat merge, not events.** Each poll either extends the current interval row (same app+title, gap ≤ 15s) or starts a new one. Crash-safe: `ended_at` is updated every tick, so a force-quit loses at most one poll. Sleep/wake needs no special handling — the gap exceeds the merge window and a new interval starts.
- **AFK is retroactive.** When idle time crosses the threshold (default 120s), the active interval is trimmed back to when input actually stopped. Staring at a window without touching the machine doesn't count.
- **No native modules to compile.** `get-windows` ships prebuilt binaries; idle time comes from shelling out to `ioreg`. No node-gyp, works on Bun.
- **No server in v1.** The daemon writes SQLite directly; the report reads the same file. A REST API gets added when there's a second client that needs it.

## Setup

```sh
bun install
bun start
```

First run: macOS will prompt for **Screen Recording** permission (required to read window titles — this is a TCC restriction, not a choice). Grant it to your terminal app in System Settings → Privacy & Security → Screen Recording, then restart the daemon.

Leave it running. In another tab:

```sh
bun run report              # today
bun run report 2026-07-09   # specific day
```

## Configuration

Environment variables, all optional:

| Variable | Default | Meaning |
|---|---|---|
| `TIMETRACK_POLL_MS` | `5000` | Sampling interval |
| `TIMETRACK_MERGE_GAP_MS` | `15000` | Max gap to merge consecutive samples |
| `TIMETRACK_AFK_SEC` | `120` | Idle seconds before counting as AFK |
| `TIMETRACK_DB` | `~/Library/Application Support/timetrack/timetrack.db` | Database path |

## Dashboard

```sh
bun run serve            # API + static dashboard on http://localhost:4242
cd web && bun install
bun run dev              # Vite dev server on http://localhost:5173 (proxies /api)
```

For everyday use, build once and let the Bun server host it:

```sh
cd web && bun run build  # outputs web/dist, served by `bun run serve`
```

Two views: **day** (timeline colored by category, per-category bars, expandable per-app table) and **week** (stacked per-day bars, Mon–Sun; click a day to open it). Auto-refreshes every 30s when viewing the current day/week.

## Categories

Reports group time by category using regex rules in `categories.json` (created with defaults next to the database on first report). Each rule tests app name, window title, and/or URL — first match wins, no match is `uncategorized`. Rules are applied at read time, so editing them re-categorizes your entire history.

```json
{ "category": "job-hunt", "url": "linkedin\\.com|indeed\\." }
```

## Tests

The heartbeat/AFK state machine is pure and platform-independent:

```sh
bun test
```

## Autostart

```sh
./scripts/launchd-install.sh    # installs + starts the launchd agent
./scripts/launchd-uninstall.sh  # stops + removes it (data untouched)
```

Installs two agents: the watcher (`com.shaho.timetrack`) and the API/dashboard server (`com.shaho.timetrack.server`, port 4242). Both start at login and restart if they die (`KeepAlive`). Logs go to `/tmp/timetrack*.log` / `.err`. Build the dashboard once (`cd web && bun run build`) and it's permanently at [localhost:4242](http://localhost:4242).

If window titles come back empty after installing, grant the `bun` binary Screen Recording permission (TCC ties permissions to the spawning app; under launchd that's bun itself, not your terminal).

## Roadmap

- [x] Category rules (regex on app/title/url → "dev", "job-hunt", "distraction", …)
- [x] Web dashboard (Vite/React + local Bun API)
- [ ] Menu bar presence (Tauri tray or SwiftBar script)
- [ ] Browser extension for per-URL granularity
- [ ] Daily summary export
