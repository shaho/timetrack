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
└─────────────┘                                      │ (later: web) │
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

## Tests

The heartbeat/AFK state machine is pure and platform-independent:

```sh
bun test
```

## Autostart (once you trust it)

See `launchd/com.shaho.timetrack.plist` — a launchd agent with `KeepAlive` so the daemon restarts if it dies. Instructions in the file.

## Roadmap

- [ ] Category rules (regex on app/title → "work", "distraction", …)
- [ ] Web dashboard (Vite/React) reading the same SQLite file
- [ ] Menu bar presence (Tauri tray or SwiftBar script)
- [ ] Browser extension for per-URL granularity
- [ ] Daily summary export
