"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useConsoleUser } from "@/lib/role-context";
import { canSee, canWriteReports } from "@/lib/access";
import { caseAction, getCase, getEvidence, updateCase, downloadEvidence, workspaceRequest } from "@/lib/workspace-api";
import type { CaseDetail, CaseStatus, EvidenceFile, CaseContribution, CaseOptions } from "@/lib/workspace-types";
import { gstDateTime } from "@/lib/format";
import { defang } from "@/lib/defang";
import { userName } from "@/lib/users";
import { ADVISORY_STATE, CASE_STATE, FILE_STATE, statusLabel, statusTone } from "@/lib/status";
import {
  Banner,
  Button,
  CenterMessage,
  Dialog,
  EmptyState,
  IndicatorChip,
  NotPermitted,
  Page,
  PageHeader,
  Panel,
  PriorityBadge,
  SkeletonPanel,
  StatusPill,
  Tabs,
  tabPanelProps,
} from "@/components/ui";
import { IconChevronDown, IconChevronLeft } from "@/components/icons";
import { EvidenceUploader, evidencePending } from "@/components/evidence/EvidenceUploader";
import { fieldClass, SpecialistPicker, SourcePicker, SPECIALISTS } from "@/components/investigations/CaseForm";
import type { Advisory } from "@/lib/types";

type Area = "overview" | "agents" | "findings" | "report";
const display = (value: unknown): string => (typeof value === "string" ? value : JSON.stringify(value));

function Back() {
  return (
    <Link
      href="/investigations"
      className="group/b mb-2 inline-flex items-center gap-0.5 text-xs text-mute transition-colors duration-150 hover:text-accent"
    >
      <IconChevronLeft className="transition-transform duration-150 group-hover/b:-translate-x-0.5" />
      Investigations
    </Link>
  );
}

export default function InvestigationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useConsoleUser();
  const [data, setData] = useState<CaseDetail | null>(null);
  const [area, setArea] = useState<Area>("overview");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [note, setNote] = useState("");
  const [specialists, setSpecialists] = useState<string[]>([]);
  const [files, setFiles] = useState<EvidenceFile[]>([]);
  const [uploads, setUploads] = useState<EvidenceFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [options, setOptions] = useState<CaseOptions | null>(null);
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[] | null>(null);
  const [reviewAction, setReviewAction] = useState<{ step: CaseContribution; action: "exclude" | "rerun" } | null>(null);
  const [reason, setReason] = useState("");

  const refresh = useCallback(async () => {
    const next = await getCase(user.id, id);
    setData(next);
    setTitle(next.case.title);
    setObjective(next.case.objective);
    setSpecialists(next.case.specialists);
    setSelectedSourceIds(next.case.selectedSourceIds ?? null);
    const result = await Promise.allSettled(next.case.evidenceIds.map((fileId) => getEvidence(user.id, fileId)));
    setFiles(result.flatMap((r) => (r.status === "fulfilled" ? [r.value] : [])));
    return next;
  }, [id, user.id]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setData(null);
    refresh()
      .catch((e: Error) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [refresh]);
  useEffect(() => {
    let active = true;
    workspaceRequest<CaseOptions>(user.id, "/investigations/options")
      .then((value) => {
        if (active) setOptions(value);
      })
      .catch((cause: Error) => {
        if (active) setError(cause.message);
      });
    return () => {
      active = false;
    };
  }, [user.id]);
  const running = data?.runs.some((run) => ["running", "queued", "pending"].includes(run.status ?? "")) ?? false;
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      getCase(user.id, id)
        .then(setData)
        .catch(() => undefined);
    }, 2000);
    return () => clearInterval(timer);
  }, [running, id, user.id]);

  if (!canSee(user.role, "investigations")) return <NotPermitted />;
  if (loading)
    return (
      <Page band>
        <Back />
        <div className="mb-3 h-7 w-80 bg-fill" />
        <div className="grid gap-3 @4xl/page:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
          <SkeletonPanel rows={6} />
          <SkeletonPanel rows={5} />
        </div>
      </Page>
    );
  if (!data)
    return (
      <Page band>
        <Back />
        <CenterMessage
          action={
            <Button
              onClick={() => {
                setError(null);
                void refresh().catch((e: Error) => setError(e.message));
              }}
            >
              Retry
            </Button>
          }
        >
          <span role="alert">{error ?? "Investigation not found."}</span>
        </CenterMessage>
      </Page>
    );

  const current = data.case;
  const readonly = ["completed", "archived"].includes(current.status);
  const included = data.contributions.filter((c) => !c.excluded);
  const state = CASE_STATE[current.status];
  const findingsCount = included.reduce((n, s) => n + s.findings.length, 0);
  async function action(operation: () => Promise<unknown>, success?: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await operation();
      await refresh();
      if (success) setNotice(success);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const post = (path: string, body: Record<string, unknown> = {}) =>
    caseAction(user.id, id, path, { expectedRevision: current.revision, ...body });
  const label = "block text-xs font-medium text-ink-2";

  return (
    <Page band>
      <Back />
      <PageHeader
        title={current.title}
        meta={
          <span className="flex shrink-0 items-center gap-1.5">
            <StatusPill tone={state.tone} label={state.label} />
            <PriorityBadge level={current.priority} />
          </span>
        }
        action={
          <Button
            variant="primary"
            disabled={busy || readonly || running || !specialists.length || selectedSourceIds?.length === 0}
            onClick={() => void action(() => post("run", { specialists, selectedSourceIds }), "Investigation run started.")}
          >
            {running ? "Running" : busy ? "Working" : "Run investigation"}
          </Button>
        }
      />
      <p className="-mt-2 mb-3 font-mono text-2xs text-mute">
        {current.id} <span className="font-sans">· Revision {current.revision} · Updated {gstDateTime(current.updatedAt)}</span>
      </p>
      {error && (
        <Banner className="mb-3" action={<Button size="sm" onClick={() => void action(refresh)}>Refresh case</Button>}>
          {error}
        </Banner>
      )}
      {notice && (
        <Banner tone="info" className="mb-3">
          {notice}
        </Banner>
      )}
      <Tabs<Area>
        id="case"
        label="Investigation areas"
        value={area}
        onChange={setArea}
        className="mb-3"
        tabs={[
          { key: "overview", label: "Overview" },
          { key: "agents", label: "Agents and evidence" },
          { key: "findings", label: "Findings and pivots" },
          { key: "report", label: "Report" },
        ]}
      />

      <div {...tabPanelProps("case", area)}>
        {area === "overview" && (
          <div className="grid items-start gap-3 @4xl/page:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
            <div className="grid gap-3">
              <Panel title="Case" enter={0} bodyClassName="space-y-3">
                <label className={label}>
                  Title
                  <input className={fieldClass} value={title} disabled={readonly} onChange={(e) => setTitle(e.target.value)} />
                </label>
                <label className={label}>
                  Objective
                  <textarea className={fieldClass} rows={4} value={objective} disabled={readonly} onChange={(e) => setObjective(e.target.value)} />
                </label>
                <Button
                  disabled={
                    busy ||
                    readonly ||
                    !title.trim() ||
                    !objective.trim() ||
                    (title === current.title && objective === current.objective)
                  }
                  onClick={() =>
                    void action(
                      () =>
                        updateCase(user.id, id, {
                          title: title.trim(),
                          objective: objective.trim(),
                          expectedRevision: current.revision,
                        }),
                      "Changes saved.",
                    )
                  }
                >
                  Save changes
                </Button>
              </Panel>
              <Panel title="Starting entities" count={current.entities.length} enter={1}>
                <div className="flex flex-wrap gap-2">
                  {current.entities.map((entity, i) => (
                    <span
                      key={`${entity.value}-${i}`}
                      className="flex items-center gap-2 rounded-sm border border-rule px-2 py-1 text-xs"
                    >
                      <span className="text-mute">{entity.type}</span>
                      <IndicatorChip value={entity.value} />
                    </span>
                  ))}
                  {!current.entities.length && <p className="text-sm text-mute">0 starting entities.</p>}
                </div>
              </Panel>
              <Panel title="Analyst notes" count={current.notes.length} enter={2}>
                <ul className="space-y-3">
                  {current.notes.map((item) => (
                    <li key={item.id} className="border-l-2 border-cpx-green pl-3">
                      <p className="whitespace-pre-wrap text-sm">{item.text}</p>
                      <p className="mt-1 text-2xs text-mute">
                        {userName(item.by)} · {gstDateTime(item.at)}
                      </p>
                    </li>
                  ))}
                </ul>
                {!current.notes.length && <p className="text-sm text-mute">0 notes.</p>}
                <label className={`${label} mt-3`}>
                  Add a note
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} disabled={readonly} rows={3} className={fieldClass} />
                </label>
                <Button
                  className="mt-2"
                  disabled={busy || readonly || !note.trim()}
                  onClick={() =>
                    void action(async () => {
                      await post("notes", { text: note.trim() });
                      setNote("");
                    })
                  }
                >
                  Save note
                </Button>
              </Panel>
            </div>
            <div className="grid gap-3">
              <Panel title="Details" enter={1}>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                  <dt className="text-mute">Client</dt>
                  <dd className="font-mono text-xs leading-5">{current.clientId ?? "Global"}</dd>
                  <dt className="text-mute">Assigned to</dt>
                  <dd>{userName(current.assignedTo ?? current.createdBy)}</dd>
                  <dt className="text-mute">Priority</dt>
                  <dd>
                    <PriorityBadge level={current.priority} />
                  </dd>
                  <dt className="text-mute">Workflow</dt>
                  <dd className="font-mono text-xs leading-5">{current.workflowRef}</dd>
                  <dt className="text-mute">Evidence files</dt>
                  <dd className="tabular-nums">{current.evidenceIds.length}</dd>
                </dl>
              </Panel>
              <Panel title="Run settings" enter={2} bodyClassName="space-y-4">
                <label className={label}>
                  Assignment
                  <select
                    className={fieldClass}
                    value={current.assignedTo ?? current.createdBy}
                    disabled={busy || readonly || !options}
                    onChange={(event) =>
                      void action(() =>
                        updateCase(user.id, id, { assignedTo: event.target.value, expectedRevision: current.revision }),
                      )
                    }
                  >
                    {(
                      options?.assignees ?? [
                        { id: current.assignedTo ?? current.createdBy, name: current.assignedTo ?? current.createdBy },
                      ]
                    ).map((assignee) => (
                      <option key={assignee.id} value={assignee.id}>
                        {assignee.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={label}>
                  Case status
                  <select
                    className={fieldClass}
                    value={current.status}
                    disabled={busy || running}
                    onChange={(e) =>
                      void action(() =>
                        updateCase(user.id, id, { status: e.target.value as CaseStatus, expectedRevision: current.revision }),
                      )
                    }
                  >
                    {!["draft", "active", "archived"].includes(current.status) && (
                      <option value={current.status} disabled>
                        {CASE_STATE[current.status].label}
                      </option>
                    )}
                    {(["draft", "active", "archived"] as CaseStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {CASE_STATE[s].label}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-2xs font-normal text-mute">
                    Review and completion follow report approval.
                  </span>
                </label>
                <SpecialistPicker
                  value={specialists}
                  onChange={setSpecialists}
                  options={options?.specialists}
                  disabled={busy || readonly || running}
                />
                <SourcePicker
                  value={selectedSourceIds}
                  onChange={setSelectedSourceIds}
                  sources={options?.sources ?? []}
                  disabled={busy || readonly || running || !options}
                />
              </Panel>
            </div>
          </div>
        )}

        {area === "agents" && (
          <div className="grid gap-3">
            <Panel
              title="Evidence files"
              count={files.length}
              aside={`${files.length} available of ${current.evidenceIds.length}`}
              enter={0}
              flush
            >
              {files.length === 0 ? (
                <EmptyState className="py-4">0 evidence files on this case.</EmptyState>
              ) : (
                <ul>
                  {files.map((file) => {
                    const st = FILE_STATE[file.status] ?? { tone: statusTone(file.status), label: statusLabel(file.status) };
                    return (
                      <li
                        key={file.id}
                        className="row-link flex flex-wrap items-center gap-3 border-b border-rule px-3 py-1.5 last:border-b-0"
                      >
                        <span className="min-w-0 flex-1 truncate text-sm" title={file.fileName}>
                          {file.fileName}
                        </span>
                        <StatusPill label={st.label} tone={st.tone} />
                        <span className="text-2xs tabular-nums text-mute">{file.chunkCount} excerpts</span>
                        <Button size="sm" onClick={() => downloadEvidence(user.id, file).catch((e: Error) => setError(e.message))}>
                          Download
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {!readonly && (
                <div className="border-t border-rule p-3">
                  <EvidenceUploader
                    value={uploads}
                    onChange={setUploads}
                    clientId={current.clientId}
                    onBusy={setUploading}
                    disabled={busy}
                  />
                  <Button
                    className="mt-3"
                    disabled={
                      !uploads.length ||
                      uploading ||
                      busy ||
                      evidencePending(uploads) ||
                      uploads.some((f) => f.status === "failed")
                    }
                    onClick={() =>
                      void action(async () => {
                        await post("evidence", { fileIds: uploads.map((f) => f.id) });
                        setUploads([]);
                      })
                    }
                  >
                    Add evidence to case
                  </Button>
                </div>
              )}
            </Panel>
            <Panel title="Agent activity" count={data.contributions.length} enter={1} flush>
              {!data.contributions.length && (
                <EmptyState className="py-4">0 agent contributions. Run the investigation.</EmptyState>
              )}
              <div>
                {data.contributions.map((step) => (
                  <Contribution
                    key={step.id}
                    step={step}
                    busy={busy || readonly || running}
                    onExclude={() => {
                      setReason("");
                      setReviewAction({ step, action: "exclude" });
                    }}
                    onRerun={() => {
                      setReason("");
                      setReviewAction({ step, action: "rerun" });
                    }}
                  />
                ))}
              </div>
            </Panel>
            <Panel title="Runs" count={data.runs.length} enter={2} flush>
              {data.runs.map((run) => (
                <div
                  key={run.id}
                  className="flex flex-wrap items-center gap-3 border-b border-rule px-3 py-1.5 text-xs last:border-b-0"
                >
                  <span className="font-mono">{run.id}</span>
                  <StatusPill tone={statusTone(run.status ?? "")} label={statusLabel(run.status ?? "unknown")} />
                  <span className="font-mono text-mute">{run.workflowRef ?? current.workflowRef}</span>
                  {run.error && <span className="text-danger">{run.error}</span>}
                </div>
              ))}
              {!data.runs.length && <EmptyState className="py-4">0 runs.</EmptyState>}
            </Panel>
          </div>
        )}

        {area === "findings" && (
          <div className="grid items-start gap-3 @4xl/page:grid-cols-2">
            <Panel title="Included findings" count={findingsCount} enter={0} flush>
              {!findingsCount && <EmptyState className="py-4">0 evidence-backed findings.</EmptyState>}
              <ul>
                {included.flatMap((step) =>
                  step.findings.map((finding, i) => (
                    <li key={`${step.id}-${i}`} className="border-b border-rule px-3 py-2 last:border-b-0">
                      <p className="text-sm">{defang(finding.claim)}</p>
                      <p className="mt-1 text-2xs text-mute">
                        {step.label} · {finding.citationIds.join(", ") || "No supporting citation"}
                      </p>
                    </li>
                  )),
                )}
              </ul>
            </Panel>
            <div className="grid gap-3">
              <Panel title="Evidence relationships" count={data.relationships?.length ?? 0} enter={1} flush>
                {data.relationships?.map((relationship, index) => (
                  <details
                    key={`${relationship.evidenceId}-${index}`}
                    className="group/d border-b border-rule last:border-b-0"
                  >
                    <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-1.5 text-xs transition-colors duration-150 hover:bg-inset">
                      <IconChevronDown className="-rotate-90 text-faint group-open/d:rotate-0" />
                      <IndicatorChip value={relationship.entity} /> mentioned in {relationship.label}
                    </summary>
                    <div className="reveal px-3 pb-2 pl-8">
                      <p className="whitespace-pre-wrap text-sm">{defang(relationship.excerpt)}</p>
                      <p className="mt-1 font-mono text-2xs text-mute">{relationship.evidenceId}</p>
                    </div>
                  </details>
                ))}
                {!data.relationships?.length && <EmptyState className="py-4">0 evidence relationships.</EmptyState>}
              </Panel>
              <Panel title="Negative results" enter={2}>
                {included
                  .flatMap((step) => step.negativeResults ?? [])
                  .map((result, i) => (
                    <p key={i} className="mb-2 text-sm last:mb-0">
                      {defang(display(result))}
                    </p>
                  ))}
                {!included.some((s) => s.negativeResults?.length) && (
                  <p className="text-sm text-mute">0 recorded negative results.</p>
                )}
              </Panel>
              <Panel title="Contradictions" enter={3}>
                {included
                  .flatMap((step) => step.contradictions ?? [])
                  .map((conflict, index) => (
                    <div key={index} className="mb-3 border-l-2 border-danger-edge pl-3 last:mb-0">
                      <p className="text-sm font-medium">{conflict.subject}</p>
                      <ul className="mt-1 list-disc space-y-1 pl-4">
                        {conflict.claims.map((claim, claimIndex) => (
                          <li key={claimIndex} className="text-xs">
                            {defang(claim)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                {!included.some((step) => step.contradictions?.length) && (
                  <p className="text-sm text-mute">0 recorded contradictions.</p>
                )}
              </Panel>
              <Panel title="Coverage and limitations" enter={4}>
                {[
                  ...new Set(
                    included.flatMap((step) => [...(step.limitations ?? []), ...(step.error ? [step.error] : [])]),
                  ),
                ].map((item, i) => (
                  <p key={i} className="mb-2 border-l-2 border-cpx-bright-300 pl-3 text-sm last:mb-0">
                    {item}
                  </p>
                ))}
                {!included.some((s) => s.limitations?.length || s.error) && (
                  <p className="text-sm text-mute">0 recorded limitations.</p>
                )}
              </Panel>
              <Panel title="Entity pivots" count={current.entities.length} enter={5}>
                <ul className="space-y-2">
                  {current.entities.map((entity, i) => (
                    <li key={i} className="flex flex-wrap items-center gap-3 text-sm">
                      <IndicatorChip value={entity.value} />
                      <Link
                        href={`/intelligence?prompt=${encodeURIComponent(`Find evidence related to ${entity.value}`)}`}
                        className="link-quiet text-xs"
                      >
                        Query related evidence
                      </Link>
                    </li>
                  ))}
                </ul>
                {!current.entities.length && <p className="text-sm text-mute">0 entities to pivot on.</p>}
              </Panel>
            </div>
          </div>
        )}

        {area === "report" && (
          <Panel
            title="Case reports"
            count={data.reports.length}
            aside={`${included.length} included agent contributions · lead approval required`}
            action={
              canWriteReports(user.role) ? (
                <Button
                  size="sm"
                  variant="primary"
                  disabled={busy || running || !included.some((step) => step.findings.length)}
                  onClick={() => void action(() => post("report"), "Draft created. Open it to review and submit.")}
                >
                  Generate draft
                </Button>
              ) : undefined
            }
            enter={0}
            flush
            className="max-w-4xl"
          >
            {!included.some((step) => step.findings.length) && (
              <Banner tone="note" className="m-3">
                0 cited findings. Add evidence and rerun specialists.
              </Banner>
            )}
            <ul>
              {data.reports.map((report) => {
                const st = ADVISORY_STATE[report.status as Advisory["status"]] ?? {
                  tone: statusTone(report.status),
                  label: statusLabel(report.status),
                };
                return (
                  <li
                    key={report.ref}
                    className="row-link relative flex flex-wrap items-center gap-3 border-b border-rule px-3 py-1.5 last:border-b-0"
                  >
                    <Link
                      href={`/reports/${encodeURIComponent(report.ref)}`}
                      className="min-w-0 flex-1 truncate text-sm font-medium after:absolute after:inset-0"
                    >
                      {report.title}
                    </Link>
                    <StatusPill tone={st.tone} label={st.label} />
                    <span className="text-2xs tabular-nums text-mute">v{report.version}</span>
                  </li>
                );
              })}
            </ul>
            {!data.reports.length && <EmptyState className="py-4">0 case reports.</EmptyState>}
          </Panel>
        )}
      </div>

      {reviewAction && (
        <Dialog
          title={
            reviewAction.action === "rerun"
              ? "Rerun specialist"
              : reviewAction.step.excluded
                ? "Include contribution"
                : "Exclude contribution"
          }
          onClose={() => setReviewAction(null)}
        >
          <p className="text-sm">{reviewAction.step.label}</p>
          <label className={`${label} mt-4`}>
            Reason
            <textarea
              className={fieldClass}
              rows={3}
              required
              minLength={5}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <p className="mt-2 text-2xs text-mute">
            The reason stays in the audit history. A changed evidence basis needs a new report draft.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button disabled={busy} onClick={() => setReviewAction(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={busy || reason.trim().length < 5}
              onClick={() =>
                void action(async () => {
                  await post(`contributions/${reviewAction.step.id}/${reviewAction.action}`, {
                    reason: reason.trim(),
                    ...(reviewAction.action === "exclude" ? { excluded: !reviewAction.step.excluded } : {}),
                  });
                  setReviewAction(null);
                })
              }
            >
              Confirm{" "}
              {reviewAction.action === "rerun" ? "rerun" : reviewAction.step.excluded ? "inclusion" : "exclusion"}
            </Button>
          </div>
        </Dialog>
      )}
    </Page>
  );
}

function Contribution({
  step,
  busy,
  onExclude,
  onRerun,
}: {
  step: CaseContribution;
  busy: boolean;
  onExclude: () => void;
  onRerun: () => void;
}) {
  return (
    <details className="group/c border-b border-rule last:border-b-0">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-3 py-2 text-sm transition-colors duration-150 hover:bg-inset">
        <IconChevronDown className="-rotate-90 text-faint group-open/c:rotate-0" />
        <strong className={`flex-1 font-medium ${step.excluded ? "text-mute line-through" : ""}`}>
          {step.label || step.agentId}
        </strong>
        <StatusPill tone={statusTone(step.status)} label={statusLabel(step.status)} />
        <span className="text-xs tabular-nums text-mute">
          {step.findings.length} findings · {step.evidence.length} evidence records
        </span>
        {step.excluded && <span className="text-xs font-medium text-danger">Excluded</span>}
      </summary>
      <div className="reveal space-y-3 px-3 pb-3 pl-9">
        {step.exclusionReason && <p className="text-xs text-mute">Exclusion reason: {step.exclusionReason}</p>}
        {step.error && <p className="text-xs text-danger">{step.error}</p>}
        {step.limitations?.map((item, i) => (
          <p key={i} className="text-xs text-status-warn-ink">
            {item}
          </p>
        ))}
        {step.evidence.map((evidence) => (
          <div key={evidence.id} className="border-l-2 border-rule-strong pl-3">
            <p className="text-xs font-medium">{evidence.label || evidence.id}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{defang(evidence.text)}</p>
            <p className="mt-1 text-2xs text-mute">
              {evidence.source} · {evidence.id}
              {evidence.observedAt ? ` · ${gstDateTime(evidence.observedAt)}` : ""}
            </p>
          </div>
        ))}
        <div className="flex gap-2">
          <Button size="sm" disabled={busy} onClick={onExclude}>
            {step.excluded ? "Include contribution" : "Exclude contribution"}
          </Button>
          {SPECIALISTS.some(([area]) => area === step.area) && (
            <Button size="sm" disabled={busy || step.status === "running"} onClick={onRerun}>
              Rerun specialist
            </Button>
          )}
        </div>
      </div>
    </details>
  );
}
