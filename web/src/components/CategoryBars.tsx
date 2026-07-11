import { categoryColor, fmtDuration, type DayReport } from "../api";

export function CategoryBars({ report }: { report: DayReport }) {
  const max = report.categories[0]?.ms ?? 1;
  const total = report.active_ms || 1;

  return (
    <div className="bars">
      {report.categories.map((c) => (
        <div key={c.name} className="bar-row">
          <span className="bar-label">{c.name}</span>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{
                width: `${(c.ms / max) * 100}%`,
                background: categoryColor(c.name),
              }}
            />
          </div>
          <span className="bar-value">
            {fmtDuration(c.ms)} · {Math.round((c.ms / total) * 100)}%
          </span>
        </div>
      ))}
    </div>
  );
}
