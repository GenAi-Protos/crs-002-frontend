import { gstDate } from "@/lib/format";

// Daily columns across the panel's width: one per day, evenly spaced, zero
// drawn as a stub so the day stays visible and hoverable. One hue, one axis:
// two measures are two of these, never a dual-axis chart. The day values are
// also in a visually hidden table, for anyone not using a pointer.

export function Sparkline({
  points,
  label,
  unit,
  height = 44,
  color = "var(--color-cat-1)",
}: {
  points: { date: string; value: number }[];
  label: string;
  unit: string;
  height?: number;
  color?: string;
}) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const last = points.length - 1;
  return (
    <div>
      <div className="chart-marks flex items-end gap-px" style={{ height }} aria-hidden>
        {points.map((p, i) => {
          const pos = i < 4 ? "left-0" : i > last - 4 ? "right-0" : "left-1/2 -translate-x-1/2";
          return (
            <span key={p.date} className="group relative flex h-full min-w-0 flex-1 items-end">
              <span
                className="bar-rise block w-full"
                style={{
                  height: p.value > 0 ? `${Math.max(8, (p.value / max) * 100)}%` : "2px",
                  background: p.value > 0 ? color : "var(--color-rule-strong)",
                  animationDelay: `${Math.min(i, 30) * 8}ms`,
                }}
              />
              <span
                className={`tip absolute bottom-full z-40 mb-1.5 w-max origin-bottom rounded-sm bg-brand px-2 py-1 text-2xs font-medium text-white shadow-pop ${pos}`}
              >
                {gstDate(p.date)} · {p.value.toLocaleString("en-GB")} {unit}
              </span>
            </span>
          );
        })}
      </div>
      {/* sr-only goes on a wrapper: a table grows to fit its rows whatever
          its height, so on the table itself it pushed <main> 600px taller. */}
      <div className="sr-only">
        <table>
          <caption>{label}</caption>
          <tbody>
            {points.map((p) => (
              <tr key={p.date}>
                <th scope="row">{gstDate(p.date)}</th>
                <td>{p.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
