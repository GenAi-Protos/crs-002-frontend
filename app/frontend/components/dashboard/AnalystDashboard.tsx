"use client";

// The TI Analyst dashboard.
//
// It takes a DashboardResult and draws it. It does not fetch, does not know
// whether the numbers came from an API or a fixture, and does not reach for a
// fixture of its own. Replacing the service's source changes nothing here.
//
// The order is the analyst's morning, not a layout: what needs doing, then how
// bad it is, then where it is coming from, then whether it is getting worse.
// Anything that did not answer one of those questions was left out.
//
// Chart choices are deliberate. A donut for severity, because the four levels
// are exclusive and sum to the whole. Bars for categories and indicator types,
// because the eye compares lengths and not angles. A line for the trend,
// because the points are evenly spaced in time. Tables where a table is
// clearer, which is most of the time.

import Link from "next/link";
import type {
  AnalystDashboard as Payload,
  DashboardResult,
  Kpi,
  QueueItem,
  Severity,
} from "@/lib/dashboard/types";
import { agoFromNow, gstDate, gstDateTime } from "@/lib/format";
import { BarListH } from "@/components/chart/BarListH";
import { Donut } from "@/components/chart/Donut";
import {
  LineChart,
  scaleRatio,
  separateScales,
} from "@/components/chart/LineChart";
import {
  Clipped,
  ColumnInfo,
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

const SEVERITY_COLOR: Record<Severity, string> = {
  critical: "var(--color-cpx-red)",
  high: "var(--color-cat-5)",
  medium: "var(--color-cat-1)",
  low: "var(--color-seq-3)",
};

// Fixed order, so the legend never reshuffles between loads.
const SEVERITY_ORDER = ["Critical", "High", "Medium", "Low"];
const SEVERITY_SLICE_COLORS = [
  "var(--color-cpx-red)",
  "var(--color-cat-5)",
  "var(--color-cat-1)",
  "var(--color-seq-3)",
];

const KIND_LABEL: Record<QueueItem["kind"], string> = {
  "pir-hit": "PIR hit",
  "report-review": "Review",
  rfi: "RFI",
  "source-issue": "Source",
};

export function AnalystDashboard({ result }: { result: DashboardResult }) {
  if (result.state === "loading") return <Skeleton />;

  if (result.state === "unavailable" || !result.data) {
    return (
      <Panel title="Dashboard">
        <p className="text-[13px] font-light">
          {result.note ?? "The dashboard data could not be reached."}
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
      <Provenance result={result} data={d} />

      {/* 1. The four numbers worth interrupting someone for. */}
      <section className="grid grid-cols-1 gap-px border border-black/10 bg-black/10 sm:grid-cols-2 xl:grid-cols-4">
        {d.kpis.map((k) => (
          <KpiCard key={k.key} kpi={k} />
        ))}
      </section>

      {/* 2. What to do now. A table, because every row is an action with a
             deadline and a name, and none of that survives a chart. */}
      <PriorityQueue items={d.priorityQueue} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel
          title="Severity distribution"
          note={`All findings in the last ${d.window.days} days`}
        >
          <Donut
            slices={[...d.severityDistribution].sort(
              (a, b) =>
                SEVERITY_ORDER.indexOf(a.label) - SEVERITY_ORDER.indexOf(b.label),
            )}
            colors={SEVERITY_SLICE_COLORS}
            totalLabel="findings"
          />
        </Panel>

        <Panel
          title="Findings by PIR category"
          note={`Last ${d.window.days} days`}
        >
          <BarListH
            items={d.threatsByCategory.map((b) => ({
              label: b.label,
              value: b.value,
            }))}
            labelClass="w-44"
          />
        </Panel>
      </div>

      <Panel
        title="Collection and detection over time"
        note={`${d.window.days} days to ${gstDate(d.window.to)}`}
      >
        <LineChart
          labels={d.detectionTrend.map((p) => gstDate(p.date).slice(0, 6))}
          xLabel="Date recorded"
          yLabel="Items recorded on that date"
          series={[
            {
              label: "Collected: indicators added",
              color: "var(--color-cat-2)",
              values: d.detectionTrend.map((p) => p.indicators),
            },
            {
              label: "Detected: findings raised",
              color: "var(--color-cat-1)",
              values: d.detectionTrend.map((p) => p.detections),
            },
          ]}
        />
        <TrendCaption points={d.detectionTrend} />
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Indicators by type" note={`Held, last ${d.window.days} days`}>
          <BarListH
            items={d.iocTypes}
            color="var(--color-cat-2)"
            labelClass="w-32"
          />
        </Panel>

        <TopActors rows={d.topActors} />
      </div>

      <SourceHealthRow health={d.sourceHealth} />
    </div>
  );
}

/**
 * One line under the chart. The house rule is that a screen needing an
 * explanation is the wrong screen, and a caption on a chart is the exception
 * that earns its place: two series named "indicators" and "findings" are not
 * self-evidently collection and detection, and the reader has to be told which
 * is which before the shape means anything.
 */
function TrendCaption({ points }: { points: Payload["detectionTrend"] }) {
  const series = [
    { values: points.map((p) => p.indicators) },
    { values: points.map((p) => p.detections) },
  ];
  return (
    <p className="mt-2 max-w-3xl text-[11.5px] font-light leading-relaxed text-cpx-grey">
      Shows the number of intelligence items collected and threats detected over
      time. Each point is the count recorded on that date.
      {separateScales(series) && (
        <>
          {" "}
          Collection runs about {scaleRatio(series)} times higher than detection,
          so each has its own scale: on one axis the detection line would sit
          flat against the baseline.
        </>
      )}
    </p>
  );
}

// --- provenance --------------------------------------------------------------

function Provenance({
  result,
  data,
}: {
  result: DashboardResult;
  data: Payload;
}) {
  return (
    <p className="flex flex-wrap items-center gap-2 text-[11.5px] font-light text-cpx-grey">
      {/* Where the numbers came from is never left to be assumed. */}
      {result.source === "mock" && (
        <span className="bg-status-warn-fill px-1.5 text-status-warn-ink">
          Demonstration data
        </span>
      )}
      <span>
        {data.window.days} day window to {gstDateTime(data.window.to)}
      </span>
      {result.note && <span>· {result.note}</span>}
    </p>
  );
}

// --- kpis --------------------------------------------------------------------

function KpiCard({ kpi }: { kpi: Kpi }) {
  const delta =
    kpi.previous === undefined ? null : kpi.value - kpi.previous;
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
            : `${delta > 0 ? "up" : "down"} ${Math.abs(delta).toLocaleString(
                "en-GB",
              )} on the previous period`}
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

// --- priority queue ----------------------------------------------------------

function PriorityQueue({ items }: { items: QueueItem[] }) {
  return (
    <Panel
      title="Needs attention"
      note={`${items.length} ${items.length === 1 ? "item" : "items"}, most urgent first`}
    >
      {items.length === 0 ? (
        <p className="text-[13px] font-light">
          <span className="font-medium">0 items</span> waiting.
        </p>
      ) : (
        <div className={T_SCROLL}>
          <table className={`${T_TABLE} min-w-[46rem] text-[13px]`}>
            <colgroup>
              <col className="w-24" />
              <col className="w-32" />
              <col className="w-52" />
              <col />
              <col className="w-20" />
              <col className="w-28" />
            </colgroup>
            <thead>
              <tr className={T_HEAD}>
                <th scope="col" className={`${T_TH} ${T_FLUSH}`}>Severity</th>
                <th scope="col" className={`${T_TH} ${T_FLUSH}`}>Type</th>
                <th scope="col" className={`${T_TH} ${T_FLUSH}`}>Reference</th>
                <th scope="col" className={`${T_TH} ${T_FLUSH}`}>Item</th>
                <th scope="col" className={`${T_TH} ${T_FLUSH} ${T_NUM}`}>Clients</th>
                <th scope="col" className={`${T_TH} ${T_FLUSH}`}>Due</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className={T_ROW}>
                  <td className={`${T_TD} ${T_FLUSH}`}>
                    <span className="flex items-baseline gap-1.5">
                      <span
                        aria-hidden
                        className="mt-[3px] h-2.5 w-2.5 shrink-0 self-start"
                        style={{ background: SEVERITY_COLOR[it.severity] }}
                      />
                      <span className="capitalize">{it.severity}</span>
                    </span>
                  </td>
                  <td className={`${T_TD} ${T_FLUSH}`}>
                    <TypeBadge label={KIND_LABEL[it.kind]} />
                  </td>
                  <td
                    className={`${T_TD} ${T_FLUSH} whitespace-nowrap font-mono text-[12px]`}
                  >
                    <Link
                      href={it.href}
                      className="text-cat-4 underline underline-offset-2"
                    >
                      {it.ref}
                    </Link>
                  </td>
                  {/* Clipped on purpose, and the full title is in the tooltip. */}
                  <td className={`${T_TD} ${T_FLUSH} max-w-0 font-light`}>
                    <Clipped text={it.title} />
                  </td>
                  <td className={`${T_TD} ${T_FLUSH} ${T_NUM} font-light`}>
                    {it.clientCount}
                  </td>
                  <td
                    className={`${T_TD} ${T_FLUSH} whitespace-nowrap font-light`}
                  >
                    {it.dueAt ? (
                      <span title={gstDateTime(it.dueAt)}>
                        {agoFromNow(it.dueAt)}
                      </span>
                    ) : (
                      <span className="text-cpx-grey">no deadline</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

// --- actors ------------------------------------------------------------------

function TopActors({ rows }: { rows: Payload["topActors"] }) {
  return (
    <Panel title="Most active threat actors" note="By held records in the window">
      {rows.length === 0 ? (
        <p className="text-[13px] font-light">
          <span className="font-medium">0 actors</span> in the window.
        </p>
      ) : (
        <div className={T_SCROLL}>
          <table className={`${T_TABLE} min-w-[26rem] text-[12.5px]`}>
            <colgroup>
              <col />
              <col className="w-20" />
              <col className="w-20" />
              <col className="w-28" />
            </colgroup>
            <thead>
              <tr className={T_HEAD}>
                <th scope="col" className={`${T_TH} ${T_FLUSH}`}>Actor</th>
                <th scope="col" className={`${T_TH} ${T_FLUSH} ${T_NUM}`}>Records</th>
                <th scope="col" className={`${T_TH} ${T_FLUSH} ${T_NUM}`}>Clients</th>
                <th scope="col" className={`${T_TH} ${T_FLUSH}`}>
                  <span className="inline-flex items-center">
                    Last seen
                    <ColumnInfo
                      heading="Last seen"
                      body="The most recent date a held record mentions this actor. It is when we last saw them in collected intelligence, not when they were last active: an actor with nothing collected this week may still be working. Times are GST."
                      rows={rows.map((a) => ({
                        label: a.name,
                        value: gstDateTime(a.lastSeen),
                      }))}
                    />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.name} className={T_ROW}>
                  <td className={`${T_TD} ${T_FLUSH}`}>
                    <span className="font-medium">{a.name}</span>
                    {a.aliases.length > 0 && (
                      <span className="mt-0.5 block text-[11px] font-light leading-snug text-cpx-grey">
                        {a.aliases.join(", ")}
                      </span>
                    )}
                  </td>
                  <td className={`${T_TD} ${T_FLUSH} ${T_NUM} font-light`}>
                    {a.records}
                  </td>
                  <td className={`${T_TD} ${T_FLUSH} ${T_NUM} font-light`}>
                    {a.clientsAffected}
                  </td>
                  <td
                    className={`${T_TD} ${T_FLUSH} whitespace-nowrap font-light`}
                    title={gstDateTime(a.lastSeen)}
                  >
                    {agoFromNow(a.lastSeen)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

// --- collection health -------------------------------------------------------

function SourceHealthRow({ health }: { health: Payload["sourceHealth"] }) {
  const problems = health.failing + health.silentUnexplained;
  return (
    <Panel title="Collection" note="Feeding everything above">
      <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2 text-[13px]">
        <Stat label="Sources" value={health.total} />
        <Stat label="Enabled" value={`${health.enabled} of ${health.total}`} />
        <Stat label="Failing" value={health.failing} warn={health.failing > 0} />
        <Stat
          label="Silent, unexplained"
          value={health.silentUnexplained}
          warn={health.silentUnexplained > 0}
        />
        <Stat
          label="Last collection"
          value={health.lastCollection ? agoFromNow(health.lastCollection) : "never"}
        />
      </div>
      {problems > 0 && (
        <p className="mt-2 text-[11.5px] font-light text-cpx-grey">
          {problems} {problems === 1 ? "source is" : "sources are"} not reporting.
          Counts above are lower than reality by whatever those sources hold.
        </p>
      )}
    </Panel>
  );
}

function Stat({
  label,
  value,
  warn,
}: {
  label: string;
  value: string | number;
  warn?: boolean;
}) {
  return (
    <span className="flex flex-col">
      <span className="text-[11.5px] font-light text-cpx-grey">{label}</span>
      <span className={`text-[17px] font-medium ${warn ? "text-status-warn-ink" : ""}`}>
        {value}
      </span>
    </span>
  );
}

// --- shell -------------------------------------------------------------------

function Panel({
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

function Skeleton() {
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
