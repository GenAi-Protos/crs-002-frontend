// A proportion bar of one whole: segments in a fixed order, 2px surface gaps,
// counts in ink in the legend, never inside the fill. Hovering a segment
// steps its siblings back and names it with its exact count and share.

export function SplitBar({
  segments,
  unit = "records",
}: {
  segments: { label: string; value: number; color: string }[];
  unit?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const share = (v: number) => (total === 0 ? 0 : Math.round((v / total) * 100));
  return (
    <div>
      <div className="chart-marks flex h-3 w-full gap-0.5 bg-white">
        {total === 0 ? (
          <span className="h-full w-full bg-cpx-grey-100" title={`0 ${unit}`} />
        ) : (
          segments
            .filter((s) => s.value > 0)
            .map((s, i, shown) => (
              <span
                key={s.label}
                className="group relative h-full"
                style={{ width: `${(s.value / total) * 100}%` }}
              >
                <span
                  className="bar-grow block h-full"
                  style={{ background: s.color, animationDelay: `${i * 40}ms` }}
                />
                <span
                  role="tooltip"
                  className={`tip absolute bottom-full z-40 mb-1.5 w-max rounded-sm bg-cpx-purple px-2 py-1 text-2xs font-medium text-white shadow-pop ${
                    i === 0
                      ? "left-0 origin-bottom-left"
                      : i === shown.length - 1
                        ? "right-0 origin-bottom-right"
                        : "left-1/2 origin-bottom -translate-x-1/2"
                  }`}
                >
                  {s.label}: {s.value.toLocaleString("en-GB")} of {total.toLocaleString("en-GB")} ({share(s.value)}%)
                </span>
              </span>
            ))
        )}
      </div>
      <ul className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5">
        {segments.map((s) => (
          <li key={s.label} className="flex min-w-0 items-center gap-1.5 text-xs">
            <span aria-hidden className="inline-block h-2 w-2 shrink-0" style={{ background: s.color }} />
            <span className="truncate text-cpx-grey-500">{s.label}</span>
            <span className="ml-auto font-medium tabular-nums">{s.value.toLocaleString("en-GB")}</span>
            <span className="w-8 text-right text-2xs tabular-nums text-cpx-grey-500">{share(s.value)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
