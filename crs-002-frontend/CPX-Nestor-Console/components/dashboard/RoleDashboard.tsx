"use client";

// One renderer for every role.
//
// It receives a list of widgets and draws them. It does not know which role it
// is drawing for, does not fetch, and does not decide what anyone may see: by
// the time a widget reaches here the projector has already removed what the
// role may not receive.
//
// That is why the five dashboards look like one product. Spacing, type scale,
// empty states and table behaviour are defined once, so a leadership dashboard
// cannot drift into looking like a different application from the responder's.

import Link from "next/link";
import type {
  Cell,
  Column,
  Kpi,
  RoleDashboardResult,
  Widget,
} from "@/lib/dashboard/types";
import { gstDateTime } from "@/lib/format";
import {
  ColumnInfo,
  ConfidenceValue,
  MonoValue,
  TypeBadge,
  T_FLUSH,
  T_HEAD,
  T_NUM,
  T_ROW,
  T_SCROLL,
  T_TABLE,
  T_TD,
  T_TH,
} from "@/components/table";
import { BarListH } from "@/components/chart/BarListH";
import { Donut } from "@/components/chart/Donut";
import {
  LineChart,
  scaleRatio,
  separateScales,
} from "@/components/chart/LineChart";

export function RoleDashboard({ result }: { result: RoleDashboardResult }) {
  if (result.state === "loading") return <Skeleton />;

  if (result.state === "unavailable" || !result.data) {
    return (
      <Panel title="Dashboard">
        <p className="text-[13px] font-light">
          {result.note ?? "The intelligence data could not be reached."}
        </p>
        <p className="mt-1 text-[12px] font-light text-cpx-grey">
          Nothing below is stale data: there is no data to show.
        </p>
      </Panel>
    );
  }

  const d = result.data;

  if (result.state === "empty") {
    return (
      <Panel title="Dashboard">
        <p className="text-[13px] font-light">
          <span className="font-medium">0 findings</span> in the last{" "}
          {d.window.days} days.
        </p>
        <p className="mt-1 text-[12px] font-light text-cpx-grey">
          A zero here means nothing was collected or matched, never that there is
          nothing to find.
        </p>
      </Panel>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <p className="flex flex-wrap items-center gap-2 text-[11.5px] font-light text-cpx-grey">
        <span className="bg-black/5 px-1.5 text-cpx-black">{d.audience}</span>
        {result.source === "mock" && (
          <span className="bg-status-warn-fill px-1.5 text-status-warn-ink">
            Demonstration data
          </span>
        )}
        <span>
          {d.window.days} day window to {gstDateTime(d.window.to)}
        </span>
        {result.note && <span>· {result.note}</span>}
      </p>

      {d.widgets.map((w) => (
        <WidgetView key={w.id} widget={w} />
      ))}

      {/* Withheld data is stated with its count. Saying nothing would imply the
          dashboard is complete, which for these roles it deliberately is not. */}
      {d.withheld.length > 0 && (
        <p className="text-[11.5px] font-light text-cpx-grey">
          Withheld at this access level:{" "}
          {d.withheld
            .map((w) => `${w.count.toLocaleString("en-GB")} ${w.label}`)
            .join(", ")}
          .
        </p>
      )}
    </div>
  );
}

function WidgetView({ widget: w }: { widget: Widget }) {
  switch (w.kind) {
    case "kpis":
      return (
        <section className="grid grid-cols-1 gap-px border border-black/10 bg-black/10 sm:grid-cols-2 xl:grid-cols-4">
          {w.items.map((k) => (
            <KpiCard key={k.key} kpi={k} />
          ))}
        </section>
      );

    case "callout":
      return (
        <section
          className={`border p-4 ${
            w.tone === "critical"
              ? "border-cpx-red/40 bg-status-warn-fill"
              : w.tone === "warn"
                ? "border-black/10 bg-status-warn-fill"
                : "border-black/10 bg-white"
          }`}
        >
          <h2
            className={`text-[15px] font-medium capitalize tracking-tightish ${
              w.tone === "neutral" ? "" : "text-status-warn-ink"
            }`}
          >
            {w.title}
          </h2>
          <p className="mt-1.5 max-w-3xl text-[13px] font-light leading-relaxed">
            {w.body}
          </p>
          {w.points && (
            <ul className="mt-2 space-y-0.5">
              {w.points.map((p) => (
                <li key={p} className="text-[12px] font-light text-cpx-grey">
                  {p}
                </li>
              ))}
            </ul>
          )}
        </section>
      );

    case "donut":
      return (
        <Panel title={w.title} note={w.note}>
          <Donut slices={w.slices} colors={w.colors} totalLabel={w.totalLabel} />
        </Panel>
      );

    case "bars":
      return (
        <Panel title={w.title} note={w.note}>
          {w.items.length === 0 ? (
            <Zero what="entries" />
          ) : (
            <BarListH
              items={w.items}
              color={w.color}
              labelClass={w.labelClass ?? "w-40"}
            />
          )}
        </Panel>
      );

    case "line":
      return (
        <Panel title={w.title} note={w.note}>
          <LineChart
            labels={w.labels}
            series={w.series}
            xLabel={w.xLabel}
            yLabel={w.yLabel}
          />
          {w.explanation && (
            <p className="mt-2 max-w-3xl text-[11.5px] font-light leading-relaxed text-cpx-grey">
              {w.explanation}
              {separateScales(w.series) && (
                <>
                  {" "}
                  Collection runs about {scaleRatio(w.series)} times higher than
                  detection, so each has its own scale: on one axis the detection
                  line would sit flat against the baseline.
                </>
              )}
            </p>
          )}
        </Panel>
      );

    case "table":
      return (
        <Panel title={w.title} note={w.note}>
          {w.rows.length === 0 ? (
            <p className="text-[13px] font-light">{w.empty}</p>
          ) : (
            <DataTable columns={w.columns} rows={w.rows} />
          )}
        </Panel>
      );

    case "list":
      return (
        <Panel title={w.title} note={w.note}>
          {w.items.length === 0 ? (
            <p className="text-[13px] font-light">{w.empty}</p>
          ) : (
            <ul className="space-y-2.5">
              {w.items.map((it, i) => (
                <li key={i}>
                  <span className="flex flex-wrap items-baseline gap-2">
                    <span className="text-[13px] font-medium">
                      {it.href ? (
                        <Link
                          href={it.href}
                          className="text-cat-4 underline underline-offset-2"
                        >
                          {it.primary}
                        </Link>
                      ) : (
                        it.primary
                      )}
                    </span>
                    {it.meta && (
                      <span className="text-[11.5px] font-light text-cpx-grey">
                        {it.meta}
                      </span>
                    )}
                  </span>
                  {it.secondary && (
                    <span className="mt-0.5 block text-[12px] font-light text-cpx-grey">
                      {it.secondary}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      );

    case "stats":
      return (
        <Panel title={w.title} note={w.note}>
          <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
            {w.stats.map((s) => (
              <span key={s.label} className="flex flex-col">
                <span className="text-[11.5px] font-light text-cpx-grey">
                  {s.label}
                </span>
                <span
                  className={`text-[17px] font-medium ${
                    s.warn ? "text-status-warn-ink" : ""
                  }`}
                >
                  {s.value}
                </span>
              </span>
            ))}
          </div>
        </Panel>
      );
  }
}

/**
 * The one table in the role dashboards.
 *
 * Column widths go on the <colgroup>, and the heading carries the same padding
 * and alignment as its cells, so a heading always sits over its own column.
 */
function DataTable({ columns, rows }: { columns: Column[]; rows: Cell[][] }) {
  return (
    <div className={T_SCROLL}>
      <table className={`${T_TABLE} min-w-[40rem] text-[12.5px]`}>
        <colgroup>
          {columns.map((c) => (
            <col key={c.label} className={c.width} />
          ))}
        </colgroup>
        <thead>
          <tr className={T_HEAD}>
            {columns.map((c, ci) => (
              <th
                key={c.label}
                scope="col"
                className={`${T_TH} ${T_FLUSH} ${c.align === "right" ? T_NUM : ""}`}
              >
                {c.info ? (
                  <span className="inline-flex items-center">
                    {c.label}
                    <ColumnInfo
                      heading={c.label}
                      body={c.info}
                      // The exact value is already on each cell for the hover;
                      // this is the same value, gathered so it can be read
                      // without hunting for it row by row.
                      rows={rows.map((row) => ({
                        label: row[0]?.text ?? "",
                        value: row[ci]?.title ?? row[ci]?.text ?? "",
                      }))}
                    />
                  </span>
                ) : (
                  c.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={T_ROW}>
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`${T_TD} ${T_FLUSH} ${
                    columns[j]?.align === "right" ? T_NUM : ""
                  }`}
                >
                  <CellView cell={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CellView({ cell }: { cell: Cell }) {
  if (cell.percent !== undefined) return <ConfidenceValue value={cell.percent} />;
  if (cell.badge) return <TypeBadge label={cell.text} title={cell.title} />;

  const tone =
    cell.tone === "critical"
      ? "text-cpx-red"
      : cell.tone === "warn"
        ? "text-status-warn-ink"
        : cell.tone === "muted"
          ? "font-light text-cpx-grey"
          : "";

  // Monospace values are identifiers: they break anywhere rather than push the
  // table sideways, and they are the ones worth copying.
  if (cell.mono && !cell.href)
    return (
      <MonoValue
        value={cell.text}
        copy={cell.copy}
        title={cell.title}
        className={tone}
      />
    );

  const text = (
    <span
      className={`${cell.mono ? "break-all font-mono text-[11.5px]" : ""} ${tone}`}
    >
      {cell.text}
    </span>
  );

  // inline-flex, not flex: a right aligned column aligns its cells through
  // text-align, and a block level flex box would ignore it.
  return (
    <span
      className={`inline-flex max-w-full items-baseline gap-1.5 text-left ${
        cell.nowrap ? "whitespace-nowrap" : ""
      }`}
      title={cell.title}
    >
      {cell.swatch && (
        <span
          aria-hidden
          className="mt-[3px] h-2.5 w-2.5 shrink-0 self-start"
          style={{ background: cell.swatch }}
        />
      )}
      {cell.href ? (
        <Link href={cell.href} className="text-cat-4 underline underline-offset-2">
          {text}
        </Link>
      ) : (
        text
      )}
    </span>
  );
}

export function KpiCard({ kpi }: { kpi: Kpi }) {
  const delta = kpi.previous === undefined ? null : kpi.value - kpi.previous;
  // Direction is stated in words as well as sign: colour alone carries nothing.
  const worse =
    delta === null || delta === 0
      ? false
      : kpi.higherIsWorse
        ? delta > 0
        : delta < 0;

  const body = (
    <div className="flex h-full flex-col bg-white px-4 py-3">
      <span className="text-[12px] font-light text-cpx-grey">{kpi.label}</span>
      <span className="mt-1.5 text-[28px] font-medium leading-none tracking-tightish">
        {kpi.value.toLocaleString("en-GB")}
      </span>
      <span className="mt-1.5 text-[11.5px] font-light text-cpx-grey">
        {kpi.unit}
        {kpi.window && <> · {kpi.window}</>}
      </span>
      {delta !== null && (
        <span
          className={`mt-1.5 text-[11.5px] font-light ${
            worse ? "text-status-warn-ink" : "text-cpx-grey"
          }`}
        >
          {delta === 0
            ? "unchanged on the previous period"
            : `${delta > 0 ? "up" : "down"} ${Math.abs(delta).toLocaleString("en-GB")} on the previous period`}
        </span>
      )}
    </div>
  );

  return kpi.href ? (
    <Link href={kpi.href} className="block hover:bg-black/[0.02]">
      {body}
    </Link>
  ) : (
    body
  );
}

export function Panel({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-black/10 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[13px] font-medium tracking-tightish">{title}</h2>
        {note && <span className="text-[11.5px] font-light text-cpx-grey">{note}</span>}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Zero({ what }: { what: string }) {
  return (
    <p className="text-[13px] font-light">
      <span className="font-medium">0 {what}</span>
    </p>
  );
}

export function Skeleton() {
  return (
    <div className="mt-4 space-y-4" aria-busy="true">
      <div className="grid grid-cols-1 gap-px border border-black/10 bg-black/10 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-white px-4 py-3">
            <span className="block h-3 w-24 bg-black/5" />
            <span className="mt-2 block h-7 w-16 bg-black/5" />
            <span className="mt-2 block h-3 w-32 bg-black/5" />
          </div>
        ))}
      </div>
      <div className="border border-black/10 bg-white p-4">
        <span className="block h-3 w-32 bg-black/5" />
        <span className="mt-3 block h-40 w-full bg-black/[0.03]" />
      </div>
    </div>
  );
}
