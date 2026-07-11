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

export interface WeekDay {
  date: string;
  active_ms: number;
  afk_ms: number;
  categories: { name: string; ms: number }[];
}

export interface WeekReport {
  start: string;
  days: WeekDay[];
  categories: { name: string; ms: number }[];
  active_ms: number;
}

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `API error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function fetchReport(date: string): Promise<DayReport> {
  return get<DayReport>(`/api/report?date=${encodeURIComponent(date)}`);
}

export function fetchWeek(date: string): Promise<WeekReport> {
  return get<WeekReport>(`/api/week?date=${encodeURIComponent(date)}`);
}

export function fmtDuration(ms: number): string {
  const totalMin = Math.round(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

export function fmtTime(t: number): string {
  return new Date(t).toTimeString().slice(0, 5);
}

const PALETTE: Record<string, string> = {
  "job-hunt": "#ff8500",
  dev: "#22c55e",
  design: "#b855ff",
  learning: "#0088ff",
  communication: "#e0e0ff",
  distraction: "#ef4444",
  uncategorized: "#606080",
  afk: "#1e293b",
};

const FALLBACK = ["#14b8a6", "#8b5cf6", "#ec4899", "#3b82f6", "#84cc16"];

export function categoryColor(name: string): string {
  const known = PALETTE[name];
  if (known) return known;
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return FALLBACK[Math.abs(hash) % FALLBACK.length]!;
}
