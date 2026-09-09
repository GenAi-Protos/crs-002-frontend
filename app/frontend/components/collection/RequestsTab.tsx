"use client";

// One path for adding a source: everything files a request. A feed URL
// auto-approves and goes live within the poll cycle; everything else queues.

import { useEffect, useState } from "react";
import { createRequest, getPirs } from "@/lib/api";
import { useConsoleUser } from "@/lib/role-context";
import type { Pir, SourceRequest } from "@/lib/types";
import { gstDate } from "@/lib/format";
import { defang } from "@/lib/defang";
import { StatusPill, type StatusTone, Dialog, buttonClass } from "@/components/ui";
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

  useEffect(() => setRows(initialRows), [initialRows]);

  return (
    <div className="mt-4 max-w-3xl xl:max-w-none">
      <div className="flex items-center justify-between">
        <span className="text-xs text-cpx-grey">
          <span className="font-medium text-cpx-black">{rows.length}</span> requests ·
          Newest first
        </span>
        <button
          onClick={() => setShowForm(true)}
          className={buttonClass("primary")}
        >
          <IconPlus />
          Request a source
        </button>
      </div>

      <div className="mt-3 grid grid-cols-1 items-start gap-2 xl:grid-cols-2">
        {rows.length === 0 && (
          <p className="text-sm">
            <span className="font-medium">0 requests</span>
          </p>
        )}
        {[...rows]
          .sort((a, b) => +new Date(b.requestedAt) - +new Date(a.requestedAt))
          .map((r) => (
            <div key={r.id} className="border border-black/10 bg-white px-4 py-3">
              <div className="flex items-center gap-3">
                {/* The tooltip carries the defanged form too: an inventory URL
                    is never shown, copied or logged in its live form. */}
                <span
                  className="min-w-0 flex-1 truncate font-mono text-xs"
                  title={defang(r.url)}
                >
                  {defang(r.url)}
                </span>
                <span className="bg-black/5 px-1.5 py-0.5 text-2xs">{r.pirRef}</span>
                <StatusPill {...STATUS_META[r.status]} />
              </div>
              <p className="mt-1.5 text-xs">{r.reason}</p>
              <p className="mt-1 text-2xs text-cpx-grey">
                {r.requestedBy} · {gstDate(r.requestedAt)}
                {r.note ? ` · ${r.note}` : ""}
              </p>
            </div>
          ))}
      </div>

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
            <span className="text-xs text-cpx-grey">URL</span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="mt-1 h-9 w-full border border-black/15 px-3 font-mono text-xs focus:border-cpx-purple focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs text-cpx-grey">Why</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="mt-1 w-full border border-black/15 px-3 py-2 text-sm focus:border-cpx-purple focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs text-cpx-grey">PIR served</span>
            <select
              value={pirRef}
              onChange={(e) => setPirRef(e.target.value)}
              className="mt-1 h-9 w-full border border-black/15 bg-white px-2 text-sm focus:outline-none"
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
