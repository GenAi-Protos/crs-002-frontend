// Quiet column sparkline under a hero number. One hue from the sequential
// ramp so it never competes with the number it supports.

export function Sparkline({
  values,
  height = 44,
}: {
  values: number[];
  height?: number;
}) {
  const max = Math.max(1, ...values);
  const w = 14;
  const gap = 3;
  const width = values.length * (w + gap) - gap;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width, height }} role="img">
      {values.map((v, i) => {
        const h = Math.max(v > 0 ? 2 : 1, Math.round((v / max) * height));
        return (
          <rect
            key={i}
            x={i * (w + gap)}
            y={height - h}
            width={w}
            height={h}
            fill={v > 0 ? "var(--color-seq-4)" : "var(--color-rule)"}
          >
            <title>{String(v)}</title>
          </rect>
        );
      })}
    </svg>
  );
}
