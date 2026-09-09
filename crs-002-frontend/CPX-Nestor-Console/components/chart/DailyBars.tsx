// One source's 30 days as columns. The hatch marks attempted-with-zero-items,
// the same visual language as the Collection heatmap.

export function DailyBars({
  days,
  height = 140,
}: {
  days: { date: string; attempted: number; items: number }[];
  height?: number;
}) {
  const max = Math.max(1, ...days.map((d) => d.items));
  const colW = 16;
  const gap = 3;
  const labelH = 16;
  const plotH = height - labelH;
  const width = days.length * (colW + gap) - gap;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full max-w-full"
      style={{ maxHeight: height * 1.5 }}
      role="img"
    >
      <defs>
        <pattern id="zeroHatch" width="4" height="4" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <rect width="4" height="4" fill="#FFFFFF" />
          <rect width="2" height="4" fill="#DFDFDF" />
        </pattern>
      </defs>
      {days.map((d, i) => {
        const zeroWithAttempt = d.attempted > 0 && d.items === 0;
        const h = Math.max(d.items > 0 ? 3 : 2, Math.round((d.items / max) * (plotH - 4)));
        const x = i * (colW + gap);
        const day = parseInt(d.date.slice(8), 10);
        const showTick = i === 0 || day === 1 || day % 7 === 0;
        return (
          <g key={d.date}>
            <rect
              x={x}
              y={plotH - h}
              width={colW}
              height={h}
              fill={
                d.attempted === 0
                  ? "#F2F2F2"
                  : zeroWithAttempt
                    ? "url(#zeroHatch)"
                    : "var(--color-cat-1)"
              }
              stroke={zeroWithAttempt ? "#DFDFDF" : "none"}
              strokeWidth={zeroWithAttempt ? 0.5 : 0}
            >
              <title>{`${d.date}: ${d.items} items, ${d.attempted} attempts`}</title>
            </rect>
            {showTick && (
              <text
                x={x + colW / 2}
                y={height - 3}
                textAnchor="middle"
                fontSize="9"
                fontWeight="300"
                fill="#333333"
              >
                {d.date.slice(8)}
              </text>
            )}
          </g>
        );
      })}
      <line x1="0" x2={width} y1={plotH} y2={plotH} stroke="#DFDFDF" strokeWidth="1" />
    </svg>
  );
}
