"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useConsoleUser } from "@/lib/role-context";
import { workspaceRequest, workspaceWrite, getEvidence, downloadEvidence } from "@/lib/workspace-api";
import type { AnalystSubmission, EvidenceFile } from "@/lib/workspace-types";
import type { Source, Connector } from "@/lib/types";
import { gstDateTime } from "@/lib/format";
import { Banner, Button, Drawer, IconButton, ListMeta, Panel, SearchBox, Select, SkeletonRows, StatusPill, TlpBadge } from "@/components/ui";
import { EmptyRow, T_TABLE, T_HEAD, T_TH, T_TD, T_ROW, TypeBadge } from "@/components/table";
import { IconChevronDown, IconPlus, IconRefresh } from "@/components/icons";
import { FILE_STATE, SOURCE_STATE, statusLabel, statusTone } from "@/lib/status";
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
  const [showHealth, setShowHealth] = useState(false);
  const [limit, setLimit] = useState(50);
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
  return (
    <div className="space-y-3">
      <Panel
        title="Intelligence sources"
        count={error && items.length === 0 ? undefined : items.length}
        action={
          <span className="flex gap-2">
            <Button size="sm" onClick={onRequestSource}>
              Request connector
            </Button>
            <Button size="sm" variant="primary" onClick={() => setAdding(true)}>
              <IconPlus />
              Add Source
            </Button>
          </span>
        }
        enter={0}
        flush
        bodyClassName="@container"
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-cpx-grey-100 px-3 py-2">
          <SearchBox value={query} onChange={setQuery} className="w-full max-w-80" />
          <Select aria-label="Source kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="all">All sources</option>
            <option value="connector">Connectors</option>
            <option value="analystSubmission">Analyst intelligence</option>
          </Select>
          <div className="flex-1" />
          {!(error && items.length === 0) && (
            <ListMeta shown={Math.min(rows.length, limit)} total={rows.length} sort="Connectors, then submissions" />
          )}
          <IconButton label="Refresh sources" disabled={loading} onClick={() => setRefresh((n) => n + 1)}>
            <IconRefresh />
          </IconButton>
        </div>
        {error && (
          <Banner className="m-3" action={<Button size="sm" onClick={() => setRefresh((n) => n + 1)}>Retry</Button>}>
            {error}
          </Banner>
        )}
        {loading ? (
          <SkeletonRows rows={6} className="p-3" />
        ) : error && items.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-cpx-grey-500">Not loaded.</p>
        ) : (
          <table className={`${T_TABLE} table-fixed text-sm`}>
            <colgroup>
              <col />
              <col className="w-24" />
              <col className="hidden w-44 @2xl:table-column" />
              <col className="hidden w-24 @3xl:table-column" />
              <col className="w-44" />
              <col className="hidden w-40 @xl:table-column" />
            </colgroup>
            <thead>
              <tr className={T_HEAD}>
                <th className={T_TH}>Source</th>
                <th className={T_TH}>Kind</th>
                <th className={`${T_TH} hidden @2xl:table-cell`}>Category</th>
                <th className={`${T_TH} hidden @3xl:table-cell`}>Scope</th>
                <th className={T_TH}>Status</th>
                <th className={`${T_TH} hidden @xl:table-cell`}>Observed</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map((item) =>
                item.kind === "connector" ? (
                  <tr key={`connector-${item.source.id}`} className={`${T_ROW} relative`}>
                    <td className={T_TD}>
                      <Link
                        href={`/collection/sources/${item.source.id}`}
                        className="block truncate font-medium after:absolute after:inset-0"
                        title={item.source.name}
                      >
                        {item.source.name}
                      </Link>
                    </td>
                    <td className={T_TD}>
                      <TypeBadge label="Connector" />
                    </td>
                    <td className={`${T_TD} hidden truncate text-cpx-grey-700 @2xl:table-cell`}>{item.source.category}</td>
                    <td className={`${T_TD} hidden text-cpx-grey-700 @3xl:table-cell`}>Global</td>
                    <td className={T_TD}>
                      <StatusPill {...SOURCE_STATE[item.source.state]} />
                    </td>
                    <td className={`${T_TD} hidden whitespace-nowrap text-xs text-cpx-grey-500 @xl:table-cell`}>
                      {item.source.lastNewItemAt ? gstDateTime(item.source.lastNewItemAt) : "No observations"}
                    </td>
                  </tr>
                ) : (
                  <tr key={item.submission.id} className={T_ROW}>
                    <td className={T_TD}>
                      <button
                        className="block max-w-full truncate text-left font-medium text-link transition-colors duration-150 hover:text-cpx-purple"
                        onClick={() => setSelected(item.submission)}
                      >
                        {item.submission.title}
                      </button>
                    </td>
                    <td className={T_TD}>
                      <TypeBadge label="Analyst" title={item.submission.sourceName} />
                    </td>
                    <td className={`${T_TD} hidden truncate text-cpx-grey-700 @2xl:table-cell`}>{item.submission.sourceCategory}</td>
                    <td className={`${T_TD} hidden font-mono text-xs text-cpx-grey-700 @3xl:table-cell`}>{item.submission.clientId ?? "Global"}</td>
                    <td className={T_TD}>
                      <StatusPill {...(FILE_STATE[item.submission.status] ?? { tone: statusTone(item.submission.status), label: statusLabel(item.submission.status) })} />
                    </td>
                    <td className={`${T_TD} hidden whitespace-nowrap text-xs text-cpx-grey-500 @xl:table-cell`}>{item.submission.observedOn}</td>
                  </tr>
                ),
              )}
              {!rows.length && (
                <EmptyRow colSpan={6}>
                  <span className="font-medium text-cpx-black">0 sources</span> match.
                </EmptyRow>
              )}
            </tbody>
          </table>
        )}
        {rows.length > limit && (
          <div className="flex justify-center border-t border-cpx-grey-100 px-3 py-2">
            <Button size="sm" onClick={() => setLimit((n) => n + 50)}>
              Show 50 more
            </Button>
          </div>
        )}
      </Panel>
      <Panel
        title="Connector health"
        aside="Collection state, 30 days"
        action={
          <Button size="sm" variant="ghost" aria-expanded={showHealth} onClick={() => setShowHealth((v) => !v)}>
            {showHealth ? "Hide" : "Show"}
            <IconChevronDown className={showHealth ? "rotate-180" : ""} />
          </Button>
        }
        enter={1}
        bodyClassName={showHealth ? "" : "hidden"}
      >
        {showHealth && (
          <div className="reveal">
            <SourcesTab initialRows={items.flatMap((item) => item.kind === "connector" ? [item.source] : [])} connectors={connectors} schedulerOn={schedulerOn} onRequestSource={onRequestSource} />
          </div>
        )}
      </Panel>
      {adding && <AddSourceDialog onClose={() => setAdding(false)} onSubmitted={(submission) => { setItems((current) => [{ kind: "analystSubmission", submission }, ...current]); setAdding(false); setSelected(submission); }} />}
      {selected && <SubmissionDetails key={selected.id} initial={selected} onClose={() => { setSelected(null); setRefresh((n) => n + 1); }} />}
    </div>
  );
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
  return <Drawer title={item.title} onClose={onClose}><div className="space-y-5"><div className="flex items-center gap-2"><TlpBadge tlp={item.tlp} /><StatusPill {...(FILE_STATE[item.status] ?? { tone: statusTone(item.status), label: statusLabel(item.status) })} /></div><p className="whitespace-pre-wrap text-sm">{item.description}</p><dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs [&>dt]:text-cpx-grey-500"><dt>Source</dt><dd>{item.sourceName}</dd><dt>Category</dt><dd>{item.sourceCategory}</dd><dt>Observed</dt><dd>{item.observedOn}</dd><dt>Confidence</dt><dd>{item.confidence}</dd><dt>Scope</dt><dd>{item.clientId ?? "Global"}</dd><dt>Evidence files</dt><dd>{item.attachmentIds.length}</dd><dt>Tags</dt><dd>{item.tags.join(", ") || "0 tags"}</dd></dl><ul className="space-y-3">{files.map((file) => <li key={file.id} className="flex items-center gap-2 border-t border-cpx-grey-100 pt-3"><span className="min-w-0 flex-1 break-words text-xs">{file.fileName}</span><Button size="sm" onClick={() => downloadEvidence(user.id, file).catch((cause: Error) => setError(cause.message))}>Download</Button></li>)}</ul>{item.warnings?.map((warning) => <p key={warning} className="text-xs text-status-warn-ink">{warning}</p>)}{(item.error || error) && <Banner>{error ?? item.error}</Banner>}{["failed", "partial"].includes(item.status) && <Button disabled={busy} onClick={async () => { setBusy(true); setError(null); try { setItem(await workspaceWrite<AnalystSubmission>(user.id, `/collection/submissions/${item.id}/retry`, {})); } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); } }}>Retry processing</Button>}</div></Drawer>;
}
