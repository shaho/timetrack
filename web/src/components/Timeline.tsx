import { useState } from "react";
import { categoryColor, fmtTime, type DayReport, type ReportInterval } from "../api";

const W = 1000;
const H = 56;
const AXIS = 18;

/**
 * The full day as one horizontal band, midnight → midnight,
 * every interval a rect colored by category. Zoomed to the active
 * part of the day (first to last interval, padded to whole hours).
 */
export function Timeline({ report }: { report: DayReport }) {
  const [hover, setHover] = useState<ReportInterval | null>(null);

  const first = report.intervals[0];
  const last = report.intervals[report.intervals.length - 1];
  if (!first || !last) return null;

  const HOUR = 3_600_000;
  const from = Math.max(report.from, Math.floor(first.started_at / HOUR) * HOUR);
  const to = Math.min(report.to, Math.ceil(last.ended_at / HOUR) * HOUR);
  const span = to - from;
  const x = (t: number) => ((t - from) / span) * W;

  const hours: number[] = [];
  for (let t = from; t <= to; t += HOUR) hours.push(t);
  // Thin labels out if the day is long.
  const step = Math.ceil(hours.length / 14);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H + AXIS}`} className="timeline" role="img">
        <rect x={0} y={0} width={W} height={H} fill="var(--surface)" rx={4} />
        {report.intervals.map((iv, i) => (
          <rect
            key={i}
            x={x(iv.started_at)}
            y={iv.is_afk ? H * 0.3 : 0}
            width={Math.max(x(iv.ended_at) - x(iv.started_at), 0.5)}
            height={iv.is_afk ? H * 0.4 : H}
            fill={categoryColor(iv.category)}
            opacity={hover === iv ? 1 : 0.88}
            onMouseEnter={() => setHover(iv)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
        {hours.map((t, i) =>
          i % step === 0 ? (
            <g key={t}>
              <line x1={x(t)} y1={0} x2={x(t)} y2={H} stroke="var(--bg)" strokeWidth={1} />
              <text x={x(t) + 3} y={H + AXIS - 5} className="axis-label">
                {fmtTime(t)}
              </text>
            </g>
          ) : null,
        )}
      </svg>
      <div className="tooltip">
        {hover ? (
          <>
            <b>{fmtTime(hover.started_at)}–{fmtTime(hover.ended_at)}</b>{" "}
            <span style={{ color: categoryColor(hover.category) }}>{hover.category}</span>{" "}
            {hover.is_afk ? "away from keyboard" : `${hover.app} — ${hover.title}`}
          </>
        ) : (
          "hover the timeline"
        )}
      </div>
    </div>
  );
}
