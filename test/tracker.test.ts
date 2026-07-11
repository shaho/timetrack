import { describe, expect, test } from "bun:test";
import { Tracker, AFK_APP, type Sample } from "../src/tracker.ts";
import type { IntervalRow, IntervalStore } from "../src/db.ts";

/** In-memory store so tracker logic is testable without SQLite/macOS. */
function memStore(): IntervalStore & { rows: IntervalRow[] } {
  const rows: IntervalRow[] = [];
  return {
    rows,
    insert(row) {
      const id = rows.length + 1;
      rows.push({ id, ...row });
      return id;
    },
    updateEnd(id, endedAt) {
      const row = rows.find((r) => r.id === id);
      if (row) row.ended_at = endedAt;
    },
    between: () => rows,
  };
}

const opts = { mergeGapMs: 15_000, afkThresholdSec: 120 };
const code: Sample = { app: "Code", title: "tracker.ts", bundleId: null, url: null };
const chrome: Sample = { app: "Chrome", title: "HN", bundleId: null, url: "https://news.ycombinator.com" };

describe("Tracker heartbeat merge", () => {
  test("identical consecutive samples merge into one interval", () => {
    const store = memStore();
    const t = new Tracker(store, opts);
    t.tick(code, 0, 0);
    t.tick(code, 0, 5_000);
    t.tick(code, 0, 10_000);

    expect(store.rows).toHaveLength(1);
    expect(store.rows[0]!.started_at).toBe(0);
    expect(store.rows[0]!.ended_at).toBe(10_000);
  });

  test("app switch opens a new interval", () => {
    const store = memStore();
    const t = new Tracker(store, opts);
    t.tick(code, 0, 0);
    t.tick(code, 0, 5_000);
    t.tick(chrome, 0, 10_000);

    expect(store.rows).toHaveLength(2);
    expect(store.rows[0]!.ended_at).toBe(5_000);
    expect(store.rows[1]!.app).toBe("Chrome");
    expect(store.rows[1]!.url).toBe("https://news.ycombinator.com");
  });

  test("gap larger than mergeGapMs (sleep/crash) starts a fresh interval", () => {
    const store = memStore();
    const t = new Tracker(store, opts);
    t.tick(code, 0, 0);
    t.tick(code, 0, 5_000);
    t.tick(code, 0, 60_000); // 55s gap > 15s merge window

    expect(store.rows).toHaveLength(2);
    expect(store.rows[0]!.ended_at).toBe(5_000); // no phantom time during the gap
    expect(store.rows[1]!.started_at).toBe(60_000);
  });

  test("going AFK trims the active interval back to last input", () => {
    const store = memStore();
    const t = new Tracker(store, opts);
    t.tick(code, 0, 0);
    t.tick(code, 0, 5_000);
    // At t=130s the user has been idle 125s → input stopped at t=5s.
    t.tick(code, 125, 130_000);

    expect(store.rows).toHaveLength(2);
    expect(store.rows[0]!.ended_at).toBe(5_000); // trimmed
    expect(store.rows[1]!.app).toBe(AFK_APP);
    expect(store.rows[1]!.started_at).toBe(5_000);
    expect(store.rows[1]!.ended_at).toBe(130_000);
  });

  test("returning from AFK resumes normal tracking", () => {
    const store = memStore();
    const t = new Tracker(store, opts);
    t.tick(code, 0, 0);
    t.tick(code, 125, 130_000);
    t.tick(code, 1, 135_000); // user came back

    expect(store.rows).toHaveLength(3);
    expect(store.rows[2]!.app).toBe("Code");
    expect(store.rows[2]!.is_afk).toBe(0);
  });

  test("AFK trim never moves ended_at before started_at", () => {
    const store = memStore();
    const t = new Tracker(store, opts);
    // Interval opens at t=100s, but idle says input stopped at t=80s
    // (window changed without user input, e.g. a dialog appeared).
    t.tick(code, 0, 100_000);
    t.tick(code, 125, 200_000);

    expect(store.rows[0]!.ended_at).toBeGreaterThanOrEqual(store.rows[0]!.started_at);
  });

  test("null sample closes the open interval", () => {
    const store = memStore();
    const t = new Tracker(store, opts);
    t.tick(code, 0, 0);
    t.tick(null, 0, 5_000);
    t.tick(code, 0, 10_000);

    expect(store.rows).toHaveLength(2);
  });
});
