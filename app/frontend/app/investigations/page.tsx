"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useConsoleUser } from "@/lib/role-context";
import { canSee } from "@/lib/access";
import { getCases } from "@/lib/workspace-api";
import type { InvestigationCase } from "@/lib/workspace-types";
import { gstDateTime } from "@/lib/format";
import { Button, PageHeader, SearchBox, SkeletonRows, StatusPill } from "@/components/ui";
import { CaseForm } from "@/components/investigations/CaseForm";
import { T_TABLE, T_HEAD, T_TH, T_TD, T_ROW } from "@/components/table";

export default function InvestigationsPage() {
  const { user } = useConsoleUser();
  const router = useRouter();
  const [items, setItems] = useState<InvestigationCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [reload, setReload] = useState(0);
  const [total, setTotal] = useState(0);
  const [moreBusy, setMoreBusy] = useState(false);
  useEffect(() => {
    let active = true; setLoading(true); setItems([]); setError(null);
    getCases(user.id).then((r) => { if (active) { setItems(r.items); setTotal(r.total); } }).catch((e: Error) => active && setError(e.message)).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [user.id, reload]);
  if (!canSee(user.role, "investigations")) return <p className="p-6">Not permitted at this access level.</p>;
  const rows = items.filter((item) => (status === "all" || item.status === status) && `${item.id} ${item.title} ${item.objective} ${item.createdBy}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return <div className="mx-auto w-full max-w-[1400px] px-6 py-6">
    <PageHeader title="Investigations" action={<Button variant="primary" onClick={() => setShowCreate(true)}>New investigation</Button>} />
    <div className="mb-4 flex flex-wrap items-center gap-3"><SearchBox value={query} onChange={setQuery} className="w-80" /><select aria-label="Case status" className="h-8 border border-cpx-grey-100 bg-white px-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All statuses</option>{["draft", "active", "awaiting-review", "changes-requested", "completed", "archived"].map((s) => <option key={s} value={s}>{s.replaceAll("-", " ")}</option>)}</select><span className="ml-auto text-xs text-cpx-grey-500">{rows.length} investigations · Recently updated</span></div>
    {error && <div role="alert" className="mb-4 flex items-center gap-3 border border-cpx-red-200 p-3 text-sm"><span>{error}</span><Button onClick={() => setReload((n) => n + 1)}>Retry</Button></div>}
    {loading ? <SkeletonRows rows={5} /> : <div className="overflow-x-auto"><table className={`${T_TABLE} w-full text-sm`}><thead><tr className={T_HEAD}>{["Investigation", "Status", "Priority", "Client", "Evidence", "Updated"].map((label) => <th key={label} className={T_TH}>{label}</th>)}</tr></thead><tbody>
      {!rows.length && <tr><td colSpan={6} className="p-6 text-sm">{query || status !== "all" ? "0 investigations match these filters." : "0 investigations. Create one to begin."}</td></tr>}
      {rows.map((item) => <tr key={item.id} className={T_ROW}><td className={T_TD}><Link className="font-medium text-link underline underline-offset-2" href={`/investigations/${item.id}`}>{item.title}</Link><p className="mt-1 font-mono text-2xs text-cpx-grey-500">{item.id}</p></td><td className={T_TD}><StatusPill tone={item.status === "completed" ? "good" : item.status === "active" || item.status === "awaiting-review" ? "warn" : "idle"} label={item.status.replaceAll("-", " ")} /></td><td className={T_TD}>{item.priority}</td><td className={T_TD}>{item.clientId ?? "Global"}</td><td className={T_TD}>{item.evidenceIds.length}</td><td className={`${T_TD} whitespace-nowrap`}>{gstDateTime(item.updatedAt)}</td></tr>)}
    </tbody></table></div>}
    {total > items.length && <div className="mt-4 flex items-center gap-3"><span className="text-xs text-cpx-grey-500">Showing {items.length} of {total}. Filters apply to loaded investigations.</span><Button disabled={moreBusy} onClick={async () => { setMoreBusy(true); try { const next = await getCases(user.id, items.length); setItems((current) => [...current, ...next.items]); setTotal(next.total); } catch (cause) { setError((cause as Error).message); } finally { setMoreBusy(false); } }}>{moreBusy ? "Loading…" : "Load more"}</Button></div>}
    {showCreate && <CaseForm onClose={() => setShowCreate(false)} onCreated={(item) => router.push(`/investigations/${item.id}`)} />}
  </div>;
}
