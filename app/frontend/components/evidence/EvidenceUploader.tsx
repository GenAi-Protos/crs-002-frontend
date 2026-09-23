"use client";

import { useEffect, useRef, useState } from "react";
import { useConsoleUser } from "@/lib/role-context";
import { getEvidence, retryEvidence, uploadEvidence, downloadEvidence } from "@/lib/workspace-api";
import type { EvidenceFile } from "@/lib/workspace-types";
import type { Tlp } from "@/lib/types";
import { Button, StatusPill } from "@/components/ui";

export const EVIDENCE_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png";
export const evidencePending = (files: EvidenceFile[]) => files.some((f) => f.status === "processing" || f.status === "indexing");

export function EvidenceUploader({ value, onChange, tlp = "AMBER", clientId = null, purpose = "conversation", onBusy, disabled = false }: {
  value: EvidenceFile[]; onChange: (files: EvidenceFile[]) => void; tlp?: Tlp; clientId?: string | null;
  purpose?: "conversation" | "submission"; onBusy?: (busy: boolean) => void; disabled?: boolean;
}) {
  const { user } = useConsoleUser();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const state = useRef({ value, onChange });
  state.current = { value, onChange };
  const pending = value.filter((f) => f.status === "processing" || f.status === "indexing").map((f) => f.id).join(",");
  useEffect(() => {
    if (!pending) return;
    let active = true;
    const timer = setInterval(() => {
      Promise.all(pending.split(",").map((id) => getEvidence(user.id, id))).then((next) => {
        if (!active) return;
        state.current.onChange(state.current.value.map((f) => next.find((n) => n.id === f.id) ?? f));
      }).catch(() => active && setError("Processing status is unavailable. Retry when connected."));
    }, 2000);
    return () => { active = false; clearInterval(timer); };
  }, [pending, user.id]);

  async function choose(files: File[]) {
    setError(null);
    const unsupported = files.find((f) => !EVIDENCE_ACCEPT.split(",").some((ext) => f.name.toLowerCase().endsWith(ext)));
    if (unsupported) { setError(`${unsupported.name}: choose a supported document, spreadsheet or image.`); return; }
    if (value.length + files.length > 10) { setError("Attach up to 10 files."); return; }
    if (files.some((f) => f.size > 25 * 1024 * 1024)) { setError("Each file must be 25 MiB or smaller."); return; }
    if ([...value, ...files].reduce((sum, f) => sum + f.size, 0) > 100 * 1024 * 1024) { setError("Attachments must total 100 MiB or less."); return; }
    setBusy(true); onBusy?.(true);
    try {
      const result = await uploadEvidence(user.id, files, tlp, clientId, purpose);
      state.current.onChange([...state.current.value, ...result.items]);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); onBusy?.(false); }
  }

  return <div className="space-y-2">
    <div className="flex flex-wrap items-center gap-3">
      <Button size="sm" disabled={busy || disabled || value.length >= 10} onClick={() => input.current?.click()}>{busy ? "Uploading" : "Attach files"}</Button>
      <input ref={input} type="file" aria-label="Evidence files" multiple accept={EVIDENCE_ACCEPT} className="sr-only" onChange={(e) => { const files = Array.from(e.target.files ?? []); e.target.value = ""; if (files.length) void choose(files); }} />
      <span className="text-2xs text-cpx-grey-500">PDF, Word, Excel, CSV, JPG, PNG · 25 MiB per file</span>
    </div>
    {error && <p role="alert" className="text-xs text-cpx-red-700">{error}</p>}
    {value.length > 0 && <ul className="divide-y divide-cpx-grey-100 border border-cpx-grey-100">
      {value.map((file) => <li key={file.id} className="px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 flex-1 break-words text-xs font-medium">{file.fileName}</span>
          <span className="text-2xs text-cpx-grey-500">{file.size < 1024 ? `${file.size} B` : `${(file.size / 1024).toFixed(1)} KiB`}</span>
          <StatusPill tone={file.status === "ready" ? "good" : file.status === "failed" ? "critical" : "warn"} label={file.status} />
          {file.status === "failed" && <Button size="sm" disabled={disabled} onClick={() => retryEvidence(user.id, file.id).then((next) => onChange(value.map((f) => f.id === next.id ? next : f))).catch((e: Error) => setError(e.message))}>Retry</Button>}
          <Button size="sm" variant="ghost" onClick={() => downloadEvidence(user.id, file).catch((e: Error) => setError(e.message))}>Download</Button>
          <Button size="sm" variant="ghost" disabled={disabled} onClick={() => onChange(value.filter((f) => f.id !== file.id))} aria-label={`Remove ${file.fileName}`}>Remove</Button>
        </div>
        {file.error && <p className="mt-1 text-xs text-cpx-red-700">{file.error}</p>}
        {file.warnings?.map((warning) => <p key={warning} className="mt-1 text-2xs text-status-warn-ink">{warning}</p>)}
      </li>)}
    </ul>}
  </div>;
}
