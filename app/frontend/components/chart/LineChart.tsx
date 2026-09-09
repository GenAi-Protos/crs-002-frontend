"use client";

// A line chart, for movement over time.
//
// Two rules decide how it draws, and both exist because the first version of
// this chart was unreadable.
//
// The y axis starts at zero. A truncated axis makes a flat month look like a
// crisis, which on a threat dashboard is not a cosmetic problem.
//
// Two series of very different size get a plot each, stacked and sharing the x
// axis. Collection runs in the hundreds and detection in the tens: on one axis
// the detection line lies flat along the baseline and reads as "nothing
// happened". The alternative, a second y axis on the right, is worse - it lets
// two unrelated scales cross and invites the reader to see a relationship that
// the numbers do not contain. Separate plots keep both readable and compare
// nothing that should not be compared.

import { useRef, useState } from "react";

interface Series {
  label: string;
  color: string;
  values: number[];
}

/** Above this ratio between the largest values, one shared axis hides a series. */
const FACET_RATIO = 4;

/**
 * Whether these series have to be drawn on separate scales. Exported so a
 * caption can say why, and say it from the same rule the chart applies.
 */
export function separateScales(series: { values: number[] }[]): boolean {
  if (series.length !== 2) return false;
  const maxes = series.map((s) => Math.max(1, ...s.values));
  return Math.max(...maxes) / Math.max(1, Math.min(...maxes)) >= FACET_RATIO;
}

/** How many times bigger the larger series runs, for that sentence. */
export function scaleRatio(series: { values: number[] }[]): number {
  const maxes = series.map((s) => Math.max(1, ...s.values));
  return Math.round(Math.max(...maxes) / Math.max(1, Math.min(...maxes)));
}

const VIEW_W = 640;
const PAD_L = 54;
const PAD_R = 12;
const PAD_T = 18; // the first plot's own label sits in here
const AXIS_H = 34; // x labels plus the axis title
const ROW_GAP = 28; // room for the next plot's label between the two

/** A round ceiling, so the gridline numbers are ones a person would choose. */
function ceilingFor(values: number[]): number {
  const max = Math.max(1, ...values);
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  return Math.ceil(max / step) * step;
}

export function LineChart({
  labels,
  series,
  height = 168,
  yLabel,
  xLabel,
  /** Long-form labels for the tooltip, when the legend label is abbreviated. */
  valueUnit = "",
}: {
  labels: string[];
  series: Series[];
  height?: number;
  yLabel?: string;
  xLabel?: string;
  valueUnit?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Decided by the data, not by the caller: whichever dashboard shows this
  // chart, the same numbers produce the same shape.
  const facet = separateScales(series);

  const rows = facet ? series.length : 1;
  const chartH = facet ? Math.max(height, 96 * rows + AXIS_H + PAD_T) : height;
  const plotW = VIEW_W - PAD_L - PAD_R;
  const rowH = (chartH - PAD_T - AXIS_H - (rows - 1) * ROW_GAP) / rows;

  const x = (i: number) =>
    PAD_L + (labels.length <= 1 ? plotW / 2 : (i / (labels.length - 1)) * plotW);

  const rowTop = (r: number) => PAD_T + r * (rowH + ROW_GAP);
  const yIn = (r: number, v: number, ceiling: number) =>
    rowTop(r) + rowH - (v / ceiling) * rowH;

  // One ceiling per plot when facetted, one shared ceiling when not.
  const ceilings = facet
    ? series.map((s) => ceilingFor(s.values))
    : [ceilingFor(series.flatMap((s) => s.values))];

  // At most six x labels, evenly spaced, so they never collide.
  const labelEvery = Math.max(1, Math.ceil(labels.length / 6));

  // The crosshair finds the x position: the reader aims at a date, never at a
  // 2px line.
  const track = (clientX: number) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || labels.length === 0) return;
    const units = ((clientX - rect.left) / rect.width) * VIEW_W;
    const frac = (units - PAD_L) / plotW;
    const i = Math.round(frac * (labels.length - 1));
    setHover(Math.max(0, Math.min(labels.length - 1, i)));
  };

  const step = (delta: number) =>
    setHover((h) => {
      const next = (h ?? 0) + delta;
      return Math.max(0, Math.min(labels.length - 1, next));
    });

  return (
    <div>
      <div ref={wrapRef} className="relative">
        <svg
          viewBox={`0 0 ${VIEW_W} ${chartH}`}
          className="w-full focus:outline-none focus-visible:ring-1 focus-visible:ring-cpx-bright"
          style={{ height: chartH }}
          role="img"
          tabIndex={0}
          aria-label={`${yLabel ?? "Trend"}: ${series
            .map((s) => `${s.label}, ${s.values.at(-1)} at ${labels.at(-1)}`)
            .join("; ")}`}
          onMouseMove={(e) => track(e.clientX)}
          onMouseLeave={() => setHover(null)}
          onFocus={() => setHover((h) => h ?? labels.length - 1)}
          onBlur={() => setHover(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") {
              e.preventDefault();
              step(1);
            }
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              step(-1);
            }
          }}
        >
          {/* The y axis title, once, however many plots there are. */}
          {yLabel && (
            <text
              transform={`translate(11 ${PAD_T + (chartH - PAD_T - AXIS_H) / 2}) rotate(-90)`}
              textAnchor="middle"
              className="fill-cpx-grey-500"
              style={{ fontSize: 10, fontWeight: 400 }}
            >
              {yLabel}
            </text>
          )}

          {(facet ? series : [series[0]]).map((_, r) => {
            const ceiling = ceilings[r];
            return (
              <g key={r}>
                {[0, ceiling / 2, ceiling].map((t) => (
                  <g key={t}>
                    <line
                      x1={PAD_L}
                      x2={VIEW_W - PAD_R}
                      y1={yIn(r, t, ceiling)}
                      y2={yIn(r, t, ceiling)}
                      stroke="currentColor"
                      className={t === 0 ? "text-cpx-grey-400" : "text-cpx-grey-400"}
                      strokeWidth={1}
                    />
                    <text
                      x={PAD_L - 6}
                      y={yIn(r, t, ceiling) + 3}
                      textAnchor="end"
                      className="fill-cpx-grey-500"
                      style={{ fontSize: 9, fontWeight: 400 }}
                    >
                      {t}
                    </text>
                  </g>
                ))}
                {/* Each plot says which series it holds, so identity never
                    depends on matching a colour to a legend. */}
                {facet && (
                  <g>
                    <line
                      x1={PAD_L}
                      x2={PAD_L + 14}
                      y1={rowTop(r) - 9}
                      y2={rowTop(r) - 9}
                      stroke={series[r].color}
                      strokeWidth={2}
                    />
                    <text
                      x={PAD_L + 20}
                      y={rowTop(r) - 6}
                      className="fill-cpx-black"
                      style={{ fontSize: 10, fontWeight: 400 }}
                    >
                      {series[r].label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {series.map((s, si) => {
            const r = facet ? si : 0;
            const ceiling = ceilings[r];
            return (
              <g key={s.label}>
                <polyline
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={s.values
                    .map((v, i) => `${x(i)},${yIn(r, v, ceiling)}`)
                    .join(" ")}
                />
                {s.values.map((v, i) => (
                  <circle
                    key={i}
                    cx={x(i)}
                    cy={yIn(r, v, ceiling)}
                    r={hover === i ? 4 : 2.5}
                    fill={s.color}
                    stroke="white"
                    strokeWidth={hover === i ? 1.5 : 0}
                  />
                ))}
              </g>
            );
          })}

          {/* The crosshair spans every plot: one pointer position, one date. */}
          {hover !== null && (
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD_T - 4}
              y2={chartH - AXIS_H}
              stroke="currentColor"
              className="text-cpx-grey-400"
              strokeWidth={1}
              strokeDasharray="3 2"
            />
          )}

          {labels.map((l, i) =>
            i % labelEvery === 0 || i === labels.length - 1 ? (
              <text
                key={l + i}
                x={x(i)}
                y={chartH - AXIS_H + 14}
                textAnchor="middle"
                className={hover === i ? "fill-cpx-black" : "fill-cpx-grey-500"}
                style={{ fontSize: 9, fontWeight: hover === i ? 500 : 400 }}
              >
                {l}
              </text>
            ) : null,
          )}

          {xLabel && (
            <text
              x={PAD_L + plotW / 2}
              y={chartH - 4}
              textAnchor="middle"
              className="fill-cpx-grey-500"
              style={{ fontSize: 10, fontWeight: 400 }}
            >
              {xLabel}
            </text>
          )}
        </svg>

        {/* One tooltip, every series: the pointer never has to land on a line
            to get a value. The number leads and the series name follows. */}
        {hover !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 w-max max-w-[15rem] -translate-x-1/2 border border-cpx-grey-100 bg-white px-2 py-1.5 shadow-pop"
            style={{
              left: `${Math.min(88, Math.max(12, (x(hover) / VIEW_W) * 100))}%`,
            }}
          >
            <p className="text-2xs font-medium">{labels[hover]}</p>
            {series.map((s) => (
              <p
                key={s.label}
                className="mt-0.5 flex items-baseline gap-1.5 text-2xs whitespace-nowrap"
              >
                <span
                  aria-hidden
                  className="mt-1 h-0.5 w-3 shrink-0"
                  style={{ background: s.color }}
                />
                <span className="font-medium">
                  {s.values[hover].toLocaleString("en-GB")}
                </span>
                <span className="text-cpx-grey-500">
                  {valueUnit ? `${valueUnit} ` : ""}
                  {s.label.toLowerCase()}
                </span>
              </p>
            ))}
          </div>
        )}
      </div>

      {/* A legend for two series or more; one series is named by the title. */}
      {series.length > 1 && (
        <ul className="mt-1 flex flex-wrap gap-x-5 gap-y-1">
          {series.map((s) => (
            <li
              key={s.label}
              className="flex items-baseline gap-1.5 text-2xs"
            >
              <span
                aria-hidden
                className="mt-1 h-0.5 w-4 shrink-0"
                style={{ background: s.color }}
              />
              {s.label}
              <span className="text-cpx-grey-500">
                {s.values.reduce((a, b) => a + b, 0).toLocaleString("en-GB")} in
                the window{facet ? ", own scale" : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
