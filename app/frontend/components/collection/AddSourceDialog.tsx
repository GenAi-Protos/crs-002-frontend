"use client";

import { useEffect, useState } from "react";
import { useConsoleUser } from "@/lib/role-context";
import { createSubmission, workspaceRequest } from "@/lib/workspace-api";
import type { Client, SourceCategory, Tlp } from "@/lib/types";
import type { AnalystSubmission, EvidenceFile } from "@/lib/workspace-types";
import { TLP_CEILINGS } from "@/lib/ask-options";
import { Button, Dialog } from "@/components/ui";
import { EvidenceUploader, evidencePending } from "@/components/evidence/EvidenceUploader";
import { fieldClass } from "@/components/investigations/CaseForm";

const SOURCE_CATEGORIES: (SourceCategory | "Analyst Provided")[] = ["Analyst Provided", "OSINT Feeds", "IOC Feeds", "Vulnerability Monitoring", "Ransomware Monitoring", "Geopolitical Intelligence", "Telegram and Messaging"];

export function AddSourceDialog({ onClose, onSubmitted }: { onClose: () => void; onSubmitted: (submission: AnalystSubmission) => void }) {
  const { user } = useConsoleUser();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sourceName, setSourceName] = useState("Analyst Upload");
  const [sourceCategory, setSourceCategory] = useState("Analyst Provided");
  const [observedOn, setObservedOn] = useState(new Date().toISOString().slice(0, 10));
  const [tlp, setTlp] = useState<Tlp>("AMBER");
  const [confidence, setConfidence] = useState<"Low" | "Medium" | "High">("Low");
  const [clientId, setClientId] = useState("");
  const [clients, setClients] = useState<Pick<Client, "id" | "name">[]>([]);
  const [tags, setTags] = useState("");
  const [files, setFiles] = useState<EvidenceFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  useEffect(() => { workspaceRequest<{ items: Pick<Client, "id" | "name">[] }>(user.id, "/workspace/clients").then((result) => setClients(result.items)).catch(() => setClients([])); }, [user.id]);
  const valid = !!title.trim() && !!sourceName.trim() && !!sourceCategory.trim() && !!observedOn && (!!description.trim() || files.length > 0) && !files.some((f) => f.status === "failed") && !evidencePending(files);
  return <Dialog title="Add Source" onClose={onClose} className="max-h-[90dvh] max-w-2xl overflow-y-auto">
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault(); if (!valid || busy || uploading) return;
      setBusy(true); setError(null);
      try { onSubmitted(await createSubmission(user.id, { title: title.trim(), description: description.trim(), sourceName: sourceName.trim(), sourceCategory: sourceCategory.trim(), observedOn, tlp, confidence, clientId: clientId || null, tags: [...new Set(tags.split(",").map((t) => t.trim()).filter(Boolean))], attachmentIds: files.map((f) => f.id), idempotencyKey })); }
      catch (err) { setError((err as Error).message); setBusy(false); }
    }}>
      <label className="block text-xs">Intelligence Title <span aria-hidden>*</span><input required autoFocus className={fieldClass} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      <label className="block text-xs">Description<textarea className={fieldClass} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs">Source Name *<input required className={fieldClass} value={sourceName} onChange={(e) => setSourceName(e.target.value)} /></label>
        <label className="text-xs">Source Category *<select aria-label="Source Category" required className={fieldClass} value={sourceCategory} onChange={(e) => setSourceCategory(e.target.value)}>{SOURCE_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label>
        <label className="text-xs">Collection/Observation Date *<input required type="date" className={fieldClass} value={observedOn} onChange={(e) => setObservedOn(e.target.value)} /></label>
        <label className="text-xs">TLP<select aria-label="TLP" className={fieldClass} value={tlp} onChange={(e) => setTlp(e.target.value as Tlp)}>{TLP_CEILINGS.map((value) => <option key={value} value={value}>TLP:{value}</option>)}</select></label>
        <label className="text-xs">Confidence<select aria-label="Confidence" className={fieldClass} value={confidence} onChange={(e) => setConfidence(e.target.value as typeof confidence)}>{["Low", "Medium", "High"].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="text-xs">Client Scope<select aria-label="Client Scope" className={fieldClass} value={clientId} onChange={(e) => setClientId(e.target.value)}><option value="">Global</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
      </div>
      <label className="block text-xs">Tags<input placeholder="Comma-separated tags" className={fieldClass} value={tags} onChange={(e) => setTags(e.target.value)} /></label>
      <fieldset><legend className="mb-2 text-xs">Evidence File</legend><EvidenceUploader value={files} onChange={setFiles} tlp={tlp} clientId={clientId || null} purpose="submission" onBusy={setUploading} disabled={busy} /></fieldset>
      {!description.trim() && !files.length && <p className="text-2xs text-mute">Provide a description or an evidence file.</p>}
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      <div className="flex justify-end gap-2 border-t border-rule pt-4"><Button disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" variant="primary" disabled={!valid || busy || uploading}>{busy ? "Submitting" : "Submit to Repository"}</Button></div>
    </form>
  </Dialog>;
}
