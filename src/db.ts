import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export interface IntervalRow {
  id: number;
  app: string;
  title: string;
  bundle_id: string | null;
  url: string | null;
  is_afk: number;
  started_at: number; // unix ms
  ended_at: number; // unix ms
}

export function openDb(path: string): Database {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path, { create: true });
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS intervals (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      app        TEXT NOT NULL,
      title      TEXT NOT NULL,
      bundle_id  TEXT,
      url        TEXT,
      is_afk     INTEGER NOT NULL DEFAULT 0,
      started_at INTEGER NOT NULL,
      ended_at   INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_intervals_started ON intervals (started_at);
  `);
  return db;
}

export interface IntervalStore {
  /** Insert a new interval, returns its id. */
  insert(row: Omit<IntervalRow, "id">): number;
  /** Extend an open interval's end time. */
  updateEnd(id: number, endedAt: number): void;
  /** Intervals overlapping [from, to), ordered by start. */
  between(from: number, to: number): IntervalRow[];
}

export function makeStore(db: Database): IntervalStore {
  const insertStmt = db.prepare(
    `INSERT INTO intervals (app, title, bundle_id, url, is_afk, started_at, ended_at)
     VALUES ($app, $title, $bundle_id, $url, $is_afk, $started_at, $ended_at)`,
  );
  const updateStmt = db.prepare(
    "UPDATE intervals SET ended_at = $ended_at WHERE id = $id",
  );
  const betweenStmt = db.prepare(
    `SELECT * FROM intervals
     WHERE ended_at > $from AND started_at < $to
     ORDER BY started_at ASC`,
  );

  return {
    insert(row) {
      const res = insertStmt.run({
        $app: row.app,
        $title: row.title,
        $bundle_id: row.bundle_id,
        $url: row.url,
        $is_afk: row.is_afk,
        $started_at: row.started_at,
        $ended_at: row.ended_at,
      });
      return Number(res.lastInsertRowid);
    },
    updateEnd(id, endedAt) {
      updateStmt.run({ $id: id, $ended_at: endedAt });
    },
    between(from, to) {
      return betweenStmt.all({ $from: from, $to: to }) as IntervalRow[];
    },
  };
}
