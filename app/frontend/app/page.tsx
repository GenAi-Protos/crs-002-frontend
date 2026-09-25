"use client";

// The Dashboard: where do I start today. Two feeds, fetched in parallel, never
// substituted with demonstration data (CLAUDE.md rule 1):
//
//   /dashboard/views/{role}   the role's own work; honours period and client.
//   /dashboard/intelligence   the held threat picture, technical roles only.
//
// The threat picture is fetched only for the analyst, lead analyst and
// incident responder. For the business roles that payload still carries
// titles they may not receive (docs/04, backend follow-up), and rule 5 puts
// that filter in the payload, not the DOM, so the browser never asks for it.
//
// A refresh keeps what is on screen until the new figures land; only a role
// change clears it. Panels rise once on arrival and never again.
//
// The technical roles read one question per view, so no figure is said twice:
// Overview (my work, the worst findings, the latest reports), Threats (the
// held picture in full) and Operations (collection, team, audit). The view
// is in the URL (?tab=), so a posture figure can link straight to it.

import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useConsoleUser } from "@/lib/role-context";
import { workspaceRequest } from "@/lib/workspace-api";
import { gstDateTime } from "@/lib/format";
import { canSee } from "@/lib/access";
import { isNumericInsight, posture } from "@/lib/dashboard/intel";
import {
  Banner,
  Button,
  Dialog,
  EmptyState,
  Page,
  PageHeader,
  Panel,
  SegmentedControl,
  Select,
  SkeletonPanel,
  SkeletonRows,
  Tabs,
  TlpBadge,
  tabPanelProps,
} from "@/components/ui";
import { IconRefresh } from "@/components/icons";
import {
  ActivityPanel,
  AttentionPanel,
  BreakdownPanel,
  CampaignsPanel,
  CollectionPanel,
  CriticalPanel,
  EmergingPanel,
  ExposurePanel,
  FindingsPanel,
  InsightPanel,
  PosturePanel,
  RecentIntelPanel,
  RoleMetrics,
  TrendPanel,
  WithheldLine,
  workLists,
} from "@/components/dashboard/Panels";
import type { RoleKey, Client, Tlp } from "@/lib/types";
import type { DashboardView, IntelligenceResponse } from "@/lib/dashboard/types";

interface PublishedSummary {
  ref: string;
  title: string;
  type: string;
  publishedAt: string;
  summary: string;
  scope: { clientIds: string[]; clientNames: string[] };
  tlp: Tlp;
}

const AUDIENCE: Record<RoleKey, string> = {
  analyst: "TI Analyst",
  "lead-analyst": "Lead Analyst",
  "incident-responder": "Incident Responder",
  leadership: "CRS Leadership",
  executive: "Executive",
  sales: "Sales",
};

const TECHNICAL = new Set<RoleKey>(["analyst", "lead-analyst", "incident-responder"]);

type DashTab = "overview" | "threats" | "operations";

const VIEWS: { key: DashTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "threats", label: "Threats" },
  { key: "operations", label: "Operations" },
];

const PERIODS = [
  { key: "7", label: "7d" },
  { key: "30", label: "30d" },
  { key: "90", label: "90d" },
];

export default function Dashboard() {
  return (
    <Suspense>
      <DashboardInner />
    </Suspense>
  );
}

function DashboardInner() {
  const { user } = useConsoleUser();
  const technical = TECHNICAL.has(user.role);
  const params = useSearchParams();
  const tab = VIEWS.find((v) => v.key === params.get("tab"))?.key ?? "overview";
  // Next keeps useSearchParams in step with history.replaceState, so a tab
  // switch updates the address without a navigation or a refetch.
  const pickTab = (t: DashTab) => window.history.replaceState(null, "", t === "overview" ? "/" : `/?tab=${t}`);

  const [days, setDays] = useState(30);
  const [clientId, setClientId] = useState("");
  const [clients, setClients] = useState<Pick<Client, "id" | "name">[]>([]);
  const [refresh, setRefresh] = useState(0);
  const [turns, setTurns] = useState(0);

  const [view, setView] = useState<DashboardView | null>(null);
  const [viewBusy, setViewBusy] = useState(true);
  const [viewError, setViewError] = useState<string | null>(null);

  const [intel, setIntel] = useState<IntelligenceResponse | null>(null);
  const [intelError, setIntelError] = useState<string | null>(null);

  const [summary, setSummary] = useState<PublishedSummary | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // A different person or role: nothing of the previous view may linger.
  useEffect(() => {
    setView(null);
    setIntel(null);
    setViewError(null);
    setIntelError(null);
    setClientId("");
    setSummaryOpen(false);
  }, [user.id, user.role]);

  useEffect(() => {
    let active = true;
    workspaceRequest<{ items: Pick<Client, "id" | "name">[] }>(user.id, "/workspace/clients")
      .then((r) => active && setClients(r.items))
      .catch(() => active && setClients([]));
    return () => {
      active = false;
    };
  }, [user.id]);

  useEffect(() => {
    const update = () => setRefresh((n) => n + 1);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") update();
    }, 60_000);
    window.addEventListener("nestor:workspace-changed", update);
    return () => {
      clearInterval(timer);
      window.removeEventListener("nestor:workspace-changed", update);
    };
  }, []);

  useEffect(() => {
    const c = new AbortController();
    setViewBusy(true);
    const q = `?days=${days}${clientId ? `&clientId=${encodeURIComponent(clientId)}` : ""}`;
    workspaceRequest<DashboardView>(user.id, `/dashboard/views/${user.role}${q}`, { signal: c.signal })
      .then((next) => {
        if (c.signal.aborted) return;
        setView(next);
        setViewError(null);
      })
      .catch((e: Error) => {
        if (!c.signal.aborted) setViewError(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setViewBusy(false);
      });
    return () => c.abort();
  }, [user.id, user.role, days, clientId, refresh]);

  useEffect(() => {
    if (!TECHNICAL.has(user.role)) return;
    const c = new AbortController();
    workspaceRequest<IntelligenceResponse>(user.id, "/dashboard/intelligence", { signal: c.signal })
      .then((next) => {
        if (c.signal.aborted) return;
        setIntel(next);
        setIntelError(null);
      })
      .catch((e: Error) => {
        if (!c.signal.aborted) setIntelError(e.message);
      });
    return () => c.abort();
  }, [user.id, user.role, refresh]);

  async function openSummary(endpoint: string) {
    setSummary(null);
    setSummaryError(null);
    setSummaryOpen(true);
    try {
      setSummary(await workspaceRequest<PublishedSummary>(user.id, endpoint));
    } catch (cause) {
      setSummaryError(cause instanceof Error ? cause.message : "The published summary could not be loaded.");
    }
  }

  const retry = () => setRefresh((n) => n + 1);

  const filters = (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        aria-label="Dashboard client"
        value={clientId}
        onChange={(e) => setClientId(e.target.value)}
        fieldSize="sm"
        className="max-w-44"
      >
        <option value="">All accessible clients</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
      <SegmentedControl
        label="Dashboard period"
        options={PERIODS}
        value={String(days)}
        onChange={(v) => setDays(Number(v))}
      />
    </div>
  );

  const canReports = canSee(user.role, "reports");
  const canCollection = canSee(user.role, "collection");
  const canDraft = canSee(user.role, "intelligence");
  const numeric = view ? view.insights.filter(isNumericInsight) : [];
  const offlineBoth = technical && !!intelError && !intel && !!viewError && !view;
  // A view that needs the threat picture, before it lands or after it failed
  // (the banner above says why).
  const intelPending = intelError ? (
    <Panel ariaLabel="Threat picture">
      <EmptyState>Not loaded.</EmptyState>
    </Panel>
  ) : (
    <SkeletonPanel rows={6} />
  );

  return (
    <Page band>
      <PageHeader
        title="Dashboard"
        meta={
          <span className="flex min-w-0 items-center gap-2 border-l border-rule-strong pl-2.5 text-xs text-mute">
            <span className="whitespace-nowrap font-medium text-ink-2">{AUDIENCE[user.role]}</span>
            {view && (
              <span className="hidden truncate @2xl/page:inline">as of {gstDateTime(view.generatedAt)}</span>
            )}
          </span>
        }
        action={
          <Button
            onClick={() => {
              setTurns((t) => t + 1);
              retry();
            }}
          >
            {/* Half a turn per click: an acknowledgement, never a spinner. */}
            <span
              aria-hidden
              className="inline-flex transition-[rotate] duration-300 ease-out-quart"
              style={{ rotate: `${turns * 180}deg` }}
            >
              <IconRefresh />
            </span>
            Refresh
          </Button>
        }
      />

      <div className="space-y-3">
        {/* Both feeds down is one fault, said once. */}
        {offlineBoth && (
          <Banner
            action={
              <Button size="sm" onClick={retry}>
                Retry
              </Button>
            }
          >
            The dashboard could not be loaded. {viewError}
          </Banner>
        )}
        {technical && intelError && !intel && !offlineBoth && (
          <Banner
            action={
              <Button size="sm" onClick={retry}>
                Retry
              </Button>
            }
          >
            The threat picture could not be loaded. {intelError}
          </Banner>
        )}
        {viewError && !view && !offlineBoth && (
          <Banner
            action={
              <Button size="sm" onClick={retry}>
                Retry
              </Button>
            }
          >
            Your queues could not be loaded. {viewError}
          </Banner>
        )}

        {technical ? (
          <>
            {intel ? (
              <PosturePanel data={intel.data} p={posture(intel.data)} />
            ) : (
              !intelError && <SkeletonPanel rows={2} />
            )}

            {/* One question per view: Overview is where to start, Threats is
                the held picture in full, Operations is collection and team. */}
            <Tabs<DashTab> id="dash" label="Dashboard view" tabs={VIEWS} value={tab} onChange={pickTab} />

            <div {...tabPanelProps("dash", tab)} className="space-y-3">
              {tab === "overview" && (
                // One grid, two arrangements. Wide (a Teams tab at 90%): the
                // queue beside the worst findings, reports beneath. Narrower
                // (a laptop at 150%): the queue full width so its figures stay
                // four across, findings beside the reports.
                <div className="grid gap-3 @5xl/page:grid-cols-12">
                  {view ? (
                    <AttentionPanel
                      view={view}
                      filters={filters}
                      busy={viewBusy}
                      canDraft={canDraft}
                      className="@5xl/page:col-span-12 @6xl/page:col-span-8"
                    />
                  ) : (
                    !viewError && (
                      <SkeletonPanel rows={6} className="@5xl/page:col-span-12 @6xl/page:col-span-8" />
                    )
                  )}
                  <div className="flex min-w-0 flex-col gap-3 @5xl/page:col-span-5 @6xl/page:col-span-4">
                    {intel ? (
                      <>
                        <CriticalPanel
                          findings={intel.data.findings}
                          canDraft={canDraft}
                          enter={2}
                          className="flex-1"
                        />
                        {/* The strip counts emerging hits; the list earns a panel only when it has rows. */}
                        {intel.data.emergingThreats.length > 0 && (
                          <EmergingPanel threats={intel.data.emergingThreats} enter={3} />
                        )}
                      </>
                    ) : (
                      !intelError && <SkeletonPanel rows={6} className="flex-1" />
                    )}
                  </div>
                  {intel && (
                    <RecentIntelPanel
                      advisories={intel.data.advisories}
                      canOpen={canReports}
                      enter={3}
                      className="@5xl/page:col-span-7 @6xl/page:col-span-12"
                    />
                  )}
                </div>
              )}

              {tab === "threats" &&
                (intel ? (
                  // Wide: the table beside its breakdown. Narrower: the table
                  // full width, as on the Overview, so titles stay whole.
                  <div className="grid gap-3 @5xl/page:grid-cols-12">
                    <FindingsPanel
                      findings={intel.data.findings}
                      canDraft={canDraft}
                      enter={1}
                      className="@5xl/page:col-span-12 @6xl/page:col-span-8"
                    />
                    <BreakdownPanel
                      findings={intel.data.findings}
                      enter={2}
                      className="@5xl/page:col-span-12 @6xl/page:col-span-4"
                    />
                    <CampaignsPanel
                      campaigns={intel.data.campaigns}
                      canOpen={canReports}
                      enter={3}
                      className="@5xl/page:col-span-8"
                    />
                    <ExposurePanel
                      sectors={intel.data.sectors}
                      regions={intel.data.regions}
                      enter={3}
                      className="@5xl/page:col-span-4"
                    />
                  </div>
                ) : (
                  intelPending
                ))}

              {tab === "operations" &&
                (intel ? (
                  <>
                    <CollectionPanel health={intel.data.sourceHealth} canOpen={canCollection} enter={1} />
                    <div className="grid gap-3 @5xl/page:grid-cols-12">
                      <TrendPanel
                        trend={intel.data.trend}
                        enter={2}
                        className={numeric.length ? "@5xl/page:col-span-8" : "@5xl/page:col-span-12"}
                      />
                      {numeric.length > 0 && (
                        <div className="flex min-w-0 flex-col gap-3 @5xl/page:col-span-4">
                          {numeric.map((insight) => (
                            <InsightPanel
                              key={insight.key}
                              insight={insight}
                              window={view!.window}
                              onSummary={openSummary}
                              enter={2}
                              className="flex-1"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    <ActivityPanel activity={intel.data.activity} canAudit={canSee(user.role, "manage")} enter={3} />
                  </>
                ) : (
                  intelPending
                ))}
            </div>

            {intel && <WithheldLine withheld={intel.withheld} />}
          </>
        ) : view ? (
          <BusinessView view={view} filters={filters} busy={viewBusy} onSummary={openSummary} />
        ) : (
          !viewError && (
            <div className="grid gap-3 @5xl/page:grid-cols-12">
              <SkeletonPanel rows={6} className="@5xl/page:col-span-8" />
              <SkeletonPanel rows={4} className="@5xl/page:col-span-4" />
            </div>
          )
        )}
      </div>

      {summaryOpen && (
        <Dialog title="Published briefing" onClose={() => setSummaryOpen(false)} className="max-w-2xl">
          {summaryError ? (
            <Banner>{summaryError}</Banner>
          ) : summary ? (
            <article>
              <div className="mb-3 flex items-center gap-3">
                <TlpBadge tlp={summary.tlp} />
                <span className="text-2xs text-mute">
                  {summary.ref} · {gstDateTime(summary.publishedAt)}
                </span>
              </div>
              <h3 className="text-md font-semibold">{summary.title}</h3>
              <p className="mt-1 text-xs text-mute">
                {summary.scope.clientNames.join(", ") || "Global"}
              </p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
                {summary.summary || "0 published summary sections."}
              </p>
            </article>
          ) : (
            <SkeletonRows rows={5} />
          )}
        </Dialog>
      )}
    </Page>
  );
}

/**
 * Leadership, executive and sales: their own payload in the same grammar.
 * Their KPIs lead, queues follow, then each insight as its own panel.
 */
function BusinessView({
  view,
  filters,
  busy,
  onSummary,
}: {
  view: DashboardView;
  filters: ReactNode;
  busy: boolean;
  onSummary: (endpoint: string) => void;
}) {
  const lists = workLists(view).filter((l) => view.queues.some((q) => q.key === l.key));
  return (
    <>
      <Panel title="Overview" aside={`Last ${view.window.days} days`} action={filters} enter={1} flush>
        <div aria-busy={busy} className={`transition-opacity duration-200 ${busy ? "opacity-60" : ""}`}>
          <RoleMetrics kpis={view.kpis} last />
        </div>
      </Panel>
      <div className="grid gap-3 @3xl/page:grid-cols-2">
        {lists.map((l, i) => (
          <InsightPanel
            key={l.key}
            insight={{ key: l.key, title: l.title, description: "", items: l.items }}
            window={view.window}
            onSummary={onSummary}
            enter={2 + i}
          />
        ))}
        {view.insights.map((insight, i) => (
          <InsightPanel
            key={insight.key}
            insight={insight}
            window={view.window}
            onSummary={onSummary}
            enter={2 + lists.length + i}
          />
        ))}
      </div>
    </>
  );
}
