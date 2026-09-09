"use client";

// The document is the page. No side panels, no agent narration.
// Checks are one line. Blocking checks disable Approve and name themselves.

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useConsoleUser } from "@/lib/role-context";
import { assembleAdvisory, canApprove, canSee, canWriteReports } from "@/lib/access";
import { advisoryByRef } from "@/lib/fixtures";
import { changeReport, getDashboardData, getReport, sendBackReport, isUnreachable } from "@/lib/api";
import type { Advisory, Client, Delivery, SendBackReason } from "@/lib/types";
import { resolveTechnique, TACTICS } from "@/lib/mitre";
import { gstDate, gstDateTime, recordCount } from "@/lib/format";
import { IndicatorChip, TlpBadge, Button, Dialog, buttonClass, OfflineNote, SkeletonRows } from "@/components/ui";
import { Menu } from "@/components/reports/ExportMenu";
import { ReportPreview } from "@/components/reports/ReportPreview";
import { DiamondPanel } from "@/components/reports/DiamondPanel";
import {
  FORMAT_LABEL,
  exportReport,
  formatsFor,
  type ReportFormat,
} from "@/lib/report-export";
import { templateFor } from "@/lib/report-templates";
import { IconCheck, IconWarn } from "@/components/icons";
import {
  T_FLUSH,
  T_HEAD,
  T_NUM,
  T_ROW,
  T_TABLE,
  T_TD,
  T_TH,
} from "@/components/table";

// Same four words the list uses, so a state reads identically in both places.
const STATE_LABEL: Record<Advisory["status"], string> = {
  draft: "Draft",
  "in-review": "In review",
  published: "Published",
  superseded: "Superseded",
  withdrawn: "Withdrawn",
  abandoned: "Abandoned",
  retracted: "Retracted",
  "did-not-run": "Did not run",
  archived: "Archived",
};

const SEND_BACK_REASONS: { key: SendBackReason; label: string }[] = [
  { key: "mitre-validation-failed", label: "MITRE validation failed" },
  { key: "kql-validation-failed", label: "KQL validation failed" },
  { key: "cvss-conflict-unresolved", label: "CVSS conflict unresolved" },
  { key: "factual-correction", label: "Factual correction" },
  { key: "missing-citation", label: "Missing citation" },
  { key: "house-style", label: "House style" },
];

export default function ReportPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = use(params);
  const { user } = useConsoleUser();
  const decoded = decodeURIComponent(ref);
  const [base, setBase] = useState<Advisory | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [local, setLocal] = useState<Advisory | null>(null);
  const [showSendBack, setShowSendBack] = useState(false);
  // Preview is not a view of its own any more: it is the markup a PDF export
  // prints, which is what keeps the exported file and the screen identical.
  const [preview, setPreview] = useState(false);
  const [sent, setSent] = useState<Delivery[]>([]);
  // /clients is lead-analyst only; /dashboard carries the names every role may see.
  const [clients, setClients] = useState<Client[]>([]);

  useEffect(() => {
    getReport(user.id, decoded)
      .then(({ advisory, deliveries }) => {
        setBase(advisory);
        setSent(deliveries);
        setOffline(false);
      })
      .catch((e) => {
        setBase(advisoryByRef(decoded) ?? null);
        setOffline(isUnreachable(e));
      })
      .finally(() => setLoading(false));
    getDashboardData(user.id).then((d) => setClients(d.clients)).catch(() => setClients([]));
  }, [user.id, decoded]);

  const assembled = useMemo(() => {
    const src = local ?? base;
    if (!src) return null;
    return assembleAdvisory(src, user);
  }, [base, local, user]);

  if (!canSee(user.role, "reports")) {
    return (
      <Center>
        <p className="text-base">Not permitted at this access level.</p>
        <Link href="/" className="text-sm text-link underline underline-offset-2">
          Dashboard
        </Link>
      </Center>
    );
  }

  if (loading && !base) {
    return (
      <div className="mx-auto max-w-[720px] px-6 py-8">
        <SkeletonRows rows={8} />
      </div>
    );
  }

  if (!base || !assembled) {
    return (
      <Center>
        <p className="text-base">No report with this reference.</p>
        <Link href="/reports" className="text-sm text-link underline underline-offset-2">
          Reports
        </Link>
      </Center>
    );
  }

  const a = assembled;
  const canEdit =
    canWriteReports(user.role) && (a.status === "draft" || a.status === "in-review");
  // Whoever may edit this report edits it in place. There is no reading mode
  // to step out of: the status already says whether it can be changed.
  const editable = canEdit;
  const lead = canApprove(user.role);
  const failedChecks = a.checks.filter((c) => !c.passed);
  const blockingFailed = failedChecks.filter((c) => c.blocking);
  // The backend already scopes this; the second filter is belt and braces.
  const deliveries = sent.filter(
    (d) => user.clientScope === "all" || user.clientScope.includes(d.clientId),
  );
  const isDigest = a.type === "DG";
  const template = templateFor(a.type);
  // There is no updatedAt on an advisory, so the latest thing that actually
  // happened to it is the honest answer rather than an invented field.
  const lastUpdated =
    [a.publishedAt, a.approvedAt, ...a.sendBacks.map((b) => b.at), a.createdAt]
      .filter((d): d is string => Boolean(d))
      .sort()
      .at(-1) ?? a.createdAt;
  const publishedState = ["published", "superseded", "retracted"].includes(a.status);

  const update = async (fn: (d: Advisory) => Advisory, action?: "submit" | "approve") => {
    const next = fn(local ?? base);
    if (action) await changeReport(user.id, next.ref, action);
    setLocal(next);
  };

  if (a.type === "RFI") {
    return <RfiView a={a} clients={clients} />;
  }

  return (
    <div className="pb-24">
      {/* One row that never wraps. Identity on the left, actions pinned right,
          and the metadata between them drops out in order of how much it is
          needed as the window narrows. Every item is nowrap and shrink-0:
          without that a flex child compresses below its text and wraps inside
          itself, which is what turned this bar into six stacked fragments. */}
      <div className="sticky top-[60px] z-20 flex h-14 items-center gap-2 border-b border-cpx-grey-100 bg-white px-6">
        <span className="shrink-0 whitespace-nowrap font-mono text-sm font-medium">
          {a.ref}
        </span>
        <span className="shrink-0">
          <TlpBadge tlp={a.tlp} />
        </span>
        {/* Report type, stated. Which format a document follows is the first
            thing a reviewer needs and it was only implicit in the reference. */}
        <span
          className="shrink-0 bg-cpx-grey-50 px-1.5 py-0.5 text-2xs"
          title={template?.name}
        >
          {a.type}
        </span>
        <span className="shrink-0 whitespace-nowrap text-xs text-cpx-grey-500">
          v{a.version}
        </span>
        <span className="shrink-0 whitespace-nowrap text-xs">
          {STATE_LABEL[a.status]}
        </span>
        {offline && (
          <span className="shrink-0">
            <OfflineNote />
          </span>
        )}

        {/* Everything from here is context rather than identity, so it gives way
            first. The full value stays on the title attribute. */}
        <span className="hidden min-w-0 items-center gap-2 xl:flex">
          {a.pirRefs.map((p) => (
            <span key={p} className="shrink-0 bg-cpx-grey-50 px-1.5 py-0.5 text-2xs">
              {p}
            </span>
          ))}
        </span>
        <span
          className="hidden shrink-0 truncate whitespace-nowrap text-xs text-cpx-grey-500 lg:inline"
          title={`Owner: ${a.owner ?? "unassigned"}`}
        >
          {a.owner ?? "-"}
        </span>
        <span
          className="hidden shrink-0 whitespace-nowrap text-xs text-cpx-grey-500 2xl:inline"
          title={`Last updated ${gstDateTime(lastUpdated)}`}
        >
          {gstDate(lastUpdated)}
        </span>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Menu<ReportFormat>
            label="Export report"
            items={formatsFor(a).map((f) => ({
              key: f,
              label: FORMAT_LABEL[f],
              hint: f === "pdf" ? "Opens the print dialogue" : undefined,
            }))}
            onSelect={(f) => exportReport(a, f, () => setPreview(true))}
            footer="Indicators leave defanged. An unsafe citation URL never leaves."
          />
        </div>
      </div>

      {preview && (
        <ReportPreview
          advisory={a}
          onClose={() => setPreview(false)}
          onPrint={() => window.print()}
        />
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-cpx-grey-100 bg-white px-6 py-1.5 text-2xs text-cpx-grey-500">
        <span>
          Report type <span className="text-cpx-black">{a.type}</span>
          {template && <> · {template.name}</>}
        </span>
        <span>
          Template{" "}
          <span className="text-cpx-black">
            {a.template
              ? a.template.kind === "standard"
                ? "Standard template"
                : a.template.name
              : "Standard template"}
          </span>
          {a.template?.kind === "custom" && <> · custom</>}
        </span>
        <span>
          Sections <span className="text-cpx-black">{a.sections.length}</span>
        </span>
      </div>

      <ChecksLine advisory={a} />

      {publishedState && (
        <div className="mx-auto mt-4 max-w-[720px] space-y-1 px-6">
          <div className="flex items-center gap-2 bg-cpx-purple px-3 py-2 text-xs text-white">
            <span className="font-medium">Version {a.version}</span>
            <span className="text-white/70">
              Published {a.publishedAt ? gstDateTime(a.publishedAt) : ""}
            </span>
            {a.status === "retracted" && <span className="bg-cpx-red px-1.5">Retracted</span>}
          </div>
          {a.supersededBy && (
            <p className="bg-status-warn-fill px-3 py-1.5 text-xs text-status-warn-ink">
              Superseded by{" "}
              <Link
                href={`/reports/${encodeURIComponent(a.supersededBy)}`}
                className="underline underline-offset-2"
              >
                {a.supersededBy}
              </Link>
              .
            </p>
          )}
        </div>
      )}

      {a.status === "did-not-run" && (
        <div className="mx-auto mt-4 max-w-[720px] px-6">
          <p className="bg-cpx-red px-3 py-2 text-xs text-white">Did not run.</p>
        </div>
      )}

      <article className="mx-auto max-w-[720px] px-6 py-8">
        <h1 className="text-xl font-semibold leading-snug tracking-tightish">
          {a.title}
        </h1>

        <div className="mt-6 space-y-7">
          {a.sections.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-32">
              <h2 className="border-b border-cpx-grey-100 pb-1 text-md font-semibold tracking-tightish">
                {s.heading}
              </h2>
              {s.heading === "TTPs Mapping" || s.heading === "MITRE ATT&CK Mapping" ? (
                <>
                  <p className="mt-2 text-sm leading-relaxed">{s.body}</p>
                  <TechniquesTable a={a} editable={editable} update={update} />
                </>
              ) : s.heading === "Diamond Model Analysis" ? (
                <>
                  <p className="mt-2 text-sm leading-relaxed">{s.body}</p>
                  <DiamondPanel advisory={a} editable={editable} update={update} />
                </>
              ) : s.heading === "CVSS v3 Base Score" ? (
                <>
                  <p className="mt-2 text-sm leading-relaxed">{s.body}</p>
                  <CvssTable a={a} editable={editable} update={update} />
                </>
              ) : s.heading === "Indicators" ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {s.body.includes("withheld at this access level") ? (
                    <p className="text-sm">{s.body}</p>
                  ) : (
                    s.body
                      .split("\n")
                      .filter(Boolean)
                      .map((v, j) => <IndicatorChip key={`${j}-${v}`} value={v.trim()} />)
                  )}
                </div>
              ) : editable ? (
                <textarea
                  defaultValue={s.body}
                  onBlur={(e) =>
                    update((d) => ({
                      ...d,
                      sections: d.sections.map((x) =>
                        x.id === s.id ? { ...x, body: e.target.value } : x,
                      ),
                    }))
                  }
                  rows={Math.max(2, Math.ceil(s.body.length / 90))}
                  className="mt-2 w-full resize-y border border-transparent bg-transparent text-sm leading-relaxed hover:border-cpx-grey-100 focus:border-cpx-grey-100 focus:bg-white focus:outline-none"
                />
              ) : (
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">
                  {s.body}
                </p>
              )}
              {s.citations.length > 0 && (
                <p className="mt-1.5 text-2xs text-cpx-grey-500">
                  {s.citations
                    .map((c) => `[${c.ref}] ${c.label}, ${recordCount(c.recordCount)}`)
                    .join(" · ")}
                </p>
              )}
            </section>
          ))}
        </div>

        {a.sections.length > 0 && <SourcesSection a={a} />}

        {publishedState && (
          <section className="mt-10">
            <h2 className="border-b border-cpx-grey-100 pb-1 text-md font-semibold tracking-tightish">
              Delivery
            </h2>
            <p className="mt-2 text-xs">
              <span className="font-medium">{deliveries.length} deliveries</span>
            </p>
            <ul className="mt-1 space-y-1">
              {deliveries.map((d, i) => (
                <li key={i} className="text-xs">
                  {clients.find((c) => c.id === d.clientId)?.name ?? d.clientId} · v
                  {d.advisoryVersion} · {d.channel} · {d.format.toUpperCase()} ·{" "}
                  {gstDateTime(d.sentAt)}
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>

      {!isDigest && (lead || (publishedState && editable === false && canWriteReports(user.role))) && (
        <footer className="fixed bottom-0 left-16 right-0 z-20 flex h-14 items-center gap-2 border-t border-cpx-grey-100 bg-white px-6 rail:left-44">
          {publishedState ? (
            <button
                onClick={() =>
                update((d) => ({ ...d, status: "draft", version: d.version + 1 }))
              }
              className={buttonClass()}
            >
              Issue an update
            </button>
          ) : lead && (a.status === "in-review" || a.status === "draft") ? (
            <>
              <button
                disabled={blockingFailed.length > 0}
                onClick={() =>
                  update((d) => ({
                    ...d,
                    status: "published",
                    publishedAt: "2026-08-02T04:15:00Z",
                    approvedAt: "2026-08-02T04:15:00Z",
                    approvedBy: user.name,
                  }), "approve")
                }
                title={blockingFailed.map((c) => c.label).join("; ")}
                className={buttonClass("primary")}
              >
                Approve & publish
              </button>
              <button
                onClick={() => setShowSendBack(true)}
                className={buttonClass()}
              >
                Send back
              </button>
              <button
                disabled={blockingFailed.length === 0}
                onClick={() =>
                  update((d) => ({
                    ...d,
                    status: "published",
                    publishedAt: "2026-08-02T04:15:00Z",
                    approvedAt: "2026-08-02T04:15:00Z",
                    approvedBy: user.name,
                  }))
                }
                className={buttonClass("danger")}
              >
                Override
              </button>
            </>
          ) : null}
        </footer>
      )}

      {showSendBack && (
        <Dialog title="Send back" onClose={() => setShowSendBack(false)} className="max-w-sm">
            <ul className="space-y-1">
              {SEND_BACK_REASONS.map((r) => (
                <li key={r.key}>
                  <button
                    onClick={() => {
                      sendBackReport(user.id, a.ref, r.key).then(() => update((d) => ({
                        ...d,
                        status: "draft",
                        sendBacks: [
                          ...d.sendBacks,
                          { at: "2026-08-02T04:15:00Z", by: user.name, reason: r.key },
                        ],
                      })));
                      setShowSendBack(false);
                    }}
                    className="w-full border border-cpx-grey-100 px-3 py-2 text-left text-sm hover:border-cpx-green"
                  >
                    {r.label}
                  </button>
                </li>
              ))}
            </ul>
            <Button onClick={() => setShowSendBack(false)} className="mt-3 w-full">
              Cancel
            </Button>
        </Dialog>
      )}
    </div>
  );
}

// The advisory's answer to "what did I prepare this from": every cited
// source rolled up with the sections it fed and its snapshot stamp, then
// the sections whose content is declared derivation rather than citation.
function SourcesSection({ a }: { a: Advisory }) {
  const byLabel = new Map<
    string,
    { records: number; sections: string[]; snapshotAt?: string }
  >();
  for (const sec of a.sections) {
    for (const c of sec.citations) {
      const e = byLabel.get(c.label) ?? { records: 0, sections: [] };
      e.records += c.recordCount;
      if (!e.sections.includes(sec.heading)) e.sections.push(sec.heading);
      if (c.snapshotAt && !e.snapshotAt) e.snapshotAt = c.snapshotAt;
      byLabel.set(c.label, e);
    }
  }
  const rows = [...byLabel.entries()];
  const derived = a.sections.filter(
    (s) => s.citations.length === 0 && s.derivedFrom,
  );
  const DERIVED_LABEL: Record<string, string> = {
    template: "Template",
    validator: "Validator",
    "model-knowledge": "Model knowledge",
    citation: "Citation",
  };

  return (
    <section className="mt-10">
      <h2 className="border-b border-cpx-grey-100 pb-1 text-md font-semibold tracking-tightish">
        Sources
      </h2>
      <p className="mt-2 text-xs">
        <span className="font-medium">{rows.length} sources</span>
      </p>
      {rows.length > 0 && (
        <div className="mt-2 overflow-x-auto">
          <table className={`${T_TABLE} min-w-[32rem] text-xs`}>
            <colgroup>
              <col className="w-56" />
              <col className="w-28" />
              <col />
              <col className="w-44" />
            </colgroup>
            <thead>
              <tr className={T_HEAD}>
                <th scope="col" className={`${T_TH} ${T_FLUSH}`}>Source</th>
                <th scope="col" className={`${T_TH} ${T_FLUSH} ${T_NUM}`}>
                  Records cited
                </th>
                <th scope="col" className={`${T_TH} ${T_FLUSH}`}>Sections</th>
                <th scope="col" className={`${T_TH} ${T_FLUSH}`}>Snapshot</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, e]) => (
                <tr key={label} className={T_ROW}>
                  <td className={`${T_TD} ${T_FLUSH} font-medium`}>{label}</td>
                  <td className={`${T_TD} ${T_FLUSH} ${T_NUM} font-medium`}>
                    {e.records}
                  </td>
                  <td className={`${T_TD} ${T_FLUSH}`}>
                    {e.sections.join(", ")}
                  </td>
                  <td className={`${T_TD} ${T_FLUSH} whitespace-nowrap`}>
                    {e.snapshotAt ? gstDateTime(e.snapshotAt) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {derived.length > 0 && (
        <ul className="mt-3 space-y-1">
          {derived.map((s) => (
            <li key={s.id} className="text-xs">
              {s.heading} ·{" "}
              <span className="font-medium">
                {DERIVED_LABEL[s.derivedFrom ?? ""] ?? s.derivedFrom}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
      {children}
    </div>
  );
}

// Clean: one line. Defective: each failed check anchors into the offending block.
function ChecksLine({ advisory: a }: { advisory: Advisory }) {
  const failed = a.checks.filter((c) => !c.passed);
  if (a.checks.length === 0) return null;
  if (failed.length === 0) {
    return (
      <div className="flex items-center gap-2 border-b border-cpx-grey-100 bg-white px-6 py-2 text-xs">
        <IconCheck className="text-green-contrast" />
        All checks passed.
      </div>
    );
  }
  const blocking = failed.filter((c) => c.blocking).length;
  return (
    // One line, not one line per check. Every check is unpassed on a new draft,
    // and three stacked red rows read as a fault rather than as the ordinary
    // starting state of a document nobody has written yet.
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-cpx-grey-100 bg-white px-6 py-2 text-xs">
      <IconWarn className={blocking > 0 ? "text-cpx-red" : "text-status-warn-ink"} />
      <span className="whitespace-nowrap">
        <span className="font-medium">
          {failed.length} of {a.checks.length}
        </span>{" "}
        checks not passed
        {blocking > 0 && (
          <span className="text-cpx-grey-500">, {blocking} blocking</span>
        )}
      </span>
      <span className="text-cpx-grey-500">·</span>
      {failed.map((c, i) => (
        <span key={c.id} className="text-cpx-grey-500">
          {c.anchorSectionId ? (
            <a href={`#${c.anchorSectionId}`} className="underline underline-offset-2">
              {c.label}
            </a>
          ) : (
            c.label
          )}
          {i < failed.length - 1 && <span className="ml-2">·</span>}
        </span>
      ))}
    </div>
  );
}

function TechniquesTable({
  a,
  editable,
  update,
}: {
  a: Advisory;
  editable: boolean;
  update: (fn: (d: Advisory) => Advisory) => void;
}) {
  const [newId, setNewId] = useState("");
  const resolved = resolveTechnique(newId);
  return (
    <div className="mt-3">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-cpx-grey-100 text-left">
            <th className="py-1.5 pr-3 font-medium">Tactic</th>
            <th className="py-1.5 pr-3 font-medium">Technique</th>
            <th className="py-1.5 pr-3 font-medium">Name</th>
            <th className="py-1.5 font-medium">Observed activity</th>
          </tr>
        </thead>
        <tbody>
          {a.techniques.map((t) => (
            <tr key={t.techniqueId} className="border-b border-cpx-grey-100">
              <td className="py-1.5 pr-3">
                {t.tacticId} {TACTICS[t.tacticId]}
              </td>
              <td className="py-1.5 pr-3 font-mono text-xs">{t.techniqueId}</td>
              <td className="py-1.5 pr-3">{t.techniqueName}</td>
              <td className="py-1.5">{t.observedActivity}</td>
            </tr>
          ))}
          {a.techniques.length === 0 && (
            <tr>
              <td colSpan={4} className="py-2">
                <span className="font-medium">0 techniques</span>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {editable && (
        <div className="mt-2 flex items-center gap-2">
          <input
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            placeholder="Technique ID"
            className="h-8 w-36 border border-cpx-grey-100 px-2 font-mono text-xs focus:border-cpx-green focus:outline-none"
          />
          <span className="text-xs text-cpx-grey-500">
            {newId.trim() === ""
              ? ""
              : resolved
                ? `${resolved.name} · ${resolved.tactics.map((t) => TACTICS[t]).join(", ")}`
                : "Unknown technique ID"}
          </span>
          <button
            disabled={!resolved}
            onClick={() => {
              if (!resolved) return;
              const id = newId.trim().toUpperCase();
              if (a.techniques.some((t) => t.techniqueId === id)) {
                setNewId("");
                return;
              }
              update((d) => ({
                ...d,
                techniques: [
                  ...d.techniques,
                  {
                    tacticId: resolved.tactics[0],
                    techniqueId: newId.trim().toUpperCase(),
                    techniqueName: resolved.name,
                    resolved: true,
                    observedActivity: "",
                  },
                ],
              }));
              setNewId("");
            }}
            className={buttonClass("secondary", "sm")}
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}

function CvssTable({
  a,
  editable,
  update,
}: {
  a: Advisory;
  editable: boolean;
  update: (fn: (d: Advisory) => Advisory) => void;
}) {
  const [cve, setCve] = useState("");
  const [score, setScore] = useState("");
  const [source, setSource] = useState("");
  const valid =
    /^CVE-\d{4}-\d{4,}$/i.test(cve.trim()) &&
    !Number.isNaN(parseFloat(score)) &&
    parseFloat(score) >= 0 &&
    parseFloat(score) <= 10 &&
    source.trim() !== "";
  return (
    <div className="mt-3">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-cpx-grey-100 text-left">
            <th className="py-1.5 pr-3 font-medium">CVE</th>
            <th className="py-1.5 pr-3 font-medium">Score</th>
            <th className="py-1.5 pr-3 font-medium">Authority</th>
            <th className="py-1.5 font-medium">Class</th>
          </tr>
        </thead>
        <tbody>
          {a.cvss.map((c, i) => (
            <tr key={i} className="border-b border-cpx-grey-100">
              <td className="py-1.5 pr-3 font-mono text-xs">{c.cveId}</td>
              <td className="py-1.5 pr-3 font-medium">{c.value.toFixed(1)}</td>
              <td className="py-1.5 pr-3">{c.source}</td>
              <td className="py-1.5 uppercase">{c.authorityClass}</td>
            </tr>
          ))}
          {a.cvss.length === 0 && (
            <tr>
              <td colSpan={4} className="py-2">
                <span className="font-medium">0 scores</span>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {editable && (
        <div className="mt-2 flex items-center gap-2">
          <input
            value={cve}
            onChange={(e) => setCve(e.target.value)}
            placeholder="CVE ID"
            className="h-8 w-40 border border-cpx-grey-100 px-2 font-mono text-xs focus:border-cpx-green focus:outline-none"
          />
          <input
            value={score}
            onChange={(e) => setScore(e.target.value)}
            placeholder="Score"
            className="h-8 w-20 border border-cpx-grey-100 px-2 text-xs focus:border-cpx-green focus:outline-none"
          />
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Authority"
            className="h-8 w-36 border border-cpx-grey-100 px-2 text-xs focus:border-cpx-green focus:outline-none"
          />
          <button
            disabled={!valid}
            onClick={() => {
              update((d) => ({
                ...d,
                cvss: [
                  ...d.cvss,
                  {
                    cveId: cve.trim().toUpperCase(),
                    value: parseFloat(score),
                    source: source.trim(),
                    authorityClass: "vendor",
                    assessedAt: "2026-08-02T04:15:00Z",
                  },
                ],
              }));
              setCve("");
              setScore("");
              setSource("");
            }}
            className={buttonClass("secondary", "sm")}
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}

function RfiView({ a, clients }: { a: Advisory; clients: Client[] }) {
  if (!a.rfi) return null;
  return (
    <article className="mx-auto max-w-[720px] px-6 py-8">
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm font-medium">{a.ref}</span>
        <span className="bg-cpx-grey-50 px-1.5 py-0.5 text-2xs">RFI</span>
      </div>
      <h1 className="mt-3 text-xl font-semibold leading-snug tracking-tightish">
        {a.rfi.question}
      </h1>
      <p className="mt-2 text-xs text-cpx-grey-500">
        {a.rfi.requester} · due {gstDateTime(a.rfi.dueAt)} ·{" "}
        {clients.find((c) => c.id === a.rfi?.clientId)?.name ?? a.rfi?.clientId}
      </p>
      <ul className="mt-6 space-y-2">
        {a.rfi.steps.map((s) => (
          <li key={s.label} className="flex items-center gap-2.5 text-sm">
            <span
              className={`flex h-5 w-5 items-center justify-center text-2xs ${s.done ? "bg-green-contrast text-white" : "border border-cpx-grey-100"}`}
            >
              {s.done ? "✓" : ""}
            </span>
            <span className="">{s.label}</span>
            {s.investigationId && (
              <Link
                href={`/intelligence/${s.investigationId}`}
                className="text-xs text-link underline underline-offset-2"
              >
                Conversation
              </Link>
            )}
          </li>
        ))}
      </ul>
    </article>
  );
}
