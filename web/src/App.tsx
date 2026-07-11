import { useCallback, useEffect, useState } from "react";
import { fetchReport, fmtDuration, type DayReport } from "./api";
import { Timeline } from "./components/Timeline";
import { CategoryBars } from "./components/CategoryBars";
import { AppTable } from "./components/AppTable";

function localDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return localDateString(d);
}

export function App() {
  const today = localDateString(new Date());
  const [date, setDate] = useState(today);
  const [report, setReport] = useState<DayReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchReport(date)
      .then((r) => {
        setReport(r);
        setError(null);
      })
      .catch((e: unknown) => setError(String(e)));
  }, [date]);

  useEffect(() => {
    load();
    // Live-ish dashboard: refresh every 30s when viewing today.
    if (date !== today) return;
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load, date, today]);

  return (
    <main>
      <header>
        <h1>timetrack</h1>
        <nav>
          <button onClick={() => setDate(shiftDate(date, -1))}>←</button>
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
          />
          <button onClick={() => setDate(shiftDate(date, 1))} disabled={date >= today}>
            →
          </button>
          {date !== today && <button onClick={() => setDate(today)}>today</button>}
        </nav>
      </header>

      {error && <p className="error">{error}</p>}

      {report && (
        <>
          <section className="summary">
            <div className="stat">
              <span className="stat-value">{fmtDuration(report.active_ms)}</span>
              <span className="stat-label">active</span>
            </div>
            <div className="stat">
              <span className="stat-value">{fmtDuration(report.afk_ms)}</span>
              <span className="stat-label">afk</span>
            </div>
            <div className="stat">
              <span className="stat-value">
                {fmtDuration(
                  report.categories.find((c) => c.name === "job-hunt")?.ms ?? 0,
                )}
              </span>
              <span className="stat-label">job-hunt</span>
            </div>
          </section>

          {report.intervals.length === 0 ? (
            <p className="empty">No data for this day.</p>
          ) : (
            <>
              <section>
                <h2>Timeline</h2>
                <Timeline report={report} />
              </section>
              <section>
                <h2>Categories</h2>
                <CategoryBars report={report} />
              </section>
              <section>
                <h2>Apps</h2>
                <AppTable report={report} />
              </section>
            </>
          )}
        </>
      )}
    </main>
  );
}
