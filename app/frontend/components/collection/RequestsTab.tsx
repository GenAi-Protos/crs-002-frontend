"use client";

// One path for adding a source: everything files a request. A feed URL
// auto-approves and goes live within the poll cycle; everything else queues.

import { useEffect, useState } from "react";
import { createRequest, getPirs } from "@/lib/api";
import { useConsoleUser } from "@/lib/role-context";
import type { Pir, SourceRequest } from "@/lib/types";
import { gstDate } from "@/lib/format";
import { defang } from "@/lib/defang";
import { Button, Dialog, ListMeta, Panel, SearchBox, StatusPill, type StatusTone, buttonClass } from "@/components/ui";
import { TypeBadge } from "@/components/table";
import { IconPlus } from "@/components/icons";

const STATUS_META: Record<SourceRequest["status"], { tone: StatusTone; label: string }> = {
  "auto-approved": { tone: "good", label: "Auto-approved" },
  queued: { tone: "idle", label: "Queued" },
  approved: { tone: "good", label: "Approved" },
  rejected: { tone: "critical", label: "Rejected" },
  "blocked-network": { tone: "warn", label: "Blocked, network" },
};

export function RequestsTab({ initialRows = [] }: { requestedBy?: string; initialRows?: SourceRequest[] }) {
  const { user } = useConsoleUser();
  const [rows, setRows] = useState<SourceRequest[]>(initialRows);
  const [showForm, setShowForm] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => setRows(initialRows), [initialRows]);

  const needle = q.toLowerCase();
  const shown = [...rows]
    .filter((r) => !needle || `${r.reason} ${r.pirRef} ${defang(r.url)} ${r.requestedBy}`.toLowerCase().includes(needle))
    .sort((a, b) => +new Date(b.requestedAt) - +new Date(a.requestedAt));

  return (
    <div>
      <Panel
        title="Source requests"
        count={rows.length}
        action={
          <Button size="sm" variant="primary" onClick={() => setShowForm(true)}>
            <IconPlus />
            Request a source
          </Button>
        }
        enter={0}
        flush
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-cpx-grey-100 px-3 py-2">
          <SearchBox value={q} onChange={setQ} placeholder="Search requests" className="w-full max-w-72" />
          <div className="flex-1" />
          <ListMeta shown={shown.length} total={rows.length} sort="Newest first" />
        </div>
        {shown.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-cpx-grey-500">
            <span className="font-medium text-cpx-black">0 requests</span>
            {q ? " match." : "."}
          </p>
        )}
        <ul>
          {shown.map((r) => (
            <li key={r.id} className="row-link border-b border-cpx-grey-100 px-3 py-2 last:border-b-0">
              {/* The reason names the request; the URL is the evidence under it.
                  Leading with the URL made every row read as an address. */}
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-sm font-medium" title={r.reason}>
                  {r.reason}
                </p>
                <TypeBadge label={r.pirRef} />
                <StatusPill {...STATUS_META[r.status]} />
              </div>
              {/* The tooltip carries the defanged form too: an inventory URL
                  is never shown, copied or logged in its live form. */}
              <p className="mt-0.5 flex items-center gap-2 text-2xs text-cpx-grey-500">
                <span className="min-w-0 flex-1 truncate font-mono" title={defang(r.url)}>
                  {defang(r.url)}
                </span>
                <span className="shrink-0">
                  {r.requestedBy} · {gstDate(r.requestedAt)}
                </span>
              </p>
              {r.note && <p className="mt-0.5 text-2xs text-cpx-grey-500">{r.note}</p>}
            </li>
          ))}
        </ul>
      </Panel>

      {showForm && (
        <RequestDialog
          onClose={() => setShowForm(false)}
          onCreate={async (draft) => {
            // The server decides the status: it derives the collector class,
            // and it records the URL as text without ever fetching it.
            const filed = await createRequest(user.id, draft);
            setRows((rs) => [filed, ...rs]);
            setShowForm(false);
          }}
        />
      )}
    </div>
  );
}

function RequestDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (draft: { url: string; reason: string; pirRef: string }) => Promise<void>;
}) {
  const { user } = useConsoleUser();
  const [url, setUrl] = useState("");
  const [reason, setReason] = useState("");
  const [pirRef, setPirRef] = useState("PIR1");
  const [pirs, setPirs] = useState<Pir[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = url.trim().length > 8 && reason.trim() !== "";

  useEffect(() => {
    getPirs(user.id).then(setPirs).catch(() => setPirs([]));
  }, [user.id]);

  return (
    <Dialog title="Request a source" onClose={onClose}>
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-cpx-grey-500">URL</span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="mt-1 h-9 w-full border border-cpx-grey-100 px-3 font-mono text-xs focus:border-cpx-green focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs text-cpx-grey-500">Why</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="mt-1 w-full border border-cpx-grey-100 px-3 py-2 text-sm focus:border-cpx-green focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs text-cpx-grey-500">PIR served</span>
            <select
              value={pirRef}
              onChange={(e) => setPirRef(e.target.value)}
              className="mt-1 h-9 w-full border border-cpx-grey-100 bg-white px-2 text-sm focus:outline-none"
            >
              {pirs.map((p) => (
                <option key={p.ref} value={p.ref}>
                  {p.ref}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error && <p className="mt-3 text-xs text-status-warn-ink">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className={buttonClass()}
          >
            Cancel
          </button>
          <button
            disabled={!valid || busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await onCreate({ url: url.trim(), reason: reason.trim(), pirRef });
              } catch (e) {
                setError((e as Error).message);
                setBusy(false);
              }
            }}
            className={buttonClass("primary")}
          >
            {busy ? "Filing" : "File"}
          </button>
        </div>
    </Dialog>
  );
}
