/**
 * Local API + dashboard server.
 *
 *   bun run serve            → http://localhost:4242
 *
 * Endpoints:
 *   GET /api/report?date=YYYY-MM-DD   aggregated day report (default: today)
 *
 * In development run the Vite dev server (`bun run dev` inside web/),
 * which proxies /api here. After `vite build`, this server also serves
 * the static dashboard from web/dist.
 */
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { config } from "./config.ts";
import { makeStore, openDb } from "./db.ts";
import { loadRules, makeCategorizer } from "./categories.ts";

const PORT = Number(process.env.TIMETRACK_PORT ?? 4242);
const DIST = join(import.meta.dir, "..", "web", "dist");

const db = openDb(config.dbPath);
const store = makeStore(db);

export interface ReportInterval {
  app: string;
  title: string;
  url: string | null;
  category: string;
  is_afk: number;
  started_at: number;
  ended_at: number;
}

export interface DayReport {
  date: string;
  from: number;
  to: number;
  active_ms: number;
  afk_ms: number;
  categories: { name: string; ms: number }[];
  apps: { app: string; ms: number }[];
  intervals: ReportInterval[];
}

function dayReport(dateStr: string): DayReport | null {
  const day = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(day.getTime())) return null;
  const from = day.getTime();
  const to = from + 24 * 60 * 60 * 1000;

  // Reload rules per request so edits to categories.json apply on refresh.
  const categorize = makeCategorizer(loadRules());

  const intervals: ReportInterval[] = store.between(from, to).map((r) => ({
    app: r.app,
    title: r.title,
    url: r.url,
    category: r.is_afk ? "afk" : categorize(r.app, r.title, r.url),
    is_afk: r.is_afk,
    started_at: Math.max(r.started_at, from),
    ended_at: Math.min(r.ended_at, to),
  }));

  const categories = new Map<string, number>();
  const apps = new Map<string, number>();
  let activeMs = 0;
  let afkMs = 0;

  for (const iv of intervals) {
    const ms = iv.ended_at - iv.started_at;
    if (iv.is_afk) {
      afkMs += ms;
      continue;
    }
    activeMs += ms;
    categories.set(iv.category, (categories.get(iv.category) ?? 0) + ms);
    apps.set(iv.app, (apps.get(iv.app) ?? 0) + ms);
  }

  const desc = (a: { ms: number }, b: { ms: number }) => b.ms - a.ms;
  return {
    date: dateStr,
    from,
    to,
    active_ms: activeMs,
    afk_ms: afkMs,
    categories: [...categories].map(([name, ms]) => ({ name, ms })).sort(desc),
    apps: [...apps].map(([app, ms]) => ({ app, ms })).sort(desc),
    intervals,
  };
}

function localDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/api/report") {
      try {
        const date = url.searchParams.get("date") ?? localDateString(new Date());
        const report = dayReport(date);
        if (!report) {
          return Response.json({ error: `invalid date: ${date}` }, { status: 400 });
        }
        return Response.json(report);
      } catch (err) {
        console.error("[timetrack] /api/report failed:", err);
        return Response.json(
          { error: err instanceof Error ? err.message : String(err) },
          { status: 500 },
        );
      }
    }

    // Static dashboard (after `vite build`).
    if (existsSync(DIST)) {
      const path = url.pathname === "/" ? "/index.html" : url.pathname;
      const full = resolve(join(DIST, path));
      if (!full.startsWith(resolve(DIST))) {
        return new Response("nope", { status: 403 });
      }
      const file = Bun.file(full);
      if (await file.exists()) {
        const ext = path.slice(path.lastIndexOf("."));
        return new Response(file, {
          headers: { "content-type": MIME[ext] ?? "application/octet-stream" },
        });
      }
    }

    return new Response(
      "timetrack API. Dashboard not built yet — run `bun run build` in web/, or `bun run dev` there for development.",
      { status: 404 },
    );
  },
});

console.log(`[timetrack] serving on http://localhost:${PORT}`);
