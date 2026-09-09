// Grouped columns, one or two series. Square ends, 2px gaps, no gridlines.
// Legend renders whenever there are two series; only the latest group is
// direct-labelled, the rest carry native tooltips.

const COLORS = ["var(--color-cat-1)", "var(--color-cat-2)"];

export function Columns({
  groups,
  series,
  height = 128,
  formatValue = (v: number) => String(v),
}: {
  groups: { label: string; values: number[] }[];
  series: string[];
  height?: number;
  formatValue?: (v: number) => string;
}) {
  const max = Math.max(1, ...groups.flatMap((g) => g.values));
  const n = series.length;
  const colW = n === 1 ? 26 : 16;
  const gap = 2;
  const groupW = n * colW + (n - 1) * gap;
  const groupGap = 20;
  const width = groups.length * groupW + (groups.length - 1) * groupGap;
  const labelH = 16;
  const valueH = 14;
  const plotH = height - labelH - valueH;

  return (
    <div>
      {n > 1 && (
        <div className="mb-2 flex items-center gap-4">
          {series.map((s, i) => (
            <span key={s} className="flex items-center gap-1.5 text-[11px] font-light text-cpx-grey">
              <span className="inline-block h-2.5 w-2.5" style={{ background: COLORS[i] }} />
              {s}
            </span>
          ))}
        </div>
      )}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full max-w-full"
        style={{ maxHeight: height * 1.5 }}
        role="img"
      >
        {groups.map((g, gi) => {
          const x0 = gi * (groupW + groupGap);
          const last = gi === groups.length - 1;
          return (
            <g key={g.label}>
              {g.values.map((v, si) => {
                // A zero draws a neutral stub so the count stays visible and
                // its tooltip reachable, matching Sparkline's zero handling.
                const h = Math.max(v > 0 ? 2 : 1, Math.round((v / max) * (plotH - 2)));
                const x = x0 + si * (colW + gap);
                const y = valueH + (plotH - h);
                return (
                  <g key={si}>
                    <rect
                      x={x}
                      y={y}
                      width={colW}
                      height={h}
                      fill={v > 0 ? COLORS[si] : "#DFDFDF"}
                    >
                      <title>{`${g.label} ${series[si] ?? ""}: ${formatValue(v)}`}</title>
                    </rect>
                    {last && (
                      <text
                        x={x + colW / 2}
                        y={y - 3}
                        textAnchor="middle"
                        fontSize="10"
                        fontWeight="500"
                        fill="#040405"
                      >
                        {formatValue(v)}
                      </text>
                    )}
                  </g>
                );
              })}
              <line
                x1={x0}
                x2={x0 + groupW}
                y1={valueH + plotH}
                y2={valueH + plotH}
                stroke="#DFDFDF"
                strokeWidth="1"
              />
              <text
                x={x0 + groupW / 2}
                y={height - 3}
                textAnchor="middle"
                fontSize="10"
                fontWeight="300"
                fill="#333333"
              >
                {g.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
