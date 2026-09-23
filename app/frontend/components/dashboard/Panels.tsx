"use client";

// The dashboard's panels. Each one states the scope of its figures in its
// header (the period and client filters reach only the role's own work; the
// threat picture is everything held), owns its empty line, and links onward
// only where the role may go (lib/access.ts).

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  Button,
  CountBadge,
  EmptyState,
  Panel,
  PanelLink,
  SeverityBadge,
  SeverityPip,
  Stat,
  StatStrip,
  StatusPill,
  Tabs,
  Tooltip,
  tabPanelProps,
  type StatTone,
} from "@/components/ui";
import { T_HEAD, T_NUM, T_ROW, T_TABLE, T_TD, T_TH, TypeBadge } from "@/components/table";
import { BarListH } from "@/components/chart/BarListH";
import { SplitBar } from "@/components/chart/SplitBar";
import { Sparkline } from "@/components/chart/Sparkline";
import { IconChevronRight, IconInfo } from "@/components/icons";
import { agoFromNow, gstDate, gstDateTime, hoursLabel } from "@/lib/format";
import { userName } from "@/lib/users";
import { ADVISORY_STATE, statusLabel, statusTone } from "@/lib/status";
import type { Advisory } from "@/lib/types";
import {
  SEVERITIES,
  byCategory,
  fillDays,
  isNumericInsight,
  orderedCampaigns,
  recentAdvisories,
  severityCounts,
  urgentFindings,
  type Posture,
} from "@/lib/dashboard/intel";
import type {
  ActivityRow,
  AdvisoryRow,
  Campaign,
  DashboardView,
  Finding,
  IntelligenceDataset,
  SectorImpact,
  Severity,
  SourceHealth,
  ViewInsightItem,
  ViewQueueItem,
  Withheld,
} from "@/lib/dashboard/types";

// Backend hrefs that predate the current screens. The PIR screen lives under
// Manage; "/manage" meant the agent run history, removed from Manage on
// 23 September 2026, and a failed run is inspected on its case.
const MOVED: Record<string, string> = { "/pirs": "/manage?tab=pirs", "/manage": "/investigations" };
export const route = (href: string) => MOVED[href] ?? href;

const SEV_LABEL: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

// --- posture -------------------------------------------------------------------

const LEVEL: Record<
  IntelligenceDataset["threatLevel"]["level"],
  { ink: string; bar: string; label: string }
> = {
  severe: { ink: "text-cpx-red-700", bar: "var(--color-sev-critical)", label: "Severe" },
  high: { ink: "text-cpx-red-700", bar: "var(--color-sev-high)", label: "High" },
  elevated: { ink: "text-cpx-bright-700", bar: "var(--color-cpx-bright)", label: "Elevated" },
  moderate: { ink: "text-cpx-blue-700", bar: "var(--color-sev-medium)", label: "Moderate" },
  low: { ink: "text-green-contrast", bar: "var(--color-green-contrast)", label: "Low" },
};

/**
 * The headline: the threat picture only. Queue sizes live with the queues and
 * source health with collection, so no figure on the page is said twice.
 */
export function PosturePanel({ data, p }: { data: IntelligenceDataset; p: Posture }) {
  const level = LEVEL[data.threatLevel.level];
  // With nothing held the backend dates the level to the window start; that
  // would read as "changed a month ago", so the date only shows with findings.
  const since = data.findings.length > 0 ? ` · since ${gstDate(data.threatLevel.changedAt)}` : "";
  const tone = (n: number, t: StatTone): StatTone => (n > 0 ? t : "neutral");
  return (
    <Panel title="Threat posture" aside="All held intelligence" enter={0} flush>
      <div className="grid grid-cols-2 gap-px bg-cpx-grey-100 @4xl/page:grid-cols-6">
        <div className="col-span-2 flex min-w-0 gap-3 bg-white px-3 py-2.5">
          <span aria-hidden className="w-1 shrink-0 self-stretch" style={{ background: level.bar }} />
          <div className="min-w-0">
            <span className="block text-xs font-medium text-cpx-grey-600">Threat level</span>
            <span
              className={`mt-1 block font-display text-xl font-semibold leading-7 tracking-tightish ${level.ink}`}
            >
              {level.label}
            </span>
            <span
              className="mt-0.5 block text-2xs leading-4 text-cpx-grey-500"
              title={data.threatLevel.reason}
            >
              <span className="line-clamp-2">
                {data.threatLevel.reason}
                {since}
              </span>
            </span>
          </div>
        </div>
        <Stat
          label="Critical findings"
          value={p.critical}
          tone={tone(p.critical, "critical")}
          caption="Confidence 85+"
          href="/?tab=threats"
        />
        <Stat
          label="High findings"
          value={p.high}
          tone={tone(p.high, "high")}
          caption="Confidence 70 to 84"
          href="/?tab=threats"
        />
        <Stat
          label="Active campaigns"
          value={p.activeCampaigns}
          tone={tone(p.activeCampaigns, "warn")}
          caption={`of ${data.campaigns.length} tracked`}
          href="/?tab=threats"
        />
        <Stat
          label="Emerging"
          value={p.emerging}
          tone={tone(p.emerging, "warn")}
          caption="Hits under 72 hours"
        />
      </div>
    </Panel>
  );
}

// --- the role's own work --------------------------------------------------------

type Kpi = DashboardView["kpis"][number];

// Which way is bad, per KPI key: a tone only colours a number above zero.
const KPI_TONE: Record<string, StatTone> = {
  untriaged: "warn",
  changes: "warn",
  contradictions: "warn",
  "failed-runs": "critical",
  "review-age": "warn",
  "lookup-gaps": "warn",
  "coverage-gaps": "warn",
  unbriefed: "warn",
};

/** An hours figure reads in days past 48; its unit drops the word "hours". */
function kpiFigure(k: Kpi): { value: Kpi["value"]; caption: string } {
  if (typeof k.value === "number" && /^hours\b/.test(k.unit)) {
    return { value: hoursLabel(k.value), caption: k.unit.replace(/^hours\s*/, "") };
  }
  return { value: k.value, caption: k.unit };
}

export function RoleMetrics({
  kpis,
  last = false,
  compact = false,
}: {
  kpis: Kpi[];
  last?: boolean;
  /** Under the posture strip the role's figures are secondary, so smaller. */
  compact?: boolean;
}) {
  return (
    <StatStrip
      label="Role metrics"
      // Compact figures sit in a panel, so they answer to its width: four
      // across only where every label fits whole.
      className={`grid-cols-2 border-0 ${compact ? "@3xl:grid-cols-4" : "@3xl/page:grid-cols-4"} ${last ? "" : "border-b"}`}
    >
      {kpis.map((k) => {
        const f = kpiFigure(k);
        const bad = typeof k.value === "number" && k.value > 0;
        return (
          <Stat
            key={k.key}
            label={k.label}
            value={f.value}
            caption={f.caption}
            tone={bad ? (KPI_TONE[k.key] ?? "neutral") : "neutral"}
            href={k.href ? route(k.href) : undefined}
            size={compact ? "sm" : "md"}
          />
        );
      })}
    </StatStrip>
  );
}

export interface WorkList {
  key: string;
  title: string;
  total: number;
  items: ViewQueueItem[];
}

/** Queues, and list-shaped insights (triage, failures, limitations), as tabs. */
export function workLists(view: DashboardView): WorkList[] {
  return [
    ...view.queues,
    ...view.insights
      .filter((i) => !isNumericInsight(i) && !i.items.some((x) => x.briefings || x.summaryEndpoint))
      .map((i) => ({
        key: i.key,
        title: i.title,
        total: i.items.length,
        items: i.items.map((x, n) => ({
          ...x,
          id: x.id ?? `${i.key}-${n}`,
          title: x.title ?? x.label ?? "",
        })),
      })),
  ];
}

// "View all" goes to where the rows live.
function listHome(items: ViewQueueItem[]): string | null {
  const href = items.find((i) => i.href)?.href;
  if (!href) return null;
  if (href.startsWith("/reports/")) return "/reports";
  if (href.startsWith("/investigations/")) return "/investigations";
  return route(href);
}

export function AttentionPanel({
  view,
  filters,
  busy,
  canDraft,
  className = "",
}: {
  view: DashboardView;
  filters: ReactNode;
  busy: boolean;
  canDraft: boolean;
  className?: string;
}) {
  const lists = useMemo(() => workLists(view), [view]);
  const first = lists.find((l) => l.total > 0)?.key ?? lists[0]?.key ?? "";
  const [picked, setPicked] = useState<string | null>(null);
  const tab = lists.some((l) => l.key === picked) ? (picked as string) : first;
  const list = lists.find((l) => l.key === tab);
  const now = new Date();
  const shown = list?.items.slice(0, 6) ?? [];
  const home = list ? listHome(list.items) : null;

  return (
    <Panel
      title="Needs your attention"
      action={filters}
      enter={1}
      flush
      className={className}
      bodyClassName="@container"
    >
      <div aria-busy={busy} className={`transition-opacity duration-200 ${busy ? "opacity-60" : ""}`}>
        <RoleMetrics kpis={view.kpis} compact />
        {lists.length > 0 && (
          <>
            <Tabs
              id="attention"
              label="Work queues"
              value={tab}
              onChange={setPicked}
              tabs={lists.map((l) => ({ key: l.key, label: l.title, count: l.total }))}
              className="px-2 pt-1"
            />
            <div {...tabPanelProps("attention", tab)}>
              {shown.length === 0 ? (
                <EmptyState>Nothing waiting.</EmptyState>
              ) : (
                <ul>
                  {shown.map((item) => (
                    <WorkRow key={item.id} item={item} now={now} draft={canDraft && list?.key === "triage"} />
                  ))}
                </ul>
              )}
              {list && list.total > shown.length && home && (
                <div className="flex justify-end border-t border-cpx-grey-100 px-3 py-1.5">
                  <PanelLink href={home}>View all {list.total}</PanelLink>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}

function WorkRow({ item, now, draft }: { item: ViewQueueItem; now: Date; draft: boolean }) {
  const when = item.updatedAt ?? item.createdAt;
  const who = item.assignedTo ?? item.owner;
  return (
    <li className="row-link relative flex items-center gap-2.5 border-b border-cpx-grey-100 px-3 py-1.5 last:border-b-0">
      {item.status && <StatusPill tone={statusTone(item.status)} label={statusLabel(item.status)} />}
      {item.href ? (
        <Link
          href={route(item.href)}
          title={item.title}
          className="min-w-0 flex-1 truncate text-sm font-medium after:absolute after:inset-0"
        >
          {item.title}
        </Link>
      ) : (
        <span className="min-w-0 flex-1 truncate text-sm font-medium" title={item.title}>
          {item.title}
        </span>
      )}
      {who && (
        <span className="hidden w-32 shrink-0 truncate text-xs text-cpx-grey-500 @xl:block">
          {userName(who)}
        </span>
      )}
      {when && (
        <span
          className="w-14 shrink-0 text-right text-xs tabular-nums text-cpx-grey-500"
          title={gstDateTime(when)}
        >
          {agoFromNow(when, now)}
        </span>
      )}
      {draft && <DraftLink id={item.id} title={item.title} label="Draft advisory" />}
      {item.href && <IconChevronRight className="lean shrink-0 text-cpx-grey-300" />}
    </li>
  );
}

// --- insights from the role payload -------------------------------------------

type Insight = DashboardView["insights"][number];

export function InsightPanel({
  insight,
  window,
  onSummary,
  enter,
  className = "",
}: {
  insight: Insight;
  window: DashboardView["window"];
  onSummary: (endpoint: string) => void;
  enter?: number;
  className?: string;
}) {
  const items = insight.items;
  let body: ReactNode;
  if (insight.key === "trend") {
    const points = fillDays(items, window.to, window.days);
    const total = points.reduce((s, p) => s + p.value, 0);
    body = (
      <>
        <p className="mb-2 text-xs text-cpx-grey-500">
          <span className="font-medium text-cpx-black tabular-nums">{total}</span> released in {window.days}{" "}
          days
        </p>
        <Sparkline points={points} label={insight.title} unit="released" />
      </>
    );
  } else if (items.length === 0) {
    // Leadership's source-gap count exists only in this sentence, so it is
    // shown; everywhere else an empty insight is a zero, not a paragraph.
    body =
      insight.key === "source-gaps" ? (
        <p className="text-sm text-cpx-grey-700">{insight.description}</p>
      ) : (
        <EmptyState className="py-3">0 records</EmptyState>
      );
  } else if (isNumericInsight(insight)) {
    body = (
      <BarListH
        // Largest first, so the bars read as a ranking; ties by name.
        items={items
          .map((i) => ({ label: userName(i.label), value: i.value as number }))
          .sort((x, y) => y.value - x.value || x.label.localeCompare(y.label))}
        labelClass="w-28 @md:w-36"
      />
    );
  } else if (items.some((i) => i.briefings)) {
    body = <ClientBriefings items={items} onSummary={onSummary} />;
  } else {
    body = (
      <ul className="-mx-3 -my-3">
        {items.map((i, n) => (
          <InsightRow key={i.id ?? `${insight.key}-${n}`} item={i} onSummary={onSummary} />
        ))}
      </ul>
    );
  }
  return (
    <Panel
      title={insight.title}
      // A count beside a sentence that states another number would contradict
      // it; the trend states its own total.
      count={insight.key === "trend" || (items.length === 0 && insight.key === "source-gaps") ? undefined : items.length}
      enter={enter}
      className={className}
      bodyClassName="@container"
    >
      {body}
    </Panel>
  );
}

function InsightRow({ item, onSummary }: { item: ViewInsightItem; onSummary: (e: string) => void }) {
  const title = item.title ?? item.label ?? "";
  const value =
    item.value == null
      ? null
      : typeof item.value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(item.value)
        ? gstDate(item.value)
        : String(item.value);
  return (
    <li className="row-link relative flex items-center gap-2.5 border-b border-cpx-grey-100 px-3 py-1.5 last:border-b-0">
      {item.status && <StatusPill tone={statusTone(item.status)} label={statusLabel(item.status)} />}
      {item.summaryEndpoint ? (
        <button
          type="button"
          onClick={() => onSummary(item.summaryEndpoint!)}
          className="min-w-0 flex-1 truncate text-left text-sm font-medium after:absolute after:inset-0"
          title={title}
        >
          {title}
        </button>
      ) : item.href ? (
        <Link
          href={route(item.href)}
          className="min-w-0 flex-1 truncate text-sm font-medium after:absolute after:inset-0"
          title={title}
        >
          {title}
        </Link>
      ) : (
        <span className="min-w-0 flex-1 truncate text-sm" title={title}>
          {title}
        </span>
      )}
      {value && <span className="shrink-0 text-xs tabular-nums text-cpx-grey-500">{value}</span>}
      {(item.href || item.summaryEndpoint) && (
        <IconChevronRight className="lean shrink-0 text-cpx-grey-300" />
      )}
    </li>
  );
}

function ClientBriefings({ items, onSummary }: { items: ViewInsightItem[]; onSummary: (e: string) => void }) {
  return (
    <ul className="-mx-3 -my-3">
      {items.map((c, n) => (
        <li key={c.id ?? n} className="border-b border-cpx-grey-100 px-3 py-2 last:border-b-0">
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.label ?? c.title}</span>
            <CountBadge n={c.briefings?.length ?? 0} />
          </div>
          {c.briefings && c.briefings.length > 0 ? (
            <ul className="mt-1.5 space-y-1 border-l-2 border-cpx-grey-100 pl-2.5">
              {c.briefings.map((b, i) => (
                <li key={i} className="flex items-center gap-2 text-xs">
                  {b.summaryEndpoint ? (
                    <button
                      type="button"
                      onClick={() => onSummary(b.summaryEndpoint!)}
                      className="link-quiet min-w-0 flex-1 truncate text-left"
                    >
                      {b.title}
                    </button>
                  ) : (
                    <span className="min-w-0 flex-1 truncate">{b.title}</span>
                  )}
                  <span className="shrink-0 tabular-nums text-cpx-grey-500">{gstDate(b.publishedAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-2xs text-cpx-grey-500">0 published briefings</p>
          )}
        </li>
      ))}
    </ul>
  );
}

// --- the threat picture (technical roles) --------------------------------------

/** Seeds the Intelligence composer with a finding or a PIR hit. */
function DraftLink({ id, title, label = "Draft" }: { id: string; title: string; label?: string }) {
  return (
    <Link
      href={`/intelligence?draft=${encodeURIComponent(id)}`}
      title={`Draft an advisory: ${title}`}
      className="group/d relative z-10 inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded-sm text-xs font-medium text-link transition-colors duration-150 hover:text-cpx-purple"
    >
      {label}
      <IconChevronRight className="transition-transform duration-150 ease-out-quart group-hover/d:translate-x-0.5" />
    </Link>
  );
}

/**
 * Overview: the worst six findings, each with the context to judge it at a
 * glance. The full table is the Threats view.
 */
export function CriticalPanel({
  findings,
  canDraft,
  enter,
  className = "",
}: {
  findings: Finding[];
  canDraft: boolean;
  enter?: number;
  className?: string;
}) {
  const urgent = useMemo(() => urgentFindings(findings), [findings]);
  const rows = urgent.slice(0, 6);
  return (
    <Panel
      title="Critical and high findings"
      count={urgent.length}
      aside="Worst first"
      action={urgent.length > rows.length ? <PanelLink href="/?tab=threats">View all</PanelLink> : undefined}
      enter={enter}
      flush
      className={className}
    >
      {rows.length === 0 ? (
        <EmptyState>0 critical or high findings held.</EmptyState>
      ) : (
        <ul>
          {rows.map((f) => (
            <li
              key={f.id}
              className="row-link flex items-start gap-2.5 border-b border-cpx-grey-100 px-3 py-1.5 last:border-b-0"
            >
              <SeverityPip level={f.severity} className="mt-1.5" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" title={f.title}>
                  {f.title}
                </p>
                <p className="truncate text-2xs text-cpx-grey-500">
                  <span className="font-medium text-cpx-grey-700">{SEV_LABEL[f.severity]}</span> · {f.category} ·{" "}
                  {f.clientCount} {f.clientCount === 1 ? "client" : "clients"} · first seen {gstDate(f.firstSeen)}
                </p>
              </div>
              {canDraft && (
                <span className="pt-0.5">
                  <DraftLink id={f.id} title={f.title} />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function FindingsPanel({
  findings,
  canDraft,
  enter,
  className = "",
}: {
  findings: Finding[];
  canDraft: boolean;
  enter?: number;
  className?: string;
}) {
  const urgent = useMemo(() => urgentFindings(findings), [findings]);
  const [all, setAll] = useState(false);
  const rows = all ? urgent : urgent.slice(0, 8);
  return (
    <div id="findings" className={`scroll-mt-4 ${className}`}>
      <Panel
        title="Critical and high findings"
        count={urgent.length}
        aside={`Held · ${findings.length} findings in all`}
        enter={enter}
        flush
        className="h-full"
        bodyClassName="@container"
      >
        {urgent.length === 0 ? (
          <EmptyState>0 critical or high findings held.</EmptyState>
        ) : (
          <table className={`${T_TABLE} table-fixed`}>
            <colgroup>
              <col className="w-24" />
              <col />
              <col className="hidden w-36 @2xl:table-column" />
              <col className="hidden w-32 @4xl:table-column" />
              <col className="w-16" />
              <col className="hidden w-24 @xl:table-column" />
              {canDraft && <col className="w-20" />}
            </colgroup>
            <thead>
              <tr className={T_HEAD}>
                <th className={T_TH}>
                  <span className="inline-flex items-center gap-1">
                    Severity
                    <Tooltip
                      align="start"
                      side="bottom"
                      content="Banded from match confidence: 85 and over is critical, 70 to 84 is high."
                    >
                      <IconInfo className="text-cpx-grey-400" />
                    </Tooltip>
                  </span>
                </th>
                <th className={T_TH}>Finding</th>
                <th className={`${T_TH} hidden @2xl:table-cell`}>Category</th>
                <th className={`${T_TH} hidden @4xl:table-cell`}>Sectors</th>
                <th className={`${T_TH} ${T_NUM}`}>Clients</th>
                <th className={`${T_TH} hidden @xl:table-cell`}>First seen</th>
                {canDraft && (
                  <th className={T_TH}>
                    <span className="sr-only">Action</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => (
                <tr key={f.id} className="row-link border-b border-cpx-grey-100 last:border-b-0">
                  <td className={T_TD}>
                    <SeverityBadge level={f.severity} />
                  </td>
                  <td className={T_TD}>
                    <span className="block truncate font-medium" title={f.title}>
                      {f.title}
                    </span>
                  </td>
                  <td className={`${T_TD} hidden text-cpx-grey-700 @2xl:table-cell`}>
                    <span className="block truncate" title={f.category}>
                      {f.category}
                    </span>
                  </td>
                  <td className={`${T_TD} hidden text-cpx-grey-700 @4xl:table-cell`}>
                    <span className="block truncate" title={f.sectors.join(", ")}>
                      {f.sectors.join(", ") || "-"}
                    </span>
                  </td>
                  <td className={`${T_TD} ${T_NUM}`}>{f.clientCount}</td>
                  <td className={`${T_TD} hidden whitespace-nowrap text-xs text-cpx-grey-500 @xl:table-cell`}>
                    {gstDate(f.firstSeen)}
                  </td>
                  {canDraft && (
                    <td className={`${T_TD} text-right`}>
                      <DraftLink id={f.id} title={f.title} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {urgent.length > 8 && (
          <div className="flex justify-end border-t border-cpx-grey-100 px-3 py-1.5">
            <Button variant="ghost" size="sm" onClick={() => setAll((v) => !v)}>
              {all ? "Show fewer" : `Show all ${urgent.length}`}
            </Button>
          </div>
        )}
      </Panel>
    </div>
  );
}

/** Severity and PIR category in one panel: two cuts of the same held findings. */
export function BreakdownPanel({
  findings,
  enter,
  className = "",
}: {
  findings: Finding[];
  enter?: number;
  className?: string;
}) {
  const counts = severityCounts(findings);
  const cats = byCategory(findings);
  const head = "mb-2 text-xs font-medium text-cpx-grey-600";
  return (
    <Panel
      title="Findings breakdown"
      count={findings.length}
      aside="Held"
      enter={enter}
      className={className}
      bodyClassName="@container"
    >
      <div className="grid gap-x-6 gap-y-4 @xl:grid-cols-2">
        <section>
          <h3 className={head}>By severity</h3>
          <SplitBar
            unit="findings"
            segments={SEVERITIES.map((s) => ({
              label: SEV_LABEL[s],
              value: counts[s],
              color: `var(--color-sev-${s})`,
            }))}
          />
        </section>
        <section>
          <h3 className={head}>By PIR category</h3>
          {cats.length === 0 ? (
            <p className="text-sm text-cpx-grey-500">0 findings held.</p>
          ) : (
            <BarListH items={cats} labelClass="w-28 @md:w-40" />
          )}
        </section>
      </div>
    </Panel>
  );
}

export function CampaignsPanel({
  campaigns,
  canOpen,
  enter,
  className = "",
}: {
  campaigns: Campaign[];
  canOpen: boolean;
  enter?: number;
  className?: string;
}) {
  const rows = orderedCampaigns(campaigns).slice(0, 6);
  return (
    <div id="campaigns" className={`scroll-mt-4 ${className}`}>
      <Panel
        title="Campaigns"
        count={campaigns.length}
        aside="Active first"
        action={canOpen ? <PanelLink href="/reports">Reports</PanelLink> : undefined}
        enter={enter}
        flush
        className="h-full"
      >
        {rows.length === 0 ? (
          <EmptyState>0 campaigns tracked.</EmptyState>
        ) : (
          <ul>
            {rows.map((c) => (
              <li
                key={c.id}
                className="row-link relative border-b border-cpx-grey-100 px-3 py-1.5 last:border-b-0"
              >
                <div className="flex items-center gap-2">
                  {c.status === "active" && <StatusPill tone="warn" label="Active" />}
                  {canOpen && c.advisoryRef ? (
                    <Link
                      href={`/reports/${encodeURIComponent(c.advisoryRef)}`}
                      title={c.name}
                      className="min-w-0 flex-1 truncate text-sm font-medium after:absolute after:inset-0"
                    >
                      {c.name}
                    </Link>
                  ) : (
                    <span className="min-w-0 flex-1 truncate text-sm font-medium" title={c.name}>
                      {c.name}
                    </span>
                  )}
                  <span className="shrink-0 text-2xs tabular-nums text-cpx-grey-500" title="Last activity">
                    {gstDate(c.lastActivity)}
                  </span>
                </div>
                <p className="mt-0.5 truncate pl-0.5 text-2xs text-cpx-grey-500">
                  {[
                    c.status === "active" ? "" : statusLabel(c.status),
                    c.sectors.join(", "),
                    c.regions.join(", "),
                    `${c.clientCount} ${c.clientCount === 1 ? "client" : "clients"}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

export function RecentIntelPanel({
  advisories,
  canOpen,
  enter,
  className = "",
}: {
  advisories: AdvisoryRow[];
  canOpen: boolean;
  enter?: number;
  className?: string;
}) {
  const rows = recentAdvisories(advisories).slice(0, 6);
  const now = new Date();
  return (
    <Panel
      title="Latest reports"
      count={advisories.length}
      aside="Recently updated"
      action={canOpen ? <PanelLink href="/reports">All reports</PanelLink> : undefined}
      enter={enter}
      flush
      className={className}
      bodyClassName="@container"
    >
      {rows.length === 0 ? (
        <EmptyState>0 reports held.</EmptyState>
      ) : (
        <table className={`${T_TABLE} table-fixed`}>
          <colgroup>
            <col className="w-16" />
            <col />
            <col className="hidden w-52 @3xl:table-column" />
            <col className="w-28" />
            <col className="hidden w-36 @2xl:table-column" />
            <col className="w-20" />
          </colgroup>
          <thead>
            <tr className={T_HEAD}>
              <th className={T_TH}>Type</th>
              <th className={T_TH}>Report</th>
              <th className={`${T_TH} hidden @3xl:table-cell`}>Reference</th>
              <th className={T_TH}>Status</th>
              <th className={`${T_TH} hidden @2xl:table-cell`}>Owner</th>
              <th className={T_TH}>Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const state = ADVISORY_STATE[a.status as Advisory["status"]] ?? {
                tone: statusTone(a.status),
                label: statusLabel(a.status),
              };
              return (
                <tr key={a.ref} className={`${T_ROW} relative`}>
                  <td className={T_TD}>
                    <TypeBadge label={a.type} />
                  </td>
                  <td className={T_TD}>
                    {canOpen ? (
                      <Link
                        href={`/reports/${encodeURIComponent(a.ref)}`}
                        title={`${a.ref} · ${a.title}`}
                        className="block truncate font-medium after:absolute after:inset-0"
                      >
                        {a.title}
                      </Link>
                    ) : (
                      <span className="block truncate font-medium" title={a.title}>
                        {a.title}
                      </span>
                    )}
                  </td>
                  <td className={`${T_TD} hidden @3xl:table-cell`}>
                    <span className="block truncate font-mono text-2xs text-cpx-grey-500">{a.ref}</span>
                  </td>
                  <td className={T_TD}>
                    <StatusPill tone={state.tone} label={state.label} />
                  </td>
                  <td className={`${T_TD} hidden @2xl:table-cell`}>
                    <span className="block truncate text-xs text-cpx-grey-600">
                      {a.owner ? userName(a.owner) : "-"}
                    </span>
                  </td>
                  <td
                    className={`${T_TD} whitespace-nowrap text-xs tabular-nums text-cpx-grey-500`}
                    title={gstDateTime(a.updatedAt)}
                  >
                    {agoFromNow(a.updatedAt, now)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

export function ExposurePanel({
  sectors,
  regions,
  enter,
  className = "",
}: {
  sectors: SectorImpact[];
  regions: { label: string; value: number }[];
  enter?: number;
  className?: string;
}) {
  return (
    <Panel
      title="Exposure"
      aside="Held findings"
      enter={enter}
      className={className}
      bodyClassName="@container"
    >
      <div className="grid gap-4 @xl:grid-cols-2">
        <section>
          <h3 className="mb-2 text-xs font-medium text-cpx-grey-600">By client sector</h3>
          {sectors.length === 0 ? (
            <p className="text-sm text-cpx-grey-500">0 sectors exposed.</p>
          ) : (
            <BarListH
              labelClass="w-24 @md:w-32"
              items={[...sectors].sort((x, y) => y.findings - x.findings).map((s) => ({
                label: s.sector,
                value: s.findings,
                detail: `${s.findings} findings, ${s.criticalFindings} critical, ${s.clients} ${s.clients === 1 ? "client" : "clients"}`,
              }))}
            />
          )}
        </section>
        <section>
          <h3 className="mb-2 text-xs font-medium text-cpx-grey-600">By region</h3>
          {regions.length === 0 ? (
            <p className="text-sm text-cpx-grey-500">0 regions exposed.</p>
          ) : (
            <BarListH
            labelClass="w-24 @md:w-32"
            color="var(--color-cat-3)"
            items={[...regions].sort((x, y) => y.value - x.value || x.label.localeCompare(y.label))}
          />
          )}
        </section>
      </div>
    </Panel>
  );
}

export function TrendPanel({
  trend,
  enter,
  className = "",
}: {
  trend: IntelligenceDataset["trend"];
  enter?: number;
  className?: string;
}) {
  const hits = trend.map((t) => ({ date: t.date, value: t.detections }));
  const iocs = trend.map((t) => ({ date: t.date, value: t.indicators }));
  const sum = (xs: { value: number }[]) => xs.reduce((s, x) => s + x.value, 0);
  return (
    <Panel
      title="Collection activity"
      aside={`${trend.length} days`}
      enter={enter}
      className={className}
      bodyClassName="@container"
    >
      <div className="grid gap-x-6 gap-y-3 @2xl:grid-cols-2">
        {[
          { label: "PIR hits per day", unit: "hits", points: hits, color: "var(--color-cat-1)" },
          {
            label: "Indicators added per day",
            unit: "indicators",
            points: iocs,
            color: "var(--color-cat-3)",
          },
        ].map((s) => (
          <div key={s.label}>
            <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
              <span className="text-cpx-grey-700">{s.label}</span>
              <span className="text-cpx-grey-500">
                <span className="font-medium tabular-nums text-cpx-black">
                  {sum(s.points).toLocaleString("en-GB")}
                </span>{" "}
                in {s.points.length} days
              </span>
            </div>
            <Sparkline
              points={s.points}
              label={s.label}
              unit={s.unit}
              color={s.color}
              height={sum(s.points) ? 36 : 6}
            />
          </div>
        ))}
      </div>
    </Panel>
  );
}

/** "Edit PIR" mid-sentence reads "edit PIR": only the first letter drops. */
const sentenceTail = (label: string) => label[0].toLowerCase() + label.slice(1);

export function ActivityPanel({
  activity,
  canAudit,
  enter,
  className = "",
}: {
  activity: ActivityRow[];
  canAudit: boolean;
  enter?: number;
  className?: string;
}) {
  const now = new Date();
  const rows = activity.slice(0, 7);
  return (
    <Panel
      title="Recent activity"
      count={activity.length}
      aside="Newest first"
      action={canAudit ? <PanelLink href="/manage?tab=audit">Audit trail</PanelLink> : undefined}
      enter={enter}
      flush
      className={className}
    >
      {rows.length === 0 ? (
        <EmptyState>0 audit events recorded.</EmptyState>
      ) : (
        <ol>
          {rows.map((a, i) => (
            <li
              key={i}
              className="flex items-start gap-2 border-b border-cpx-grey-100 px-3 py-1.5 text-xs last:border-b-0"
            >
              <span className="min-w-0 flex-1">
                <span className="font-medium">{userName(a.actor)}</span>{" "}
                <span className="text-cpx-grey-700">{sentenceTail(statusLabel(a.action))}</span>
                {a.ref && <span className="ml-1 font-mono text-2xs text-cpx-grey-500">{a.ref}</span>}
              </span>
              <span
                className="shrink-0 tabular-nums text-cpx-grey-500"
                title={a.at ? gstDateTime(a.at) : undefined}
              >
                {a.at ? agoFromNow(a.at, now) : "-"}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

export function CollectionPanel({
  health,
  canOpen,
  enter,
  className = "",
}: {
  health: SourceHealth;
  canOpen: boolean;
  enter?: number;
  className?: string;
}) {
  const now = new Date();
  const sources = canOpen ? "/collection?tab=sources" : undefined;
  return (
    <Panel
      title="Collection health"
      aside={`${health.total} sources in the inventory`}
      action={sources ? <PanelLink href={sources}>Sources</PanelLink> : undefined}
      enter={enter}
      flush
      className={className}
    >
      <div className="grid grid-cols-2 gap-px bg-cpx-grey-100 @3xl/page:grid-cols-4">
        <Stat label="Enabled" value={health.enabled} caption={`of ${health.total} sources`} />
        <Stat
          label="Failing"
          value={health.failing}
          tone={health.failing > 0 ? "critical" : "neutral"}
          caption="sources"
          href={sources}
        />
        <Stat
          label="Silent, unexplained"
          value={health.silentUnexplained}
          tone={health.silentUnexplained > 0 ? "warn" : "neutral"}
          caption="sources"
          href={sources}
        />
        <Stat
          label="Last collection"
          value={health.lastCollection ? agoFromNow(health.lastCollection, now) : "Never"}
          caption={health.lastCollection ? gstDateTime(health.lastCollection) : undefined}
        />
      </div>
    </Panel>
  );
}

export function EmergingPanel({
  threats,
  enter,
}: {
  threats: IntelligenceDataset["emergingThreats"];
  enter?: number;
}) {
  const now = new Date();
  return (
    <Panel title="Emerging" count={threats.length} aside="Under 72 hours" enter={enter} flush>
      {threats.length === 0 ? (
        <EmptyState className="py-3">0 new hits in 72 hours.</EmptyState>
      ) : (
        <ul>
          {threats.slice(0, 5).map((t, i) => (
            <li
              key={i}
              className="flex items-center gap-2 border-b border-cpx-grey-100 px-3 py-1.5 last:border-b-0"
            >
              <SeverityPip level={t.severity} />
              <span
                className="min-w-0 flex-1 truncate text-sm"
                title={`${SEV_LABEL[t.severity]}: ${t.title}`}
              >
                {t.title}
              </span>
              <span className="shrink-0 text-2xs tabular-nums text-cpx-grey-500">
                {agoFromNow(t.firstSeen, now)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** Rule 5: what this role was not sent is counted, never silently absent. */
export function WithheldLine({ withheld }: { withheld: Withheld[] }) {
  if (withheld.length === 0) return null;
  return (
    <p className="flex items-center gap-2 text-xs text-cpx-grey-500">
      <IconInfo />
      {withheld.map((w) => `${w.count} ${w.label.toLowerCase()}`).join(", ")}, withheld at this access level.
    </p>
  );
}
