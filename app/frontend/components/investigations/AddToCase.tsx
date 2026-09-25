"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCases, caseAction, workspaceRequest } from "@/lib/workspace-api";
import { useConsoleUser } from "@/lib/role-context";
import type { EvidenceFile, InvestigationCase } from "@/lib/workspace-types";
import { Button, Dialog } from "@/components/ui";
import { CaseForm, fieldClass } from "./CaseForm";

export function AddToCase({ title, conversationId, turnId, lookup, files = [], clientId, runId }: {
  title: string; conversationId?: string; turnId?: string; lookup?: { observable: string; [key: string]: unknown }; files?: EvidenceFile[]; clientId?: string | null; runId?: string;
}) {
  const { user } = useConsoleUser();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [items, setItems] = useState<InvestigationCase[]>([]);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(0);
  const [selected, setSelected] = useState("");
  const [fileIds, setFileIds] = useState<string[]>(files.map((f) => f.id));
  const [includeAnswer, setIncludeAnswer] = useState(true);
  const [retrievedClients, setRetrievedClients] = useState<string[]>([]);
  const [scopeLoading, setScopeLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    let active = true;
    getCases(user.id).then((r) => { if (active) { setItems(r.items.filter((c) => !["completed", "archived"].includes(c.status))); setTotal(r.total); setLoaded(r.items.length); } }).catch((e: Error) => active && setError(e.message));
    return () => { active = false; };
  }, [open, user.id]);
  useEffect(() => {
    if (!open || !runId) return;
    let active = true; setScopeLoading(true);
    workspaceRequest<{ clientIds?: string[] }>(user.id, `/intelligence/runs/${encodeURIComponent(runId)}`).then((run) => { if (active) setRetrievedClients(run.clientIds ?? []); }).catch((cause: Error) => { if (active) setError(cause.message); }).finally(() => { if (active) setScopeLoading(false); });
    return () => { active = false; };
  }, [open, runId, user.id]);
  const multipleClients = includeAnswer && retrievedClients.length > 1;
  const incomplete = (includeAnswer && scopeLoading) || multipleClients || (!includeAnswer && !lookup && !fileIds.length);
  const suggestedClient = includeAnswer && retrievedClients.length === 1 ? retrievedClients[0] : clientId ?? files.find((file) => fileIds.includes(file.id) && file.clientId)?.clientId;
  async function attach(item: InvestigationCase) {
    setBusy(true); setError(null);
    try {
      await caseAction(user.id, item.id, "evidence", { expectedRevision: item.revision, fileIds, ...(includeAnswer && conversationId && turnId ? { conversationId, turnId } : {}), ...(lookup ? { lookup } : {}) });
      router.push(`/investigations/${item.id}`);
    } catch (e) { setError((e as Error).message); setBusy(false); setCreating(false); setOpen(true); }
  }
  return <>
    <Button size="sm" onClick={() => { setFileIds(files.map((f) => f.id)); setOpen(true); }}>Add to investigation</Button>
    {open && !creating && <Dialog title="Add to investigation" onClose={() => setOpen(false)}>
      <p className="mb-4 text-sm font-medium">{title}</p>
      {conversationId && <div className="mb-4 space-y-2"><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={includeAnswer} onChange={(event) => setIncludeAnswer(event.target.checked)} />Include answer and citations</label><p className="text-2xs text-mute">Answers require a matching client scope. Attach selected files alone by clearing this option.</p></div>}
      {multipleClients && <p role="alert" className="mb-4 text-xs text-status-warn-ink">The answer contains evidence for multiple clients. Ask a client-scoped question or attach selected files only.</p>}
      {files.length > 0 && <fieldset className="mb-4 space-y-2"><legend className="mb-2 text-xs">Evidence to include</legend>{files.map((file) => <label key={file.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={fileIds.includes(file.id)} onChange={(e) => setFileIds(e.target.checked ? [...fileIds, file.id] : fileIds.filter((id) => id !== file.id))} />{file.fileName}</label>)}</fieldset>}
      <label className="block text-xs">Existing investigation<select value={selected} onChange={(e) => setSelected(e.target.value)} className={fieldClass}><option value="">Select an investigation</option>{items.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      {loaded < total && <Button size="sm" className="mt-2" disabled={busy} onClick={async () => { setBusy(true); try { const next = await getCases(user.id, loaded); setItems((current) => [...current, ...next.items.filter((item) => !["completed", "archived"].includes(item.status))]); setLoaded((count) => count + next.items.length); setTotal(next.total); } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); } }}>Load more investigations</Button>}
      {error && <p role="alert" className="mt-3 text-xs text-danger">{error}</p>}
      <div className="mt-5 flex justify-end gap-2"><Button disabled={busy || incomplete} onClick={() => setCreating(true)}>Create new</Button><Button variant="primary" disabled={!selected || busy || incomplete} onClick={() => { const item = items.find((c) => c.id === selected); if (item) void attach(item); }}>{busy ? "Adding" : "Add selected content"}</Button></div>
    </Dialog>}
    {creating && <CaseForm onClose={() => setCreating(false)} initialTitle={title.slice(0, 120)} initialObjective={title} initialEntity={lookup?.observable} initialClientId={suggestedClient} onCreated={(item) => { setItems((current) => [item, ...current]); setSelected(item.id); setCreating(false); setOpen(true); void attach(item); }} />}
  </>;
}
