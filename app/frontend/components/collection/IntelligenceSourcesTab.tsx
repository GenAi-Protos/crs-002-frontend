"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useConsoleUser } from "@/lib/role-context";
import { workspaceRequest, workspaceWrite, getEvidence, downloadEvidence } from "@/lib/workspace-api";
import type { AnalystSubmission, EvidenceFile } from "@/lib/workspace-types";
import type { Source, Connector } from "@/lib/types";
import { gstDateTime } from "@/lib/format";
import { Button, Drawer, SearchBox, SkeletonRows, StatusPill, TlpBadge } from "@/components/ui";
import { T_TABLE, T_HEAD, T_TH, T_TD, T_ROW } from "@/components/table";
import { AddSourceDialog } from "./AddSourceDialog";
import { SourcesTab } from "./SourcesTab";

type SourceItem = { kind: "connector"; source: Source } | { kind: "analystSubmission"; submission: AnalystSubmission };

export function IntelligenceSourcesTab({ connectors, schedulerOn, onRequestSource }: { connectors: Connector[]; schedulerOn: boolean; onRequestSource: () => void }) {
  const { user } = useConsoleUser();
  const [items, setItems] = useState<SourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<AnalystSubmission | null>(null);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let live = true; setLoading(true); setError(null); setItems([]);
    workspaceRequest<{ items: SourceItem[]; total: number }>(user.id, "/collection/intelligence-sources").then((result) => live && setItems(result.items)).catch((e: Error) => live && setError(e.message)).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [user.id, refresh]);
  const processing = items.some((item) => item.kind === "analystSubmission" && ["processing", "indexing", "pending"].includes(item.submission.status));
  useEffect(() => {
    if (!processing) return;
    let active = true;
    const timer = setInterval(() => { workspaceRequest<{ items: SourceItem[]; total: number }>(user.id, "/collection/intelligence-sources").then((result) => { if (active) setItems(result.items); }).catch((cause: Error) => { if (active) setError(cause.message); }); }, 2000);
    return () => { active = false; clearInterval(timer); };
  }, [processing, user.id]);
  const rows = items.filter((item) => (kind === "all" || kind === item.kind) && (item.kind === "connector" ? `${item.source.name} ${item.source.category}` : `${item.submission.title} ${item.submission.sourceName} ${item.submission.sourceCategory} ${item.submission.tags.join(" ")}`).toLowerCase().includes(query.toLowerCase()));
  return <div className="mt-4 space-y-4">
    <div className="flex flex-wrap items-center gap-3"><h2 className="text-md font-semibold">Intelligence Sources</h2><span className="text-xs text-cpx-grey-500">{rows.length} sources</span><div className="ml-auto flex gap-2"><Button onClick={onRequestSource}>Request connector</Button><Button variant="primary" onClick={() => setAdding(true)}>Add Source</Button></div></div>
    <div className="flex flex-wrap gap-3"><SearchBox value={query} onChange={setQuery} className="w-80" /><select className="h-8 border border-cpx-grey-100 bg-white px-2 text-sm" aria-label="Source kind" value={kind} onChange={(e) => setKind(e.target.value)}><option value="all">All sources</option><option value="connector">Connectors</option><option value="analystSubmission">Analyst intelligence</option></select><Button disabled={loading} onClick={() => setRefresh((n) => n + 1)}>Refresh</Button></div>
    {error && <div role="alert" className="flex items-center gap-3 text-sm text-cpx-red-700">{error}<Button onClick={() => setRefresh((n) => n + 1)}>Retry</Button></div>}
    {loading ? <SkeletonRows rows={6} /> : <div className="overflow-x-auto"><table className={`${T_TABLE} w-full text-sm`}><thead><tr className={T_HEAD}>{["Source", "Category", "Scope", "Status", "Observed"].map((label) => <th key={label} className={T_TH}>{label}</th>)}</tr></thead><tbody>
      {rows.map((item) => item.kind === "connector" ? <tr key={`connector-${item.source.id}`} className={T_ROW}><td className={T_TD}><Link href={`/collection/sources/${item.source.id}`} className="text-link underline">{item.source.name}</Link><p className="text-2xs text-cpx-grey-500">Connector</p></td><td className={T_TD}>{item.source.category}</td><td className={T_TD}>Global</td><td className={T_TD}>{item.source.state.replaceAll("-", " ")}</td><td className={T_TD}>{item.source.lastNewItemAt ? gstDateTime(item.source.lastNewItemAt) : "No observations"}</td></tr> : <tr key={item.submission.id} className={T_ROW}><td className={T_TD}><button className="text-left text-link underline" onClick={() => setSelected(item.submission)}>{item.submission.title}</button><p className="text-2xs text-cpx-grey-500">{item.submission.sourceName}</p></td><td className={T_TD}>{item.submission.sourceCategory}</td><td className={T_TD}>{item.submission.clientId ?? "Global"}</td><td className={T_TD}><StatusPill label={item.submission.status} tone={item.submission.status === "ready" ? "good" : item.submission.status === "failed" ? "critical" : "warn"} /></td><td className={T_TD}>{item.submission.observedOn}</td></tr>)}
      {!rows.length && <tr><td className="py-6 text-sm" colSpan={5}>0 sources match.</td></tr>}
    </tbody></table></div>}
    <details className="border-t border-cpx-grey-100 pt-4"><summary className="cursor-pointer text-sm font-medium">Connector health</summary><SourcesTab initialRows={items.flatMap((item) => item.kind === "connector" ? [item.source] : [])} connectors={connectors} schedulerOn={schedulerOn} onRequestSource={onRequestSource} /></details>
    {adding && <AddSourceDialog onClose={() => setAdding(false)} onSubmitted={(submission) => { setItems((current) => [{ kind: "analystSubmission", submission }, ...current]); setAdding(false); setSelected(submission); }} />}
    {selected && <SubmissionDetails key={selected.id} initial={selected} onClose={() => { setSelected(null); setRefresh((n) => n + 1); }} />}
  </div>;
}

function SubmissionDetails({ initial, onClose }: { initial: AnalystSubmission; onClose: () => void }) {
  const { user } = useConsoleUser();
  const [item, setItem] = useState(initial);
  const [files, setFiles] = useState<EvidenceFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.all(initial.attachmentIds.map((id) => getEvidence(user.id, id))).then((rows) => { if (active) setFiles(rows); }).catch((cause: Error) => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, [initial.attachmentIds, user.id]);
  useEffect(() => {
    if (!["processing", "indexing", "pending"].includes(item.status)) return;
    let active = true;
    const timer = setInterval(() => { workspaceRequest<AnalystSubmission>(user.id, `/collection/submissions/${item.id}`).then((row) => { if (active) setItem(row); }).catch((cause: Error) => { if (active) setError(cause.message); }); }, 2000);
    return () => { active = false; clearInterval(timer); };
  }, [item.id, item.status, user.id]);
  return <Drawer title={item.title} onClose={onClose}><div className="space-y-5"><div className="flex items-center gap-3"><TlpBadge tlp={item.tlp} /><StatusPill label={item.status} tone={item.status === "ready" ? "good" : "warn"} /></div><p className="whitespace-pre-wrap text-sm">{item.description}</p><dl className="grid grid-cols-2 gap-3 text-xs"><dt>Source</dt><dd>{item.sourceName}</dd><dt>Category</dt><dd>{item.sourceCategory}</dd><dt>Observed</dt><dd>{item.observedOn}</dd><dt>Confidence</dt><dd>{item.confidence}</dd><dt>Scope</dt><dd>{item.clientId ?? "Global"}</dd><dt>Evidence files</dt><dd>{item.attachmentIds.length}</dd><dt>Tags</dt><dd>{item.tags.join(", ") || "0 tags"}</dd></dl><ul className="space-y-3">{files.map((file) => <li key={file.id} className="flex items-center gap-2 border-t border-cpx-grey-100 pt-3"><span className="min-w-0 flex-1 break-words text-xs">{file.fileName}</span><Button size="sm" onClick={() => downloadEvidence(user.id, file).catch((cause: Error) => setError(cause.message))}>Download</Button></li>)}</ul>{item.warnings?.map((warning) => <p key={warning} className="text-xs text-status-warn-ink">{warning}</p>)}{(item.error || error) && <p role="alert" className="text-xs text-cpx-red-700">{error ?? item.error}</p>}{["failed", "partial"].includes(item.status) && <Button disabled={busy} onClick={async () => { setBusy(true); setError(null); try { setItem(await workspaceWrite<AnalystSubmission>(user.id, `/collection/submissions/${item.id}/retry`, {})); } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); } }}>Retry processing</Button>}</div></Drawer>;
}
