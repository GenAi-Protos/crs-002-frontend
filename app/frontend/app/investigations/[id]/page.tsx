"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useConsoleUser } from "@/lib/role-context";
import { canSee, canWriteReports } from "@/lib/access";
import { caseAction, getCase, getEvidence, updateCase, downloadEvidence, workspaceRequest } from "@/lib/workspace-api";
import type { CaseDetail, CaseStatus, EvidenceFile, CaseContribution, CaseOptions } from "@/lib/workspace-types";
import { gstDateTime } from "@/lib/format";
import { defang } from "@/lib/defang";
import { Button, PageHeader, Tabs, StatusPill, SkeletonRows, IndicatorChip, Dialog } from "@/components/ui";
import { EvidenceUploader, evidencePending } from "@/components/evidence/EvidenceUploader";
import { fieldClass, SpecialistPicker, SourcePicker, SPECIALISTS } from "@/components/investigations/CaseForm";

type Area = "overview" | "agents" | "findings" | "report";
const display = (value: unknown): string => typeof value === "string" ? value : JSON.stringify(value);

export default function InvestigationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useConsoleUser();
  const [data, setData] = useState<CaseDetail | null>(null);
  const [area, setArea] = useState<Area>("overview");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [note, setNote] = useState("");
  const [specialists, setSpecialists] = useState<string[]>([]);
  const [files, setFiles] = useState<EvidenceFile[]>([]);
  const [uploads, setUploads] = useState<EvidenceFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [options, setOptions] = useState<CaseOptions | null>(null);
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[] | null>(null);
  const [reviewAction, setReviewAction] = useState<{ step: CaseContribution; action: "exclude" | "rerun" } | null>(null);
  const [reason, setReason] = useState("");

  const refresh = useCallback(async () => {
    const next = await getCase(user.id, id);
    setData(next); setTitle(next.case.title); setObjective(next.case.objective); setSpecialists(next.case.specialists); setSelectedSourceIds(next.case.selectedSourceIds ?? null);
    const result = await Promise.allSettled(next.case.evidenceIds.map((fileId) => getEvidence(user.id, fileId)));
    setFiles(result.flatMap((r) => r.status === "fulfilled" ? [r.value] : []));
    return next;
  }, [id, user.id]);
  useEffect(() => { let active = true; setLoading(true); setData(null); refresh().catch((e: Error) => active && setError(e.message)).finally(() => active && setLoading(false)); return () => { active = false; }; }, [refresh]);
  useEffect(() => { let active = true; workspaceRequest<CaseOptions>(user.id, "/investigations/options").then((value) => { if (active) setOptions(value); }).catch((cause: Error) => { if (active) setError(cause.message); }); return () => { active = false; }; }, [user.id]);
  const running = data?.runs.some((run) => ["running", "queued", "pending"].includes(run.status ?? "")) ?? false;
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => { getCase(user.id, id).then(setData).catch(() => undefined); }, 2000);
    return () => clearInterval(timer);
  }, [running, id, user.id]);

  if (!canSee(user.role, "investigations")) return <p className="p-6">Not permitted at this access level.</p>;
  if (loading) return <div className="p-6"><PageHeader title="Investigation" /><SkeletonRows rows={7} /></div>;
  if (!data) return <div className="p-6"><Link href="/investigations" className="text-link underline">Investigations</Link><p role="alert" className="mt-4">{error ?? "Investigation not found."}</p><Button className="mt-3" onClick={() => { setError(null); void refresh().catch((e: Error) => setError(e.message)); }}>Retry</Button></div>;
  const current = data.case;
  const readonly = ["completed", "archived"].includes(current.status);
  const included = data.contributions.filter((c) => !c.excluded);
  async function action(operation: () => Promise<unknown>, success?: string) {
    setBusy(true); setError(null); setNotice(null);
    try { await operation(); await refresh(); if (success) setNotice(success); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  const post = (path: string, body: Record<string, unknown> = {}) => caseAction(user.id, id, path, { expectedRevision: current.revision, ...body });

  return <div className="mx-auto w-full max-w-[1400px] px-6 py-6">
    <Link href="/investigations" className="mb-3 inline-block text-xs text-link underline underline-offset-2">All investigations</Link>
    <PageHeader title="Investigation" meta={<StatusPill tone={current.status === "completed" ? "good" : "idle"} label={current.status.replaceAll("-", " ")} />} action={<Button variant="primary" disabled={busy || readonly || running || !specialists.length || selectedSourceIds?.length === 0} onClick={() => void action(() => post("run", { specialists, selectedSourceIds }), "Investigation run started.")}>{running ? "Running" : busy ? "Working…" : "Run investigation"}</Button>} />
    <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-lg font-semibold">{current.title}</h2><span className="text-2xs text-cpx-grey-500">{current.id} · Revision {current.revision} · {gstDateTime(current.updatedAt)}</span></div>
    {error && <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 border border-cpx-red-200 p-3 text-sm"><span>{error}</span><Button size="sm" onClick={() => void action(refresh)}>Refresh case</Button></div>}
    {notice && <p role="status" className="mb-3 text-xs text-green-contrast">{notice}</p>}
    <Tabs<Area> id="case" label="Investigation areas" value={area} onChange={setArea} tabs={[{ key: "overview", label: "Overview" }, { key: "agents", label: "Agents and evidence" }, { key: "findings", label: "Findings and pivots" }, { key: "report", label: "Report" }]} />

    {area === "overview" && <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
      <div className="space-y-5">
        <label className="block text-xs">Title<input className={fieldClass} value={title} disabled={readonly} onChange={(e) => setTitle(e.target.value)} /></label>
        <label className="block text-xs">Objective<textarea className={fieldClass} rows={4} value={objective} disabled={readonly} onChange={(e) => setObjective(e.target.value)} /></label>
        <Button disabled={busy || readonly || !title.trim() || !objective.trim() || (title === current.title && objective === current.objective)} onClick={() => void action(() => updateCase(user.id, id, { title: title.trim(), objective: objective.trim(), expectedRevision: current.revision }), "Changes saved.")}>Save changes</Button>
        <section className="border-t border-cpx-grey-100 pt-5"><h2 className="mb-3 text-md font-semibold">Starting entities</h2><div className="flex flex-wrap gap-2">{current.entities.map((entity, i) => <span key={`${entity.value}-${i}`} className="flex items-center gap-2 border border-cpx-grey-100 px-3 py-2 text-xs"><span className="text-cpx-grey-500">{entity.type}</span><IndicatorChip value={entity.value} /></span>)}{!current.entities.length && <p className="text-sm">0 starting entities.</p>}</div></section>
        <section className="border-t border-cpx-grey-100 pt-5"><h2 className="mb-3 text-md font-semibold">Analyst notes</h2><ul className="space-y-4">{current.notes.map((item) => <li key={item.id} className="border-l-2 border-cpx-green pl-3"><p className="whitespace-pre-wrap text-sm">{item.text}</p><p className="mt-1 text-2xs text-cpx-grey-500">{item.by} · {gstDateTime(item.at)}</p></li>)}</ul>{!current.notes.length && <p className="text-sm">0 notes.</p>}<label className="mt-4 block text-xs">Add a note<textarea value={note} onChange={(e) => setNote(e.target.value)} disabled={readonly} rows={3} className={fieldClass} /></label><Button className="mt-2" disabled={busy || readonly || !note.trim()} onClick={() => void action(async () => { await post("notes", { text: note.trim() }); setNote(""); })}>Save note</Button></section>
      </div>
      <aside className="space-y-5 border-l border-cpx-grey-100 pl-5">
        <dl className="grid grid-cols-2 gap-3 text-sm"><dt className="text-cpx-grey-500">Client</dt><dd>{current.clientId ?? "Global"}</dd><dt className="text-cpx-grey-500">Assigned to</dt><dd>{current.assignedTo ?? current.createdBy}</dd><dt className="text-cpx-grey-500">Priority</dt><dd>{current.priority}</dd><dt className="text-cpx-grey-500">Workflow</dt><dd>{current.workflowRef}</dd><dt className="text-cpx-grey-500">Evidence files</dt><dd>{current.evidenceIds.length}</dd></dl>
        <label className="block text-xs">Assignment<select className={fieldClass} value={current.assignedTo ?? current.createdBy} disabled={busy || readonly || !options} onChange={(event) => void action(() => updateCase(user.id, id, { assignedTo: event.target.value, expectedRevision: current.revision }))}>{(options?.assignees ?? [{ id: current.assignedTo ?? current.createdBy, name: current.assignedTo ?? current.createdBy }]).map((assignee) => <option key={assignee.id} value={assignee.id}>{assignee.name}</option>)}</select></label>
        <label className="block text-xs">Case status<select className={fieldClass} value={current.status} disabled={busy || running} onChange={(e) => void action(() => updateCase(user.id, id, { status: e.target.value as CaseStatus, expectedRevision: current.revision }))}>{!["draft", "active", "archived"].includes(current.status) && <option value={current.status} disabled>{current.status.replaceAll("-", " ")}</option>}{["draft", "active", "archived"].map((s) => <option key={s} value={s}>{s}</option>)}</select><span className="mt-1 block text-2xs text-cpx-grey-500">Review and completion states follow the report approval workflow.</span></label>
        <SpecialistPicker value={specialists} onChange={setSpecialists} options={options?.specialists} disabled={busy || readonly || running} />
        <SourcePicker value={selectedSourceIds} onChange={setSelectedSourceIds} sources={options?.sources ?? []} disabled={busy || readonly || running || !options} />
      </aside>
    </div>}

    {area === "agents" && <div className="mt-5 space-y-7">
      <section><div className="mb-3 flex items-center justify-between"><h2 className="text-md font-semibold">Evidence files</h2><span className="text-xs text-cpx-grey-500">{files.length} available of {current.evidenceIds.length}</span></div>
        <ul className="divide-y divide-cpx-grey-100 border-y border-cpx-grey-100">{files.map((file) => <li key={file.id} className="flex flex-wrap items-center gap-3 py-3"><span className="flex-1 text-sm">{file.fileName}</span><StatusPill label={file.status} tone={file.status === "ready" ? "good" : "warn"} /><span className="text-2xs text-cpx-grey-500">{file.chunkCount} excerpts</span><Button size="sm" onClick={() => downloadEvidence(user.id, file).catch((e: Error) => setError(e.message))}>Download</Button></li>)}</ul>
        {!readonly && <div className="mt-4"><EvidenceUploader value={uploads} onChange={setUploads} clientId={current.clientId} onBusy={setUploading} disabled={busy} /><Button className="mt-3" disabled={!uploads.length || uploading || busy || evidencePending(uploads) || uploads.some((f) => f.status === "failed")} onClick={() => void action(async () => { await post("evidence", { fileIds: uploads.map((f) => f.id) }); setUploads([]); })}>Add evidence to case</Button></div>}
      </section>
      <section><h2 className="mb-3 text-md font-semibold">Agent activity</h2>{!data.contributions.length && <p className="text-sm">0 agent contributions. Run the investigation.</p>}<div className="space-y-3">{data.contributions.map((step) => <Contribution key={step.id} step={step} busy={busy || readonly || running} onExclude={() => { setReason(""); setReviewAction({ step, action: "exclude" }); }} onRerun={() => { setReason(""); setReviewAction({ step, action: "rerun" }); }} />)}</div></section>
      <section><h2 className="mb-3 text-md font-semibold">Runs</h2>{data.runs.map((run) => <div key={run.id} className="flex flex-wrap items-center gap-3 border-b border-cpx-grey-100 py-2 text-xs"><span className="font-mono">{run.id}</span><span>{run.status}</span><span>{run.workflowRef ?? current.workflowRef}</span>{run.error && <span className="text-cpx-red-700">{run.error}</span>}</div>)}{!data.runs.length && <p className="text-sm">0 runs.</p>}</section>
    </div>}

    {area === "findings" && <div className="mt-5 grid gap-7 lg:grid-cols-2">
      <section><h2 className="mb-4 text-md font-semibold">Included findings</h2>{!included.some((step) => step.findings.length) && <p className="text-sm">0 evidence-backed findings.</p>}<ul className="space-y-4">{included.flatMap((step) => step.findings.map((finding, i) => <li key={`${step.id}-${i}`} className="border-b border-cpx-grey-100 pb-4"><p className="text-sm">{defang(finding.claim)}</p><p className="mt-2 text-2xs text-cpx-grey-500">{step.label} · {finding.citationIds.join(", ") || "No supporting citation"}</p></li>))}</ul></section>
      <div className="space-y-7"><section><h2 className="mb-3 text-md font-semibold">Evidence relationships</h2>{data.relationships?.map((relationship, index) => <details key={`${relationship.evidenceId}-${index}`} className="mb-2 border border-cpx-grey-100 p-3"><summary className="cursor-pointer text-xs"><IndicatorChip value={relationship.entity} /> mentioned in {relationship.label}</summary><p className="mt-2 whitespace-pre-wrap text-sm">{defang(relationship.excerpt)}</p><p className="mt-2 text-2xs text-cpx-grey-500">{relationship.evidenceId}</p></details>)}{!data.relationships?.length && <p className="text-sm">0 evidence relationships.</p>}</section><section><h2 className="mb-3 text-md font-semibold">Negative results</h2>{included.flatMap((step) => step.negativeResults ?? []).map((result, i) => <p key={i} className="mb-2 text-sm">{defang(display(result))}</p>)}{!included.some((s) => s.negativeResults?.length) && <p className="text-sm">0 recorded negative results.</p>}</section><section><h2 className="mb-3 text-md font-semibold">Contradictions</h2>{included.flatMap((step) => step.contradictions ?? []).map((conflict, index) => <div key={index} className="mb-3 border-l-2 border-cpx-red-200 pl-3"><p className="text-sm font-medium">{conflict.subject}</p><ul className="mt-1 list-disc space-y-1 pl-4">{conflict.claims.map((claim, claimIndex) => <li key={claimIndex} className="text-xs">{defang(claim)}</li>)}</ul></div>)}{!included.some((step) => step.contradictions?.length) && <p className="text-sm">0 recorded contradictions.</p>}</section><section><h2 className="mb-3 text-md font-semibold">Coverage and limitations</h2>{[...new Set(included.flatMap((step) => [...(step.limitations ?? []), ...(step.error ? [step.error] : [])]))].map((item, i) => <p key={i} className="mb-2 border-l-2 border-cpx-bright-300 pl-3 text-sm">{item}</p>)}{!included.some((s) => s.limitations?.length || s.error) && <p className="text-sm">0 recorded limitations.</p>}</section><section><h2 className="mb-3 text-md font-semibold">Entity pivots</h2><ul className="space-y-2">{current.entities.map((entity, i) => <li key={i} className="flex flex-wrap items-center gap-3 text-sm"><IndicatorChip value={entity.value} /><Link href={`/intelligence?prompt=${encodeURIComponent(`Find evidence related to ${entity.value}`)}`} className="text-link underline">Query related evidence</Link></li>)}</ul></section></div>
    </div>}

    {area === "report" && <div className="mt-5 max-w-4xl space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-md font-semibold">Case reports</h2>{canWriteReports(user.role) && <Button variant="primary" disabled={busy || running || !included.some((step) => step.findings.length)} onClick={() => void action(() => post("report"), "Draft created. Open it to review and submit.")}>Generate draft</Button>}</div>{!included.some((step) => step.findings.length) && <p className="text-sm">0 cited findings. Add evidence and rerun specialists.</p>}<p className="text-xs text-cpx-grey-500">{included.length} included agent contributions · Published reports require lead approval.</p><ul className="divide-y divide-cpx-grey-100 border-y border-cpx-grey-100">{data.reports.map((report) => <li key={report.ref} className="flex flex-wrap items-center gap-3 py-4"><Link href={`/reports/${encodeURIComponent(report.ref)}`} className="flex-1 text-sm font-medium text-link underline">{report.title}</Link><span className="text-xs">{report.status}</span><span className="text-2xs">v{report.version}</span></li>)}</ul>{!data.reports.length && <p className="text-sm">0 case reports.</p>}</div>}
    {reviewAction && <Dialog title={reviewAction.action === "rerun" ? "Rerun specialist" : reviewAction.step.excluded ? "Include contribution" : "Exclude contribution"} onClose={() => setReviewAction(null)}><p className="text-sm">{reviewAction.step.label}</p><label className="mt-4 block text-xs">Reason<textarea className={fieldClass} rows={3} required minLength={5} value={reason} onChange={(event) => setReason(event.target.value)} /></label><p className="mt-2 text-2xs text-cpx-grey-500">The reason stays in the investigation audit history. A changed evidence basis requires a new report draft.</p><div className="mt-4 flex justify-end gap-2"><Button disabled={busy} onClick={() => setReviewAction(null)}>Cancel</Button><Button variant="primary" disabled={busy || reason.trim().length < 5} onClick={() => void action(async () => { await post(`contributions/${reviewAction.step.id}/${reviewAction.action}`, { reason: reason.trim(), ...(reviewAction.action === "exclude" ? { excluded: !reviewAction.step.excluded } : {}) }); setReviewAction(null); })}>Confirm {reviewAction.action === "rerun" ? "rerun" : reviewAction.step.excluded ? "inclusion" : "exclusion"}</Button></div></Dialog>}
  </div>;
}

function Contribution({ step, busy, onExclude, onRerun }: { step: CaseContribution; busy: boolean; onExclude: () => void; onRerun: () => void }) {
  return <details className="border border-cpx-grey-100 bg-white p-4"><summary className="flex cursor-pointer flex-wrap items-center gap-3 text-sm"><strong className="flex-1 font-medium">{step.label || step.agentId}</strong><StatusPill tone={step.status === "done" ? "good" : step.status === "failed" ? "critical" : "warn"} label={step.status} /><span className="text-xs">{step.findings.length} findings · {step.evidence.length} evidence records</span>{step.excluded && <span className="text-xs text-cpx-red-700">Excluded</span>}</summary><div className="mt-4 space-y-4">{step.exclusionReason && <p className="text-xs text-cpx-grey-500">Exclusion reason: {step.exclusionReason}</p>}{step.error && <p className="text-xs text-cpx-red-700">{step.error}</p>}{step.limitations?.map((item, i) => <p key={i} className="text-xs text-status-warn-ink">{item}</p>)}{step.evidence.map((evidence) => <div key={evidence.id} className="border-l-2 border-cpx-grey-200 pl-3"><p className="text-xs font-medium">{evidence.label || evidence.id}</p><p className="mt-1 whitespace-pre-wrap text-sm">{defang(evidence.text)}</p><p className="mt-1 text-2xs text-cpx-grey-500">{evidence.source} · {evidence.id}{evidence.observedAt ? ` · ${gstDateTime(evidence.observedAt)}` : ""}</p></div>)}<div className="flex gap-2"><Button size="sm" disabled={busy} onClick={onExclude}>{step.excluded ? "Include contribution" : "Exclude contribution"}</Button>{SPECIALISTS.some(([area]) => area === step.area) && <Button size="sm" disabled={busy || step.status === "running"} onClick={onRerun}>Rerun specialist</Button>}</div></div></details>;
}
