import { useState } from "react";
import { fmtDuration, type DayReport } from "../api";

export function AppTable({ report }: { report: DayReport }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  // Top titles per app, computed lazily from raw intervals.
  const titlesFor = (app: string) => {
    const byTitle = new Map<string, number>();
    for (const iv of report.intervals) {
      if (iv.is_afk || iv.app !== app) continue;
      const key = iv.title || "(no title)";
      byTitle.set(key, (byTitle.get(key) ?? 0) + (iv.ended_at - iv.started_at));
    }
    return [...byTitle.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  };

  return (
    <table>
      <tbody>
        {report.apps.map(({ app, ms }) => (
          <AppRows
            key={app}
            app={app}
            ms={ms}
            expanded={expanded === app}
            onToggle={() => setExpanded(expanded === app ? null : app)}
            titles={expanded === app ? titlesFor(app) : null}
          />
        ))}
      </tbody>
    </table>
  );
}

function AppRows({
  app,
  ms,
  expanded,
  onToggle,
  titles,
}: {
  app: string;
  ms: number;
  expanded: boolean;
  onToggle: () => void;
  titles: [string, number][] | null;
}) {
  return (
    <>
      <tr className="app-row" onClick={onToggle}>
        <td className="app-name">
          {expanded ? "▾" : "▸"} {app}
        </td>
        <td className="app-time">{fmtDuration(ms)}</td>
      </tr>
      {expanded &&
        titles?.map(([title, tms]) => (
          <tr key={title} className="title-row">
            <td className="title-name">{title}</td>
            <td className="app-time">{fmtDuration(tms)}</td>
          </tr>
        ))}
    </>
  );
}
