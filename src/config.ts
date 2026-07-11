import { homedir } from "node:os";
import { join } from "node:path";

export interface Config {
  /** How often to sample the active window, in ms. */
  pollIntervalMs: number;
  /**
   * Max gap between two samples for them to still count as one interval.
   * If the machine sleeps or the daemon dies, the gap exceeds this and a
   * new interval starts — no phantom time.
   */
  mergeGapMs: number;
  /** Seconds of no keyboard/mouse input before the user counts as AFK. */
  afkThresholdSec: number;
  /** Absolute path to the SQLite database file. */
  dbPath: string;
}

const dataDir =
  process.env.TIMETRACK_DATA_DIR ??
  join(homedir(), "Library", "Application Support", "timetrack");

export const config: Config = {
  pollIntervalMs: Number(process.env.TIMETRACK_POLL_MS ?? 5_000),
  mergeGapMs: Number(process.env.TIMETRACK_MERGE_GAP_MS ?? 15_000),
  afkThresholdSec: Number(process.env.TIMETRACK_AFK_SEC ?? 120),
  dbPath: process.env.TIMETRACK_DB ?? join(dataDir, "timetrack.db"),
};
