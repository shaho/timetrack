/**
 * Terminal report: per-app totals and timeline for a given day.
 *
 *   bun run report            → today
 *   bun run report 2026-07-09 → specific day
 */
import { config } from "./config.ts";
import { makeStore, openDb } from "./db.ts";
import type { IntervalRow } from "./db.ts";
import { loadRules, makeCategorizer, rulesPath } from "./categories.ts";

const arg = process.argv[2];
const day = arg ? new Date(`${arg}T00:00:00`) : new Date();
if (Number.isNaN(day.getTime())) {
  console.error(`Invalid date: ${arg} (expected YYYY-MM-DD)`);
  process.exit(1);
}
day.setHours(0, 0, 0, 0);
const from = day.getTime();
const to = from + 24 * 60 * 60 * 1000;

const db = openDb(config.dbPath);
const rows = makeStore(db).between(from, to);

if (rows.length === 0) {
  console.log(`No data for ${day.toDateString()}. Is the watcher running? (bun start)`);
  process.exit(0);
}

// Clamp intervals to the day's boundaries so totals are correct.
const clamped = rows.map((r) => ({
  ...r,
  started_at: Math.max(r.started_at, from),
  ended_at: Math.min(r.ended_at, to),
}));

const active = clamped.filter((r) => !r.is_afk);
const afkMs = sum(clamped.filter((r) => r.is_afk));
const totalMs = sum(active);

console.log(`\n${day.toDateString()} — active ${fmt(totalMs)}, afk ${fmt(afkMs)}\n`);

// ── Per-category totals ───────────────────────────────────────────
const categorize = makeCategorizer(loadRules());
const byCat = new Map<string, number>();
for (const r of active) {
  const cat = categorize(r.app, r.title, r.url);
  byCat.set(cat, (byCat.get(cat) ?? 0) + (r.ended_at - r.started_at));
}
const cats = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
const maxCatMs = cats[0]?.[1] ?? 1;

console.log(`Per category (rules: ${rulesPath()}):`);
for (const [cat, ms] of cats) {
  const pct = Math.round((ms / totalMs) * 100);
  const bar = "█".repeat(Math.max(1, Math.round((ms / maxCatMs) * 30)));
  console.log(`  ${cat.padEnd(16).slice(0, 16)} ${fmt(ms).padStart(8)} ${String(pct).padStart(3)}%  ${bar}`);
}
console.log();

// ── Per-app totals ────────────────────────────────────────────────
const byApp = new Map<string, number>();
for (const r of active) {
  byApp.set(r.app, (byApp.get(r.app) ?? 0) + (r.ended_at - r.started_at));
}
const apps = [...byApp.entries()].sort((a, b) => b[1] - a[1]);
const maxMs = apps[0]?.[1] ?? 1;

console.log("Per app:");
for (const [app, ms] of apps) {
  const bar = "█".repeat(Math.max(1, Math.round((ms / maxMs) * 30)));
  console.log(`  ${app.padEnd(24).slice(0, 24)} ${fmt(ms).padStart(8)}  ${bar}`);
}

// ── Top window titles ─────────────────────────────────────────────
const byTitle = new Map<string, number>();
for (const r of active) {
  const key = `${r.app} — ${r.title || "(no title)"}`;
  byTitle.set(key, (byTitle.get(key) ?? 0) + (r.ended_at - r.started_at));
}
const titles = [...byTitle.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

console.log("\nTop windows:");
for (const [title, ms] of titles) {
  console.log(`  ${fmt(ms).padStart(8)}  ${title.slice(0, 80)}`);
}

// ── Timeline (last 20 intervals) ──────────────────────────────────
console.log("\nRecent timeline:");
for (const r of clamped.slice(-20)) {
  const label = r.is_afk ? "(afk)" : `${r.app} — ${r.title}`;
  console.log(`  ${time(r.started_at)}–${time(r.ended_at)}  ${label.slice(0, 70)}`);
}
console.log();

function sum(rs: Pick<IntervalRow, "started_at" | "ended_at">[]): number {
  return rs.reduce((acc, r) => acc + (r.ended_at - r.started_at), 0);
}

function fmt(ms: number): string {
  const totalMin = Math.round(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m.toString().padStart(2, "0")}m` : `${m}m`;
}

function time(t: number): string {
  return new Date(t).toTimeString().slice(0, 5);
}
