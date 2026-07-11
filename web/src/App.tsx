import { useCallback, useEffect, useState } from "react";
import {
  fetchReport,
  fetchWeek,
  fmtDuration,
  type DayReport,
  type WeekReport,
} from "./api";
import { Timeline } from "./components/Timeline";
import { CategoryBars } from "./components/CategoryBars";
import { AppTable } from "./components/AppTable";
import { WeekChart } from "./components/WeekChart";

type View = "day" | "week";

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
  const [view, setView] = useState<View>("day");
  const [date, setDate] = useState(today);
  const [day, setDay] = useState<DayReport | null>(null);
  const [week, setWeek] = useState<WeekReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const task =
      view === "day"
        ? fetchReport(date).then(setDay)
        : fetchWeek(date).then(setWeek);
    task
      .then(() => setError(null))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [view, date]);

  useEffect(() => {
    load();
    // Auto-refresh only when today is visible.
    const isCurrent = view === "day" ? date === today : date >= shiftDate(today, -6);
    if (!isCurrent) return;
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load, view, date, today]);

  const step = view === "day" ? 1 : 7;
  const jobHuntMs =
    (view === "day" ? day : week)?.categories.find((c) => c.name === "job-hunt")?.ms ?? 0;
  const report = view === "day" ? day : week;

  return (
    <main>
      <header>
        <h1>timetrack</h1>
        <nav>
          <div className="toggle">
            <button className={view === "day" ? "active" : ""} onClick={() => setView("day")}>
              day
            </button>
            <button className={view === "week" ? "active" : ""} onClick={() => setView("week")}>
              week
            </button>
          </div>
          <button onClick={() => setDate(shiftDate(date, -step))}>←</button>
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
          />
          <button onClick={() => setDate(shiftDate(date, step))} disabled={date >= today}>
            →
          </button>
          {date !== today && <button onClick={() => setDate(today)}>today</button>}
        </nav>
      </header>

      {error && <p className="error">{error}</p>}

      {report && (
        <section className="summary">
          <div className="stat" data-idx="01">
            <span className="stat-value">{fmtDuration(report.active_ms)}</span>
            <span className="stat-label">active</span>
          </div>
          {view === "day" && day && (
            <div className="stat" data-idx="02">
              <span className="stat-value">{fmtDuration(day.afk_ms)}</span>
              <span className="stat-label">afk</span>
            </div>
          )}
          <div className="stat highlight" data-idx="03">
            <span className="stat-value">{fmtDuration(jobHuntMs)}</span>
            <span className="stat-label">job-hunt</span>
          </div>
        </section>
      )}

      {view === "day" && day && (
        day.intervals.length === 0 ? (
          <p className="empty">No data for this day.</p>
        ) : (
          <>
            <section>
              <h2>Timeline</h2>
              <Timeline report={day} />
            </section>
            <section>
              <h2>Categories</h2>
              <CategoryBars report={day} />
            </section>
            <section>
              <h2>Apps</h2>
              <AppTable report={day} />
            </section>
          </>
        )
      )}

      {view === "week" && week && (
        week.active_ms === 0 ? (
          <p className="empty">No data for this week.</p>
        ) : (
          <section>
            <h2>Week of {week.start}</h2>
            <WeekChart
              report={week}
              onSelectDay={(d) => {
                setDate(d);
                setView("day");
              }}
            />
          </section>
        )
      )}
    </main>
  );
}
