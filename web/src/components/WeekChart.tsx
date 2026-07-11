import { useState } from "react";
import { categoryColor, fmtDuration, type WeekReport } from "../api";

const W = 1000;
const H = 240;
const GAP = 14;
const AXIS = 24;

/**
 * One stacked bar per day (Mon–Sun), segments colored by category.
 * Click a day to open it in the day view.
 */
export function WeekChart({
  report,
  onSelectDay,
}: {
  report: WeekReport;
  onSelectDay: (date: string) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);

  const maxMs = Math.max(...report.days.map((d) => d.active_ms), 1);
  const barW = (W - GAP * (report.days.length + 1)) / report.days.length;
  // Stack segments in a stable order: weekly-total rank.
  const order = report.categories.map((c) => c.name);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H + AXIS}`} className="timeline" role="img">
        {report.days.map((day, i) => {
          const x = GAP + i * (barW + GAP);
          const sorted = [...day.categories].sort(
            (a, b) => order.indexOf(a.name) - order.indexOf(b.name),
          );
          let y = H;
          const isHover = hover === day.date;
          return (
            <g
              key={day.date}
              onClick={() => onSelectDay(day.date)}
              onMouseEnter={() => setHover(day.date)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: "pointer" }}
            >
              <rect x={x} y={0} width={barW} height={H} fill="var(--surface)" rx={4} />
              {sorted.map((c) => {
                const h = (c.ms / maxMs) * H;
                y -= h;
                return (
                  <rect
                    key={c.name}
                    x={x}
                    y={y}
                    width={barW}
                    height={h}
                    fill={categoryColor(c.name)}
                    opacity={isHover ? 1 : 0.88}
                  />
                );
              })}
              <text x={x + barW / 2} y={H + AXIS - 7} textAnchor="middle" className="axis-label">
                {weekdayLabel(day.date)}
              </text>
              {day.active_ms > 0 && (
                <text
                  x={x + barW / 2}
                  y={Math.max(H - (day.active_ms / maxMs) * H - 6, 12)}
                  textAnchor="middle"
                  className="axis-label"
                >
                  {fmtDuration(day.active_ms)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="tooltip">
        {hover ? (
          <HoverDetail report={report} date={hover} />
        ) : (
          "hover a day for details, click to open it"
        )}
      </div>

      <div className="legend">
        {report.categories.map((c) => (
          <span key={c.name} className="legend-item">
            <span className="legend-dot" style={{ background: categoryColor(c.name) }} />
            {c.name} · {fmtDuration(c.ms)}
          </span>
        ))}
      </div>
    </div>
  );
}

function HoverDetail({ report, date }: { report: WeekReport; date: string }) {
  const day = report.days.find((d) => d.date === date);
  if (!day) return null;
  return (
    <>
      <b>{date}</b> {fmtDuration(day.active_ms)} active
      {day.categories.slice(0, 4).map((c) => (
        <span key={c.name}>
          {" · "}
          <span style={{ color: categoryColor(c.name) }}>{c.name}</span> {fmtDuration(c.ms)}
        </span>
      ))}
    </>
  );
}

function weekdayLabel(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en", { weekday: "short" });
}
