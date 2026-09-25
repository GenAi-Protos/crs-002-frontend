"use client";

// Judge a client-facing artefact and release it. Default tab: Needs review.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useConsoleUser } from "@/lib/role-context";
import { assembleAdvisories, canSee, canWriteReports, publishedOnly } from "@/lib/access";
import { ADVISORIES } from "@/lib/fixtures";
import type { Advisory, Client } from "@/lib/types";
import {
  Button,
  downloadCsv,
  FilterChip,
  ListMeta,
  NotPermitted,
  OfflineNote,
  Page,
  PageHeader,
  Panel,
  SearchBox,
  Select,
  SkeletonRows,
  StatusPill,
  Tabs,
  tabPanelProps,
} from "@/components/ui";
import { IconCheck, IconChevronDown, IconPlus } from "@/components/icons";
import {
  Clipped,
  EmptyRow,
  TypeBadge,
  T_HEAD,
  T_ROW,
  T_TABLE,
  T_TD,
  T_TH,
} from "@/components/table";
import { ADVISORY_STATE } from "@/lib/status";
import { gstDate } from "@/lib/format";
import { archiveReport, createReport, getDashboardData, getReports, isUnreachable } from "@/lib/api";
import { NewReportDialog } from "@/components/reports/NewReportDialog";
import { RowActions } from "@/components/reports/RowActions";
import { ReportPreview } from "@/components/reports/ReportPreview";
import { sectionsFrom, type ReportType } from "@/lib/report-templates";

type TabKey = "review" | "drafts" | "published" | "all";

// The badge is two letters; the tooltip is what they stand for.
const TYPE_TITLE: Record<string, string> = {
  IA: "Intelligence Advisory",
  VA: "Vulnerability Advisory",
  DG: "Daily Digest",
  RFI: "Request for Information",
};

const yearOf = (a: Advisory) => new Date(a.createdAt).getUTCFullYear();

const BY_TAB: Record<TabKey, (a: Advisory) => boolean> = {
  review: (a) => a.status === "in-review",
  drafts: (a) => a.status === "draft",
  published: (a) =>
    ["published", "superseded", "retracted", "did-not-run"].includes(a.status),
  all: () => true,
};

export default function ReportsPage() {
  const { user } = useConsoleUser();
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("review");
  // Published-only roles get one fixed tab; the payload is already filtered.
  const readOnly = publishedOnly(user.role);
  const effectiveTab: TabKey = readOnly ? "published" : tab;
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [q, setQ] = useState("");
  const [year, setYear] = useState("2026");
  const [types, setTypes] = useState<Set<string>>(
    new Set(["IA", "VA", "TAP", "DG", "RFI"]),
  );
  const [openRfi, setOpenRfi] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [shown, setShown] = useState(50);
  const [apiRows, setApiRows] = useState<Advisory[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  // Preview opens over the list as well as inside a report: judging a draft
  // often means checking how it reads before opening it at all.
  const [preview, setPreview] = useState<Advisory | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const writable = canWriteReports(user.role);

  // Client names come from /dashboard, not /clients: Clients is a lead-analyst
  // destination and an analyst reading Reports would be refused there.
  useEffect(() => {
    getReports(user.id)
      .then((rows) => {
        setApiRows(rows);
        setOffline(false);
      })
      .catch((e) => {
        setApiRows(ADVISORIES);
        setOffline(isUnreachable(e));
      })
      .finally(() => setLoading(false));
    getDashboardData(user.id).then((d) => setClients(d.clients)).catch(() => setClients([]));
  }, [user.id]);

  const rows = useMemo(() => {
    const assembled = assembleAdvisories(apiRows, user);
    return assembled.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [user, apiRows]);

  // One pass over the rows per change of filter, not six per keystroke: the
  // digest alone is a row a day, so the list is long by design.
  const { filtered, tabCounts, years } = useMemo(() => {
    const needle = q.toLowerCase();
    const inScope = rows.filter((a) => String(yearOf(a)) === year && types.has(a.type));
    const filtered = inScope.filter(
      (a) =>
        BY_TAB[effectiveTab](a) &&
        (needle === "" ||
          a.title.toLowerCase().includes(needle) ||
          a.ref.toLowerCase().includes(needle)),
    );
    const tabCounts = Object.fromEntries(
      (Object.keys(BY_TAB) as TabKey[]).map((k) => [k, inScope.filter(BY_TAB[k]).length]),
    ) as Record<TabKey, number>;
    const years = [...new Set(rows.map((a) => String(yearOf(a))))].sort().reverse();
    return { filtered, tabCounts, years };
  }, [rows, effectiveTab, year, types, q]);

  // Duplicate creates a fresh draft carrying the same structure and content.
  // The server issues the reference and resets the gate: a copy of a published
  // advisory is not itself published.
  const duplicate = async (a: Advisory) => {
    try {
      const created = await createReport(user.id, {
        type: a.type as "IA" | "VA" | "DG" | "TAP",
        title: `${a.title} (copy)`,
        sections: a.sections,
        template: a.template,
      });
      setApiRows((r) => [created, ...r]);
      setNotice(`${created.ref} created as a draft.`);
    } catch (e) {
      setNotice((e as Error).message);
    }
  };

  const archive = async (a: Advisory) => {
    try {
      await archiveReport(user.id, a.ref);
      setApiRows((r) =>
        r.map((x) => (x.ref === a.ref ? { ...x, status: "archived" } : x)),
      );
      setNotice(`${a.ref} archived.`);
    } catch (e) {
      setNotice((e as Error).message);
    }
  };

  if (!canSee(user.role, "reports")) return <NotPermitted />;

  const visible = filtered.slice(0, shown);
  const tabCount = (k: TabKey) => tabCounts[k];

  return (
    <Page band>
      <PageHeader
        title="Reports"
        action={
          writable ? (
            <Button variant="primary" onClick={() => setShowNew(true)}>
              <IconPlus />
              New report
            </Button>
          ) : undefined
        }
      />

      <Panel flush enter={0} bodyClassName="@container">
      <Tabs<TabKey>
        className="px-2 pt-1"
        label="Report state"
        tabs={
          readOnly
            ? [{ key: "published", label: "Published", count: tabCount("published") }]
            : [
                { key: "review", label: "Needs review", count: tabCount("review") },
                { key: "drafts", label: "Drafts", count: tabCount("drafts") },
                { key: "published", label: "Published", count: tabCount("published") },
                { key: "all", label: "All", count: tabCount("all") },
              ]
        }
        value={effectiveTab}
        onChange={setTab}
        id="reports"
      />

      <div {...tabPanelProps("reports", effectiveTab)}>
      <div className="flex flex-wrap items-center gap-2 border-b border-rule px-3 py-2">
        <SearchBox value={q} onChange={setQ} className="w-full max-w-72" />
        <Select value={year} onChange={(e) => setYear(e.target.value)} aria-label="Year">
          {years.map((y) => (
            <option key={y}>{y}</option>
          ))}
        </Select>
        <div className="flex gap-1" role="group" aria-label="Report types">
          {(["IA", "VA", "TAP", "DG", "RFI"] as const).map((t) => (
            <FilterChip
              key={t}
              label={t}
              active={types.has(t)}
              onClick={() => {
                const next = new Set(types);
                if (next.has(t)) next.delete(t);
                else next.add(t);
                setTypes(next);
              }}
            />
          ))}
        </div>
        <div className="flex-1" />
        <ListMeta
          note={offline ? <OfflineNote /> : undefined}
          shown={visible.length}
          total={filtered.length}
          sort="Newest first"
          onExport={() =>
            downloadCsv(
              "reports.csv",
              ["Ref", "Type", "Title", "Owner", "State", "Created"],
              filtered.map((a) => [
                a.ref,
                a.type,
                a.title,
                a.owner ?? "",
                a.status,
                gstDate(a.createdAt),
              ]),
            )
          }
        />
      </div>

      {loading ? (
        <SkeletonRows className="p-3" />
      ) : (
      <div>
      <table className={`${T_TABLE} table-fixed bg-surface text-sm`}>
        <colgroup>
          <col className="w-48" />
          <col className="w-16" />
          <col />
          <col className="hidden w-36 @3xl:table-column" />
          <col className="w-40" />
          <col className="w-10" />
        </colgroup>
        <thead>
          <tr className={T_HEAD}>
            <th scope="col" className={T_TH}>Ref</th>
            <th scope="col" className={T_TH}>Type</th>
            <th scope="col" className={T_TH}>Title</th>
            <th scope="col" className={`${T_TH} hidden @3xl:table-cell`}>Owner</th>
            <th scope="col" className={T_TH}>State</th>
            <th className={T_TH}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 && (
            <EmptyRow colSpan={6}>
              <span className="font-medium text-ink">0 reports</span> matched
            </EmptyRow>
          )}
          {visible.map((a) => {
            const ghost = ["withdrawn", "abandoned"].includes(a.status);
            const st = ADVISORY_STATE[a.status];
            const rfiOpen = openRfi === a.ref;
            return (
              <RowGroup key={a.ref}>
                <tr
                  onClick={() =>
                    a.type === "RFI" && a.rfi
                      ? setOpenRfi(rfiOpen ? null : a.ref)
                      : router.push(`/reports/${encodeURIComponent(a.ref)}`)
                  }
                  className={`${T_ROW} cursor-pointer ${ghost ? "opacity-50" : ""} ${rfiOpen ? "bg-wash" : ""}`}
                >
                  <td className={`${T_TD} truncate whitespace-nowrap font-mono text-xs`}>
                    {a.type === "RFI" && a.rfi ? (
                      <button
                        onClick={() => setOpenRfi(rfiOpen ? null : a.ref)}
                        className="flex items-center gap-1"
                      >
                        {a.ref}
                        <IconChevronDown className={rfiOpen ? "rotate-180" : ""} />
                      </button>
                    ) : (
                      <Link
                        href={`/reports/${encodeURIComponent(a.ref)}`}
                        className="link-quiet"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {a.ref}
                      </Link>
                    )}
                  </td>
                  <td className={T_TD}>
                    <TypeBadge label={a.type} title={TYPE_TITLE[a.type] ?? a.type} />
                  </td>
                  {/* One line, with the whole title in the tooltip. */}
                  <td className={`${T_TD} max-w-0`}>
                    <Clipped
                      text={
                        ghost
                          ? `${a.title} (${a.withdrawnReason ?? a.status})`
                          : a.title
                      }
                    />
                  </td>
                  <td className={`${T_TD} hidden text-ink-2 @3xl:table-cell`}>
                    <Clipped text={a.owner ?? "-"} />
                  </td>
                  <td className={T_TD}>
                    {a.type === "RFI" && a.rfi && a.status !== "published" ? (
                      <span className="text-xs text-ink-2">
                        In progress, {a.rfi.steps.filter((s) => s.done).length} of{" "}
                        {a.rfi.steps.length} done
                      </span>
                    ) : (
                      <StatusPill tone={st.tone} label={st.label} />
                    )}
                  </td>
                  <td
                    className="px-3 py-1 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <RowActions
                      advisory={a}
                      writable={writable}
                      onView={() => router.push(`/reports/${encodeURIComponent(a.ref)}`)}
                      onEdit={() => router.push(`/reports/${encodeURIComponent(a.ref)}`)}
                      onPreview={() => setPreview(a)}
                      onDuplicate={() => duplicate(a)}
                      onExportReport={(f) =>
                        // The writers load on the click that needs them.
                        import("@/lib/report-export").then((m) =>
                          m.exportReport(a, f, () => setPreview(a)),
                        )
                      }
                      onExportTemplate={(f) =>
                        import("@/lib/report-export").then((m) =>
                          m.exportTemplate(a.type as ReportType, f, () => setPreview(a)),
                        )
                      }
                      onArchive={() => archive(a)}
                    />
                  </td>
                </tr>
                {a.type === "RFI" && rfiOpen && a.rfi && (
                  <tr className="border-b border-rule bg-inset">
                    <td colSpan={6} className="px-4 py-3">
                     <div className="reveal">
                      <p className="text-xs text-mute">
                        {a.rfi.requester} · due {gstDate(a.rfi.dueAt)} ·{" "}
                        {clients.find((c) => c.id === a.rfi?.clientId)?.name ?? a.rfi?.clientId}
                      </p>
                      <p className="mt-1 text-sm">{a.rfi.question}</p>{a.caseId && <Link href={`/investigations/${a.caseId}`} className="link-quiet mt-2 inline-block text-xs">Open investigation</Link>}
                      <ul className="mt-2 space-y-1">
                        {a.rfi.steps.map((s) => (
                          <li key={s.label} className="flex items-center gap-2 text-xs">
                            <span
                              className={`flex h-4 w-4 items-center justify-center ${s.done ? "bg-cpx-green-800 text-white" : "border border-rule-strong bg-surface"}`}
                            >
                              {s.done && <IconCheck />}
                            </span>
                            <span className="">{s.label}</span>
                            {s.investigationId && (
                              <Link
                                href={`/intelligence/${s.investigationId}`}
                                className="link-quiet"
                              >
                                Conversation
                              </Link>
                            )}
                          </li>
                        ))}
                      </ul>
                     </div>
                    </td>
                  </tr>
                )}
              </RowGroup>
            );
          })}
        </tbody>
      </table>
      </div>
      )}
      {filtered.length > shown && (
        <div className="flex justify-center border-t border-rule px-3 py-2">
          <Button size="sm" onClick={() => setShown(shown + 50)}>
            Show 50 more
          </Button>
        </div>
      )}
      </div>
      </Panel>

      {showNew && (
        <NewReportDialog
          onClose={() => setShowNew(false)}
          onStartInvestigation={() => { setShowNew(false); router.push("/investigations/new"); }}
          onCreateReport={async (type, title, choice) => {
            // The template was chosen and previewed a step earlier; the sections
            // come from whichever one it was, standard or uploaded.
            const created = await createReport(user.id, {
              type: type as "IA" | "VA" | "DG" | "TAP",
              title,
              sections: sectionsFrom(choice.sections),
              template: { kind: choice.kind, name: choice.name },
            });
            setApiRows((r) => [created, ...r]);
            setShowNew(false);
            router.push(`/reports/${encodeURIComponent(created.ref)}`);
          }}
        />
      )}

      {preview && (
        <ReportPreview
          advisory={preview}
          onClose={() => setPreview(null)}
          onPrint={() => window.print()}
        />
      )}

      {notice && (
        <div
          role="status"
          className="pop fixed bottom-4 left-1/2 z-50 flex origin-bottom -translate-x-1/2 items-center gap-3 rounded-sm border border-rule bg-overlay px-3 py-2 text-sm shadow-pop"
        >
          {notice}
          <Button variant="ghost" size="sm" onClick={() => setNotice(null)}>
            Dismiss
          </Button>
        </div>
      )}
    </Page>
  );
}

function RowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

