"use client";

import { useEffect, useState } from "react";
import { createCase, workspaceRequest } from "@/lib/workspace-api";
import { useConsoleUser } from "@/lib/role-context";
import type { Client } from "@/lib/types";
import type { InvestigationCase, CaseOptions } from "@/lib/workspace-types";
import { Button, Dialog, fieldClass } from "@/components/ui";
import { statusLabel } from "@/lib/status";

// The shared field recipe lives in components/ui; re-exported for the forms
// that import it from here.
export { fieldClass };
export const SPECIALISTS = [
  ["osint", "Open-source intelligence"], ["vuln", "Vulnerabilities"], ["actor", "Threat actors"],
  ["ioc", "Indicators"], ["mitre", "ATT&CK mapping"],
] as const;

export function SpecialistPicker({ value, onChange, disabled, options }: { value: string[]; onChange: (value: string[]) => void; disabled?: boolean; options?: CaseOptions["specialists"] }) {
  return <fieldset disabled={disabled} className="space-y-2">
    <legend className="mb-2 text-xs font-medium">Specialists</legend>
    <div className="flex flex-wrap gap-x-5 gap-y-2">{(options ?? SPECIALISTS.map(([id, label]) => ({ id, label, available: true }))).map(({ id, label, available }) => <label key={id} className="flex items-center gap-2 text-xs"><input type="checkbox" disabled={!available} checked={value.includes(id)} onChange={(e) => onChange(e.target.checked ? [...value, id] : value.filter((v) => v !== id))} />{label}{!available ? " (unavailable)" : ""}</label>)}</div>
    <p className="text-2xs text-mute">Supervisor coordination and evidence checks always run.</p>
  </fieldset>;
}

export function SourcePicker({ value, onChange, sources, disabled }: { value: string[] | null; onChange: (value: string[] | null) => void; sources: CaseOptions["sources"]; disabled?: boolean }) {
  return <fieldset disabled={disabled} className="space-y-3"><legend className="mb-2 text-xs font-medium">Sources for this run</legend><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={value === null} onChange={(event) => onChange(event.target.checked ? null : sources.filter((source) => source.available).map((source) => source.id))} />Choose available sources automatically</label>{value !== null && <div className="max-h-52 space-y-3 overflow-y-auto border border-rule p-3">{sources.map((source) => <label key={source.id} className="flex items-start gap-2 text-xs"><input type="checkbox" className="mt-0.5" disabled={!source.available} checked={value.includes(source.id)} onChange={(event) => onChange(event.target.checked ? [...value, source.id] : value.filter((id) => id !== source.id))} /><span>{source.name}<span className="ml-2 text-2xs text-mute">{source.status}</span>{source.reason && <span className="mt-1 block text-2xs text-mute">{source.reason}</span>}</span></label>)}</div>}</fieldset>;
}

export function CaseForm({ onClose, onCreated, initialTitle = "", initialObjective = "", initialEntity, initialClientId }: {
  onClose: () => void; onCreated: (item: InvestigationCase) => void; initialTitle?: string; initialObjective?: string; initialEntity?: string; initialClientId?: string | null;
}) {
  const { user } = useConsoleUser();
  const [title, setTitle] = useState(initialTitle);
  const [objective, setObjective] = useState(initialObjective);
  const [entities, setEntities] = useState([{ type: "indicator", value: initialEntity ?? "" }]);
  const [clientId, setClientId] = useState(initialClientId ?? "");
  const [clients, setClients] = useState<Pick<Client, "id" | "name">[]>([]);
  const [priority, setPriority] = useState<InvestigationCase["priority"]>("medium");
  const [specialists, setSpecialists] = useState(["osint", "vuln", "actor", "ioc", "mitre"]);
  const [options, setOptions] = useState<CaseOptions | null>(null);
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { workspaceRequest<{ items: Pick<Client, "id" | "name">[] }>(user.id, "/workspace/clients").then((result) => setClients(result.items)).catch(() => setClients([])); }, [user.id]);
  useEffect(() => { workspaceRequest<CaseOptions>(user.id, "/investigations/options").then(setOptions).catch((cause: Error) => setError(cause.message)); }, [user.id]);
  return <Dialog title="New investigation" onClose={onClose} className="max-h-[90dvh] max-w-2xl overflow-y-auto">
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setError(null);
      try { onCreated(await createCase(user.id, { title: title.trim(), objective: objective.trim(), entities: entities.filter((x) => x.value.trim()).map((x) => ({ ...x, value: x.value.trim() })), clientId: clientId || null, workflowRef: "wf-deep-dive", specialists, priority, selectedSourceIds })); }
      catch (err) { setError((err as Error).message); setBusy(false); }
    }}>
      <label className="block text-xs">Title<input aria-label="Title" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} className={fieldClass} /></label>
      <label className="block text-xs">Objective<textarea aria-label="Objective" required maxLength={4000} rows={3} value={objective} onChange={(e) => setObjective(e.target.value)} className={fieldClass} /></label>
      <fieldset><legend className="text-xs">Starting entities</legend><div className="space-y-2">{entities.map((entity, i) => <div key={i} className="flex gap-2">
        <select aria-label={`Entity ${i + 1} type`} className={`${fieldClass} max-w-40`} value={entity.type} onChange={(e) => setEntities(entities.map((x, n) => n === i ? { ...x, type: e.target.value } : x))}>{["indicator", "threat-actor", "campaign", "organisation", "vulnerability", "malware"].map((v) => <option key={v} value={v}>{statusLabel(v)}</option>)}</select>
        <input aria-label={`Entity ${i + 1} value`} value={entity.value} className={fieldClass} onChange={(e) => setEntities(entities.map((x, n) => n === i ? { ...x, value: e.target.value } : x))} />
        {entities.length > 1 && <Button size="sm" variant="ghost" onClick={() => setEntities(entities.filter((_, n) => i !== n))} aria-label={`Remove entity ${i + 1}`}>Remove</Button>}
      </div>)}</div><Button size="sm" className="mt-2" onClick={() => setEntities([...entities, { type: "indicator", value: "" }])}>Add entity</Button></fieldset>
      <div className="grid grid-cols-2 gap-4"><label className="text-xs">Client scope<select aria-label="Client scope" value={clientId} onChange={(e) => setClientId(e.target.value)} className={fieldClass}><option value="">Global</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="text-xs">Priority<select aria-label="Priority" value={priority} onChange={(e) => setPriority(e.target.value as InvestigationCase["priority"])} className={fieldClass}>{["low", "medium", "high", "critical"].map((p) => <option key={p} value={p}>{statusLabel(p)}</option>)}</select></label></div>
      <p className="text-xs text-mute">Workflow: {options?.workflows[0]?.label ?? "Deep investigation"}</p>
      <SpecialistPicker value={specialists} onChange={setSpecialists} options={options?.specialists} />
      <SourcePicker value={selectedSourceIds} onChange={setSelectedSourceIds} sources={options?.sources ?? []} disabled={!options} />
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      <div className="flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="primary" disabled={busy || !options || !title.trim() || !objective.trim() || !specialists.length || selectedSourceIds?.length === 0}>{busy ? "Creating" : "Create investigation"}</Button></div>
    </form>
  </Dialog>;
}
