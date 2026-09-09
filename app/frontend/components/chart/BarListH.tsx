// Horizontal bar list: one series, identity lives in the row label, never in
// colour. Zero renders as an empty track with a 0, not as absence.

export function BarListH({
  items,
  color = "var(--color-cat-1)",
  labelClass = "w-40 xl:w-64",
}: {
  items: { label: string; value: number; color?: string }[];
  color?: string;
  labelClass?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-2.5">
          <span
            title={i.label}
            className={`shrink-0 truncate text-[12.5px] font-light text-cpx-grey ${labelClass}`}
          >
            {i.label}
          </span>
          <span className="relative h-3.5 flex-1 bg-black/5" title={`${i.label}: ${i.value}`}>
            <span
              className="absolute inset-y-0 left-0"
              style={{ width: `${(i.value / max) * 100}%`, background: i.color ?? color }}
            />
          </span>
          <span className="w-9 shrink-0 text-right text-[13.5px] font-medium">
            {i.value}
          </span>
        </li>
      ))}
    </ul>
  );
}
