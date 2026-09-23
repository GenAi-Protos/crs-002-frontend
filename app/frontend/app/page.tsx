"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useConsoleUser } from "@/lib/role-context";
import { workspaceRequest } from "@/lib/workspace-api";
import { gstDateTime } from "@/lib/format";
import { Button, PageHeader, SkeletonRows, StatusPill, Dialog, TlpBadge } from "@/components/ui";
import { BarListH } from "@/components/chart/BarListH";
import type { RoleKey, Client, Tlp } from "@/lib/types";

interface QueueItem { id: string; title: string; status?: string; href?: string; updatedAt?: string; createdAt?: string; assignedTo?: string; owner?: string }
interface InsightItem extends Partial<QueueItem> { label?: string; value?: string | number | null; summaryEndpoint?: string; briefings?: { title: string; publishedAt: string; summaryEndpoint?: string }[] }
interface PublishedSummary { ref: string; title: string; type: string; publishedAt: string; summary: string; scope: { clientIds: string[]; clientNames: string[] }; tlp: Tlp }
interface DashboardView {
  role: RoleKey; generatedAt: string; window: { days: number; from: string; to: string };
  kpis: { key: string; label: string; value: number | string | null; unit: string; href: string | null }[];
  queues: { key: string; title: string; total: number; items: QueueItem[] }[];
  insights: { key: string; title: string; description: string; items: InsightItem[] }[];
}
const AUDIENCE: Record<RoleKey, string> = { analyst: "TI Analyst", "lead-analyst": "Lead Analyst", "incident-responder": "Incident Responder", leadership: "CRS Leadership", executive: "Executive", sales: "Sales" };
const route = (href: string) => href === "/pirs" ? "/manage?tab=pirs" : href;

export default function Dashboard() {
  const { user } = useConsoleUser();
  const [data, setData] = useState<DashboardView | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [clientId, setClientId] = useState("");
  const [clients, setClients] = useState<Pick<Client, "id" | "name">[]>([]);
  const [summary, setSummary] = useState<PublishedSummary | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  useEffect(() => { let active = true; setClientId(""); setSummaryOpen(false); workspaceRequest<{ items: Pick<Client, "id" | "name">[] }>(user.id, "/workspace/clients").then((result) => { if (active) setClients(result.items); }).catch(() => { if (active) setClients([]); }); return () => { active = false; }; }, [user.id]);
  useEffect(() => {
    const update = () => setRefresh((value) => value + 1);
    const timer = setInterval(() => { if (document.visibilityState === "visible") update(); }, 60_000);
    window.addEventListener("nestor:workspace-changed", update);
    return () => { clearInterval(timer); window.removeEventListener("nestor:workspace-changed", update); };
  }, []);
  async function openSummary(endpoint: string) {
    setSummary(null); setSummaryError(null); setSummaryOpen(true);
    try { setSummary(await workspaceRequest<PublishedSummary>(user.id, endpoint)); }
    catch (cause) { setSummaryError(cause instanceof Error ? cause.message : "The published summary could not be loaded."); }
  }
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setData(null); setError(null);
    workspaceRequest<DashboardView>(user.id, `/dashboard/views/${user.role}?days=${days}${clientId ? `&clientId=${encodeURIComponent(clientId)}` : ""}`, { signal: controller.signal }).then((next) => { if (!controller.signal.aborted) setData(next); }).catch((e: Error) => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [user.id, user.role, days, refresh, clientId]);
  return <div className="mx-auto w-full max-w-[1400px] px-6 py-6">
    <PageHeader title="Dashboard" meta={<span className="border-l border-cpx-grey-200 pl-3 text-xs text-cpx-grey-500">{AUDIENCE[user.role]}</span>} action={<div className="flex flex-wrap gap-2"><select aria-label="Dashboard client" className="h-8 max-w-48 border border-cpx-grey-100 bg-white px-2 text-xs" value={clientId} onChange={(event) => setClientId(event.target.value)}><option value="">All accessible clients</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select><select aria-label="Dashboard period" className="h-8 border border-cpx-grey-100 bg-white px-2 text-xs" value={days} onChange={(e) => setDays(Number(e.target.value))}>{[7, 30, 90].map((d) => <option key={d} value={d}>Last {d} days</option>)}</select><Button onClick={() => setRefresh((n) => n + 1)}>Refresh</Button></div>} />
    {error && <p role="alert" className="border border-cpx-red-200 p-4 text-sm">{error}</p>}
    {loading && <SkeletonRows rows={8} />}
    {data && <>
      <p className="mb-5 text-2xs text-cpx-grey-500">As of {gstDateTime(data.generatedAt)} · {data.window.days} days · Recorded activity</p>
      <section aria-label="Role metrics" className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{data.kpis.map((kpi) => {
        const body = <><p className="text-xs text-cpx-grey-500">{kpi.label}</p><p className="my-2 font-display text-2xl font-medium tabular-nums">{kpi.value === null ? "Not recorded" : typeof kpi.value === "number" ? kpi.value.toLocaleString() : kpi.value}</p><p className="text-2xs text-cpx-grey-500">{kpi.unit}</p></>;
        return kpi.href ? <Link key={kpi.key} href={route(kpi.href)} className="border-l-2 border-cpx-green bg-cpx-grey-50 px-5 py-4 transition-colors hover:bg-cpx-green-50">{body}</Link> : <div key={kpi.key} className="border-l-2 border-cpx-grey-200 bg-cpx-grey-50 px-5 py-4">{body}</div>;
      })}</section>
      {!!data.queues.length && <div className={`mb-7 grid gap-7 ${data.queues.length > 1 ? "lg:grid-cols-2" : ""}`}>{data.queues.map((queue) => <section key={queue.key}><div className="mb-3 flex items-baseline justify-between gap-3"><h2 className="text-md font-semibold">{queue.title}</h2><span className="text-xs text-cpx-grey-500">{queue.total} records</span></div><ul className="divide-y divide-cpx-grey-100 border-y border-cpx-grey-100">{queue.items.map((item) => <li key={item.id} className="flex flex-wrap items-center gap-3 py-3"><div className="min-w-0 flex-1">{item.href ? <Link href={route(item.href)} className="text-sm font-medium text-link underline underline-offset-2">{item.title}</Link> : <span className="text-sm">{item.title}</span>}{(item.assignedTo || item.owner) && <p className="mt-1 text-2xs text-cpx-grey-500">{item.assignedTo ?? item.owner}</p>}</div>{item.status && <StatusPill tone={item.status === "published" ? "good" : "idle"} label={item.status.replaceAll("-", " ")} />}</li>)}</ul>{!queue.items.length && <p className="py-5 text-sm">0 records in this queue.</p>}</section>)}</div>}
      <div className="grid gap-7 lg:grid-cols-2">{data.insights.map((insight) => <section key={insight.key} className="border-t border-cpx-grey-100 pt-4"><h2 className="mb-3 text-md font-semibold">{insight.title}</h2>
        {insight.items.length > 0 && insight.items.every((item) => typeof item.value === "number" && item.label) ? <BarListH items={insight.items.map((item) => ({ label: item.label!, value: item.value as number }))} labelClass="w-44" /> : <ul className="space-y-3">{insight.items.map((item, i) => <li key={item.id ?? `${insight.key}-${i}`} className="text-sm">{item.summaryEndpoint ? <button className="text-left text-link underline" onClick={() => void openSummary(item.summaryEndpoint!)}>{item.title ?? item.label}</button> : item.href ? <Link href={route(item.href)} className="text-link underline">{item.title ?? item.label}</Link> : <span className="font-medium">{item.title ?? item.label}</span>}{item.value != null && <span className="ml-3 text-xs text-cpx-grey-500">{typeof item.value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(item.value) ? gstDateTime(item.value) : item.value}</span>}{item.briefings && <ul className="mt-2 space-y-2 border-l border-cpx-grey-200 pl-3">{item.briefings.map((briefing, n) => <li key={n} className="text-xs">{briefing.summaryEndpoint ? <button className="text-left text-link underline" onClick={() => void openSummary(briefing.summaryEndpoint!)}>{briefing.title}</button> : briefing.title}<span className="ml-2 text-cpx-grey-500">{gstDateTime(briefing.publishedAt)}</span></li>)}{!item.briefings.length && <li className="text-xs text-cpx-grey-500">0 published briefings.</li>}</ul>}</li>)}</ul>}
        {!insight.items.length && <p className="text-sm">{insight.description}</p>}
      </section>)}</div>
    </>}
    {summaryOpen && <Dialog title="Published briefing" onClose={() => setSummaryOpen(false)} className="max-w-2xl">{summaryError ? <p role="alert" className="text-sm text-cpx-red-700">{summaryError}</p> : summary ? <article><div className="mb-3 flex items-center gap-3"><TlpBadge tlp={summary.tlp} /><span className="text-2xs text-cpx-grey-500">{summary.ref} · {gstDateTime(summary.publishedAt)}</span></div><h2 className="text-lg font-semibold">{summary.title}</h2><p className="mt-2 text-xs text-cpx-grey-500">{summary.scope.clientNames.join(", ") || "Global"}</p><p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{summary.summary || "0 published summary sections."}</p></article> : <SkeletonRows rows={5} />}</Dialog>}
  </div>;
}
