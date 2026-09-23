"use client";

// Shared cases, newest activity first. The list is also the backdrop of
// /investigations/new, so creating a case never opens onto a blank tab.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useConsoleUser } from "@/lib/role-context";
import { canSee } from "@/lib/access";
import { getCases } from "@/lib/workspace-api";
import type { CaseStatus, InvestigationCase } from "@/lib/workspace-types";
import { agoFromNow, gstDateTime } from "@/lib/format";
import { CASE_STATE } from "@/lib/status";
import {
  Banner,
  Button,
  EmptyState,
  ListMeta,
  NotPermitted,
  Page,
  PageHeader,
  Panel,
  PriorityBadge,
  SearchBox,
  Select,
  SkeletonRows,
  StatusPill,
} from "@/components/ui";
import { IconChevronRight, IconPlus } from "@/components/icons";
import { CaseForm } from "@/components/investigations/CaseForm";
import { EmptyRow, T_HEAD, T_NUM, T_ROW, T_TABLE, T_TD, T_TH } from "@/components/table";

const STATUSES = Object.keys(CASE_STATE) as CaseStatus[];

export function CaseList({ creating = false }: { creating?: boolean }) {
  const { user } = useConsoleUser();
  const router = useRouter();
  const [items, setItems] = useState<InvestigationCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [showCreate, setShowCreate] = useState(creating);
  const [reload, setReload] = useState(0);
  const [total, setTotal] = useState(0);
  const [moreBusy, setMoreBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setItems([]);
    setError(null);
    getCases(user.id)
      .then((r) => {
        if (active) {
          setItems(r.items);
          setTotal(r.total);
        }
      })
      .catch((e: Error) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [user.id, reload]);

  if (!canSee(user.role, "investigations")) return <NotPermitted />;

  const needle = query.toLowerCase();
  const rows = items
    .filter(
      (item) =>
        (status === "all" || item.status === status) &&
        `${item.id} ${item.title} ${item.objective} ${item.createdBy}`.toLowerCase().includes(needle),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const now = new Date();
  // Rule 8: a list that did not load is not an empty list.
  const unloaded = !!error && items.length === 0;

  const closeCreate = () => {
    setShowCreate(false);
    if (creating) router.replace("/investigations");
  };

  return (
    <Page band>
      <PageHeader
        title="Investigations"
        action={
          <Button variant="primary" onClick={() => setShowCreate(true)}>
            <IconPlus />
            New investigation
          </Button>
        }
      />
      {error && (
        <Banner className="mb-3" action={<Button size="sm" onClick={() => setReload((n) => n + 1)}>Retry</Button>}>
          {error}
        </Banner>
      )}
      <Panel flush enter={0} bodyClassName="@container">
        <div className="flex flex-wrap items-center gap-2 border-b border-cpx-grey-100 px-3 py-2">
          <SearchBox value={query} onChange={setQuery} className="w-full max-w-80" />
          <Select aria-label="Case status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {CASE_STATE[s].label}
              </option>
            ))}
          </Select>
          <div className="flex-1" />
          {!unloaded && <ListMeta shown={rows.length} total={total} sort="Recently updated" />}
        </div>
        {loading ? (
          <SkeletonRows rows={5} className="p-3" />
        ) : unloaded ? (
          <EmptyState>Not loaded.</EmptyState>
        ) : (
          <table className={`${T_TABLE} table-fixed text-sm`}>
            <colgroup>
              <col />
              <col className="w-40" />
              <col className="w-28" />
              <col className="hidden w-28 @2xl:table-column" />
              <col className="hidden w-20 @3xl:table-column" />
              <col className="w-28" />
              <col className="w-8" />
            </colgroup>
            <thead>
              <tr className={T_HEAD}>
                <th className={T_TH}>Investigation</th>
                <th className={T_TH}>Status</th>
                <th className={T_TH}>Priority</th>
                <th className={`${T_TH} hidden @2xl:table-cell`}>Client</th>
                <th className={`${T_TH} ${T_NUM} hidden @3xl:table-cell`}>Evidence</th>
                <th className={T_TH}>Updated</th>
                <th className={T_TH}>
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {!rows.length && (
                <EmptyRow colSpan={7}>
                  {query || status !== "all" ? (
                    <>
                      <span className="font-medium text-cpx-black">0 investigations</span> match these filters.
                    </>
                  ) : (
                    <>
                      <span className="font-medium text-cpx-black">0 investigations.</span> Create one to begin.
                    </>
                  )}
                </EmptyRow>
              )}
              {rows.map((item) => (
                <tr key={item.id} className={`${T_ROW} relative`}>
                  <td className={T_TD}>
                    <Link
                      className="block truncate font-medium after:absolute after:inset-0"
                      href={`/investigations/${item.id}`}
                      title={`${item.title} · ${item.id}`}
                    >
                      {item.title}
                    </Link>
                  </td>
                  <td className={T_TD}>
                    <StatusPill tone={CASE_STATE[item.status].tone} label={CASE_STATE[item.status].label} />
                  </td>
                  <td className={T_TD}>
                    <PriorityBadge level={item.priority} />
                  </td>
                  <td className={`${T_TD} hidden font-mono text-xs text-cpx-grey-700 @2xl:table-cell`}>
                    {item.clientId ?? "Global"}
                  </td>
                  <td className={`${T_TD} ${T_NUM} hidden @3xl:table-cell`}>{item.evidenceIds.length}</td>
                  <td
                    className={`${T_TD} whitespace-nowrap text-xs text-cpx-grey-500`}
                    title={gstDateTime(item.updatedAt)}
                  >
                    {agoFromNow(item.updatedAt, now)}
                  </td>
                  <td className={T_TD}>
                    <IconChevronRight className="lean text-cpx-grey-300" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {total > items.length && (
          <div className="flex items-center justify-center gap-3 border-t border-cpx-grey-100 px-3 py-2">
            <span className="text-xs text-cpx-grey-500">Filters apply to loaded investigations.</span>
            <Button
              size="sm"
              disabled={moreBusy}
              onClick={async () => {
                setMoreBusy(true);
                try {
                  const next = await getCases(user.id, items.length);
                  setItems((current) => [...current, ...next.items]);
                  setTotal(next.total);
                } catch (cause) {
                  setError((cause as Error).message);
                } finally {
                  setMoreBusy(false);
                }
              }}
            >
              {moreBusy ? "Loading" : "Load more"}
            </Button>
          </div>
        )}
      </Panel>
      {showCreate && (
        <CaseForm onClose={closeCreate} onCreated={(item) => router.push(`/investigations/${item.id}`)} />
      )}
    </Page>
  );
}
