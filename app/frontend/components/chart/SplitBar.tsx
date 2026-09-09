// Two-segment proportion bar with a 2px surface gap and direct labels.
// Counts live in ink beside a small swatch, never inside the fill.

const COLORS = ["var(--color-cat-1)", "var(--color-cat-2)"];

export function SplitBar({
  segments,
}: {
  segments: { label: string; value: number }[];
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  return (
    <div>
      <div className="flex h-5 w-full gap-0.5 bg-cpx-grey-50">
        {total > 0 &&
          segments.map((s, i) => (
            <span
              key={s.label}
              title={`${s.label}: ${s.value}`}
              style={{
                width: `${(s.value / total) * 100}%`,
                background: COLORS[i],
              }}
            />
          ))}
      </div>
      <div className="mt-2 flex items-center gap-5">
        {segments.map((s, i) => (
          <span key={s.label} className="flex items-center gap-1.5 text-xs">
            <span className="inline-block h-2.5 w-2.5" style={{ background: COLORS[i] }} />
            <span className="text-cpx-grey-500">{s.label}</span>
            <span className="font-medium">{s.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
