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

export async function fetchReport(date: string): Promise<DayReport> {
  const res = await fetch(`/api/report?date=${encodeURIComponent(date)}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `API error ${res.status}`);
  }
  return res.json() as Promise<DayReport>;
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
  "job-hunt": "#e8590c",
  dev: "#2f9e44",
  design: "#9c36b5",
  learning: "#1971c2",
  communication: "#f08c00",
  distraction: "#e03131",
  uncategorized: "#868e96",
  afk: "#343a40",
};

const FALLBACK = ["#0ca678", "#6741d9", "#c2255c", "#3b5bdb", "#66a80f"];

export function categoryColor(name: string): string {
  const known = PALETTE[name];
  if (known) return known;
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return FALLBACK[Math.abs(hash) % FALLBACK.length]!;
}
