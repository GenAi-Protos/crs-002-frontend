// Horizontal bar list: one series, identity lives in the row label, never in
// colour. Zero renders as an empty track with a 0, not as absence. Hovering a
// row steps the others back; `detail` adds a line to its tooltip.

export function BarListH({
  items,
  color = "var(--color-cat-1)",
  labelClass = "w-32",
}: {
  items: { label: string; value: number; color?: string; detail?: string }[];
  color?: string;
  labelClass?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="chart-marks space-y-1.5">
      {items.map((i, n) => (
        <li key={i.label} className="group relative flex items-center gap-2.5">
          <span title={i.label} className={`shrink-0 truncate text-xs text-ink-2 ${labelClass}`}>
            {i.label}
          </span>
          <span className="relative h-2.5 flex-1 bg-inset">
            <span
              className="bar-grow absolute inset-y-0 left-0"
              style={{
                width: `${(i.value / max) * 100}%`,
                background: i.color ?? color,
                animationDelay: `${n * 40}ms`,
              }}
            />
          </span>
          <span className="w-8 shrink-0 text-right text-sm font-medium tabular-nums">
            {i.value.toLocaleString("en-GB")}
          </span>
          {i.detail && (
            <span
              role="tooltip"
              className="tip absolute bottom-full right-0 z-40 mb-1 w-max origin-bottom-right rounded-sm bg-brand px-2 py-1 text-2xs font-medium text-white shadow-pop"
            >
              {i.label}: {i.detail}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
