"use client";

// The audit trail: who did what to which record, newest first (FR-AUD-01 to
// FR-AUD-03). Read straight from /audit, which the backend appends to on every
// sensitive action and strips of URLs before storing (FR-SAF-02), so nothing
// here can render a source address.
//
// A feed that failed to load says so; it is never shown as an empty trail.

import { useEffect, useMemo, useState } from "react";
import { useConsoleUser } from "@/lib/role-context";
import { workspaceRequest } from "@/lib/workspace-api";
import { agoFromNow, gstDateTime } from "@/lib/format";
import { statusLabel } from "@/lib/status";
import { userName } from "@/lib/users";
import {
  Banner,
  Button,
  downloadCsv,
  EmptyState,
  ListMeta,
  Panel,
  SearchBox,
  Select,
  SkeletonRows,
} from "@/components/ui";
import { EmptyRow, T_HEAD, T_ROW, T_TABLE, T_TD, T_TH } from "@/components/table";

interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  ref: string | null;
  detail: Record<string, unknown>;
}

// ponytail: one read of the newest 1,000 (the endpoint's ceiling), filtered
// here; page through the backend's actor/action/ref filters when it grows.
const LIMIT = 1000;

const ALL = "all";

/** `clientIds: [a, b]` reads as "client ids: a, b". */
function detailText(detail: Record<string, unknown>): string {
  return Object.entries(detail)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => {
      const key = k.replace(/([A-Z])/g, " $1").toLowerCase();
      const value = Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v);
      return `${key}: ${value}`;
    })
    .join(" · ");
}

export function AuditTab() {
  const { user } = useConsoleUser();
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [q, setQ] = useState("");
  const [action, setAction] = useState(ALL);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    workspaceRequest<{ total: number; items: AuditEntry[] }>(user.id, `/audit?limit=${LIMIT}`)
      .then((r) => {
        if (!live) return;
        setItems(r.items);
        setTotal(r.total);
      })
      .catch((e: Error) => live && setError(e.message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [user.id, reload]);

  const actions = useMemo(() => [...new Set(items.map((i) => i.action))].sort(), [items]);
  const needle = q.trim().toLowerCase();
  const rows = items.filter(
    (i) =>
      (action === ALL || i.action === action) &&
      (needle === "" ||
        `${userName(i.actor)} ${i.actor} ${i.action} ${i.ref ?? ""} ${detailText(i.detail)}`
          .toLowerCase()
          .includes(needle)),
  );
  const now = new Date();
  const unloaded = !!error && items.length === 0;

  return (
    <Panel title="Audit trail" count={unloaded ? undefined : total} enter={0} flush bodyClassName="@container">
      {error && (
        <Banner
          className="m-3"
          action={
            <Button size="sm" onClick={() => setReload((n) => n + 1)}>
              Retry
            </Button>
          }
        >
          The audit trail could not be loaded. {error}
        </Banner>
      )}
      <div className="flex flex-wrap items-center gap-2 border-b border-cpx-grey-100 px-3 py-2">
        <SearchBox value={q} onChange={setQ} placeholder="Search actor, action or reference" className="w-full max-w-72" />
        <Select aria-label="Action" value={action} onChange={(e) => setAction(e.target.value)} fieldSize="sm">
          <option value={ALL}>All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {statusLabel(a)}
            </option>
          ))}
        </Select>
        <div className="flex-1" />
        {!unloaded && (
          <ListMeta
            shown={rows.length}
            total={total}
            sort="Newest first"
            note={total > items.length ? <span>Newest {items.length.toLocaleString("en-GB")} loaded.</span> : undefined}
            onExport={() =>
              downloadCsv(
                "audit-trail.csv",
                ["When", "Actor", "Action", "Reference", "Detail"],
                rows.map((i) => [
                  i.at ? gstDateTime(i.at) : "",
                  userName(i.actor),
                  statusLabel(i.action),
                  i.ref ?? "",
                  detailText(i.detail),
                ]),
              )
            }
          />
        )}
      </div>
      {loading && items.length === 0 ? (
        <SkeletonRows rows={8} className="p-3" />
      ) : unloaded ? (
        <EmptyState>Not loaded.</EmptyState>
      ) : (
        <table className={`${T_TABLE} table-fixed`}>
          <colgroup>
            <col className="w-28" />
            <col className="w-40" />
            <col className="w-44" />
            <col className="w-56" />
            <col className="hidden @3xl:table-column" />
          </colgroup>
          <thead>
            <tr className={T_HEAD}>
              <th className={T_TH}>When</th>
              <th className={T_TH}>Actor</th>
              <th className={T_TH}>Action</th>
              <th className={T_TH}>Reference</th>
              <th className={`${T_TH} hidden @3xl:table-cell`}>Detail</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <EmptyRow colSpan={5}>
                <span className="font-medium text-cpx-black">0 audit events</span>{" "}
                {items.length ? "match these filters." : "recorded."}
              </EmptyRow>
            )}
            {rows.map((i) => {
              const detail = detailText(i.detail);
              return (
                <tr key={i.id} className={T_ROW}>
                  <td className={`${T_TD} whitespace-nowrap text-xs tabular-nums text-cpx-grey-500`} title={i.at ? gstDateTime(i.at) : undefined}>
                    {i.at ? agoFromNow(i.at, now) : "-"}
                  </td>
                  <td className={T_TD}>
                    <span className="block truncate font-medium" title={i.actor}>
                      {userName(i.actor)}
                    </span>
                  </td>
                  <td className={T_TD}>
                    <span className="block truncate text-cpx-grey-700">{statusLabel(i.action)}</span>
                  </td>
                  <td className={T_TD}>
                    <span className="block truncate font-mono text-xs text-cpx-grey-600" title={i.ref ?? undefined}>
                      {i.ref ?? "-"}
                    </span>
                  </td>
                  <td className={`${T_TD} hidden @3xl:table-cell`}>
                    <span className="block truncate text-xs text-cpx-grey-500" title={detail}>
                      {detail || "-"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
