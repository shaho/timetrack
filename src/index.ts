import { activeWindow } from "get-windows";
import { config } from "./config.ts";
import { makeStore, openDb } from "./db.ts";
import { idleSeconds } from "./idle.ts";
import { Tracker, type Sample } from "./tracker.ts";

const db = openDb(config.dbPath);
const store = makeStore(db);
const tracker = new Tracker(store, {
  mergeGapMs: config.mergeGapMs,
  afkThresholdSec: config.afkThresholdSec,
});

async function poll(): Promise<void> {
  try {
    const [win, idle] = await Promise.all([
      activeWindow({ accessibilityPermission: true, screenRecordingPermission: true }),
      idleSeconds(),
    ]);

    const sample: Sample | null = win
      ? {
          app: win.owner.name,
          title: win.title,
          bundleId: "bundleId" in win.owner ? win.owner.bundleId : null,
          url: "url" in win && win.url ? win.url : null,
        }
      : null;

    tracker.tick(sample, idle);
  } catch (err) {
    // Never let one bad poll kill the daemon.
    console.error(`[timetrack] poll failed: ${String(err)}`);
  }
}

function shutdown(): void {
  tracker.close();
  db.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log(`[timetrack] watching (db: ${config.dbPath}, poll: ${config.pollIntervalMs}ms)`);
console.log("[timetrack] Ctrl-C to stop. Run `bun run report` in another tab to see data.");

await poll();
setInterval(poll, config.pollIntervalMs);
