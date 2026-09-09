"use client";

// A donut, for one whole divided into parts. Severity distribution is the case
// it exists for and close to the only one: the four levels are mutually
// exclusive and they sum to every finding.
//
// The total sits in the middle, because a proportion without its denominator is
// half a fact. The legend carries counts as well as percentages for the same
// reason: 40% of five and 40% of five thousand are different situations.

interface Slice {
  label: string;
  value: number;
}

export function Donut({
  slices,
  colors,
  size = 148,
  totalLabel,
}: {
  slices: Slice[];
  colors: string[];
  size?: number;
  totalLabel: string;
}) {
  const total = slices.reduce((n, s) => n + s.value, 0);
  const radius = size / 2;
  const thickness = size * 0.22;
  const r = radius - thickness / 2;
  const circumference = 2 * Math.PI * r;

  let offset = 0;

  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`${totalLabel}: ${slices
          .map((s) => `${s.label} ${s.value}`)
          .join(", ")}`}
      >
        <g transform={`rotate(-90 ${radius} ${radius})`}>
          {total === 0 ? (
            <circle
              cx={radius}
              cy={radius}
              r={r}
              fill="none"
              stroke="var(--color-seq-1)"
              strokeWidth={thickness}
            />
          ) : (
            slices.map((s, i) => {
              const length = (s.value / total) * circumference;
              const dash = `${length} ${circumference - length}`;
              const el = (
                <circle
                  key={s.label}
                  cx={radius}
                  cy={radius}
                  r={r}
                  fill="none"
                  stroke={colors[i % colors.length]}
                  strokeWidth={thickness}
                  strokeDasharray={dash}
                  strokeDashoffset={-offset}
                >
                  <title>
                    {s.label}: {s.value} of {total} (
                    {Math.round((s.value / total) * 100)}%)
                  </title>
                </circle>
              );
              offset += length;
              return el;
            })
          )}
        </g>
        <text
          x={radius}
          y={radius - 2}
          textAnchor="middle"
          className="fill-cpx-black"
          style={{ fontSize: 22, fontWeight: 500 }}
        >
          {total}
        </text>
        <text
          x={radius}
          y={radius + 14}
          textAnchor="middle"
          className="fill-cpx-grey"
          style={{ fontSize: 10, fontWeight: 400 }}
        >
          {totalLabel}
        </text>
      </svg>

      <ul className="min-w-[10rem] flex-1 space-y-1.5">
        {slices.map((s, i) => (
          <li key={s.label} className="flex items-center gap-2 text-xs">
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0"
              style={{ background: colors[i % colors.length] }}
            />
            <span className="">{s.label}</span>
            <span className="ml-auto font-medium">{s.value}</span>
            <span className="w-10 text-right text-cpx-grey">
              {total === 0 ? "0%" : `${Math.round((s.value / total) * 100)}%`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
