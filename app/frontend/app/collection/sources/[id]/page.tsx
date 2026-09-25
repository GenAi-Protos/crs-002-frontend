"use client";

// One source, managed. The three timestamps stand apart because they are
// not interchangeable: lastNewItemAt is the field that catches the failure
// the other two hide.

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useConsoleUser } from "@/lib/role-context";
import { canSee } from "@/lib/access";
import { getPirs, getSource, patchSource, isUnreachable } from "@/lib/api";
import { SOURCES } from "@/lib/fixtures-sources";
import type { Pir, Rhythm, Source } from "@/lib/types";
import { pollLog } from "@/lib/source-log";
import { agoFromNow, gstDate, gstDateTime } from "@/lib/format";
import { captureModeLabel } from "@/lib/derive";
import {
  Banner,
  Button,
  buttonClass,
  CenterMessage,
  downloadCsv,
  InertUrl,
  ListMeta,
  NotPermitted,
  OfflineNote,
  Page,
  PageHeader,
  Panel,
  SearchBox,
  Select,
  SkeletonPanel,
  Stat,
  StatStrip,
  StatusPill,
} from "@/components/ui";
import { DailyBars } from "@/components/chart/DailyBars";
import { IconCheck, IconChevronLeft, IconEgress } from "@/components/icons";
import { EmptyRow, T_HEAD, T_NUM, T_ROW, T_TABLE, T_TD, T_TH } from "@/components/table";
import { SOURCE_STATE } from "@/lib/status";

function Back() {
  return (
    <Link
      href="/collection?tab=sources"
      className="group/b mb-2 inline-flex items-center gap-0.5 text-xs text-mute transition-colors duration-150 hover:text-accent"
    >
      <IconChevronLeft className="transition-transform duration-150 group-hover/b:-translate-x-0.5" />
      Sources
    </Link>
  );
}

const RHYTHMS: Rhythm[] = ["continuous", "hourly", "daily", "weekly"];

export default function SourcePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useConsoleUser();
  const base = SOURCES.find((s) => s.id === id);
  const [draft, setDraft] = useState<Source | null>(null);
  const [savedSnap, setSavedSnap] = useState<Source | null>(null);
  const [logQuery, setLogQuery] = useState("");
  const [apiBase, setApiBase] = useState<Source | null>(null);
  const [pirs, setPirs] = useState<Pir[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  // "No source" waits for the backend's answer; ids outside the fixtures used
  // to flash it while loading.
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    getSource(user.id, id)
      .then((s) => {
        setApiBase(s);
        setOffline(false);
      })
      .catch((e) => setOffline(isUnreachable(e)))
      .finally(() => setLoaded(true));
    getPirs(user.id).then(setPirs).catch(() => setPirs([]));
  }, [user.id, id]);

  // The saved state is whatever the server last returned. The draft only
  // differs once edited here, so `dirty` compares against the server, not
  // against a copy kept in the browser.
  useEffect(() => {
    if (!base || draft) return;
    setDraft(base);
    setSavedSnap(base);
  }, [base, draft]);

  useEffect(() => {
    if (!apiBase) return;
    setDraft(apiBase);
    setSavedSnap(apiBase);
  }, [apiBase]);

  const source = apiBase ?? base;
  const s = draft ?? source;
  const log = useMemo(() => (s ? pollLog(s) : []), [s]);
  const dirty =
    !!savedSnap &&
    !!s &&
    (s.enabled !== savedSnap.enabled ||
      s.expectedRhythm !== savedSnap.expectedRhythm ||
      JSON.stringify([...s.pirRefs].sort()) !==
        JSON.stringify([...savedSnap.pirRefs].sort()));

  if (!canSee(user.role, "collection")) return <NotPermitted />;

  if (!s && !loaded) {
    return (
      <Page band>
        <Back />
        <div className="mb-3 h-7 w-72 bg-fill" />
        <div className="grid gap-3 @4xl/page:grid-cols-12">
          <SkeletonPanel rows={6} className="@4xl/page:col-span-4" />
          <SkeletonPanel rows={5} className="@4xl/page:col-span-8" />
        </div>
      </Page>
    );
  }

  if (!s) {
    return (
      <CenterMessage
        action={
          <Link href="/collection?tab=sources" className="link-quiet text-sm">
            Sources
          </Link>
        }
      >
        {offline ? "Sources could not be reached. Retry when the backend is available." : "No source with this reference."}
      </CenterMessage>
    );
  }

  const update = (fn: (x: Source) => Source) => setDraft(fn(s));
  const st = SOURCE_STATE[s.state];
  const filteredLog = log.filter((r) => {
    if (logQuery === "") return true;
    const q = logQuery.toLowerCase();
    return (
      r.outcome.toLowerCase().includes(q) ||
      r.date.includes(q) ||
      gstDate(`${r.date}T12:00:00Z`).toLowerCase().includes(q)
    );
  });

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      // Only these three are settings. Class, capture mode and residency are
      // derived server-side and must not be sent.
      const saved = await patchSource(user.id, s.id, {
        enabled: s.enabled,
        expectedRhythm: s.expectedRhythm,
        pirRefs: s.pirRefs,
      });
      setDraft(saved);
      setSavedSnap(saved);
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page band>
      <Back />
      <PageHeader
        title={s.name}
        meta={
          <span className="flex shrink-0 items-center gap-1.5">
            <StatusPill {...st} />
            {!s.enabled && <StatusPill tone="idle" label="Disabled" />}
            {offline && <OfflineNote />}
          </span>
        }
        action={
          <>
            {dirty && (
              <>
                <Button variant="primary" disabled={saving} onClick={() => void save()}>
                  {saving ? "Saving" : "Save"}
                </Button>
                <Button onClick={() => setDraft(savedSnap)}>Discard</Button>
              </>
            )}
            <Button onClick={() => update((x) => ({ ...x, enabled: !x.enabled }))}>
              {s.enabled ? "Disable" : "Enable"}
            </Button>
            {(s.state === "blocked-needs-credential" || s.state === "failing") && (
              <Link href="/collection?tab=requests" className={buttonClass()}>
                Request queue
              </Link>
            )}
          </>
        }
      />
      <p className="-mt-2 mb-3">
        <InertUrl url={s.url} />
      </p>
      {saveError && (
        <Banner tone="warn" className="mb-3">
          Not saved: {saveError}
        </Banner>
      )}

      <div className="grid items-start gap-3 @4xl/page:grid-cols-12">
        <Panel title="Facts" enter={0} className="@4xl/page:col-span-4">
          <dl className="space-y-2 text-sm">
            <FactRow label="Sheet">{s.sheet}</FactRow>
            <FactRow label="Class">{s.collectorClass}</FactRow>
            <FactRow label="Capture">{captureModeLabel[s.captureMode]}</FactRow>
            <FactRow label="Residency">
              <span className="inline-flex items-center gap-1">
                {s.residency === "egress" ? (
                  <>
                    <IconEgress />
                    Egress
                  </>
                ) : (
                  "In region"
                )}
              </span>
            </FactRow>
            <FactRow label="Rhythm">
              <Select
                fieldSize="sm"
                value={s.expectedRhythm}
                onChange={(e) => update((x) => ({ ...x, expectedRhythm: e.target.value as Rhythm }))}
                aria-label="Expected rhythm"
                className="capitalize"
              >
                {RHYTHMS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </Select>
            </FactRow>
            <FactRow label="PIRs served">
              <span className="flex flex-wrap gap-1">
                {pirs.map((p) => {
                  const on = s.pirRefs.includes(p.ref);
                  return (
                    <button
                      key={p.ref}
                      title={p.question}
                      aria-pressed={on}
                      onClick={() =>
                        update((x) => ({
                          ...x,
                          pirRefs: on ? x.pirRefs.filter((r) => r !== p.ref) : [...x.pirRefs, p.ref],
                        }))
                      }
                      className={`inline-flex h-6 min-w-8 items-center justify-center gap-0.5 rounded-sm border px-1.5 text-2xs tabular-nums transition-colors duration-150 ${
                        on
                          ? "border-cpx-green bg-select font-medium text-ink"
                          : "border-rule text-mute hover:border-rule-strong hover:text-ink"
                      }`}
                    >
                      {on && <IconCheck className="text-green-contrast" />}
                      {p.ref.replace("PIR", "")}
                    </button>
                  );
                })}
              </span>
            </FactRow>
          </dl>
        </Panel>

        <Panel title="Collection" aside="30 days" enter={1} flush className="@4xl/page:col-span-8">
          <StatStrip className="grid-cols-1 border-0 border-b @xl/page:grid-cols-3">
            <Stat label="Last attempt" value={agoFromNow(s.lastAttempt)} caption={gstDateTime(s.lastAttempt)} />
            <Stat label="Last success" value={agoFromNow(s.lastSuccess)} caption={gstDateTime(s.lastSuccess)} />
            <Stat
              label="Last new item"
              value={agoFromNow(s.lastNewItemAt)}
              caption={gstDateTime(s.lastNewItemAt)}
              tone={s.state === "silent-unexplained" ? "warn" : "neutral"}
            />
          </StatStrip>
          <div className="p-3">
            <div className="flex items-baseline gap-5 text-sm">
              <span>
                <span className="font-medium tabular-nums">{s.itemsLast30d}</span>{" "}
                <span className="text-mute">items, 30 days</span>
              </span>
              <span>
                <span className={`font-medium tabular-nums ${s.consecutiveFailures > 0 ? "text-danger" : ""}`}>
                  {s.consecutiveFailures}
                </span>{" "}
                <span className="text-mute">consecutive failures</span>
              </span>
            </div>
            <div className="mt-3">
              <DailyBars days={s.dailyItems} />
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="Poll log" count={log.length} enter={2} flush className="mt-3">
        <div className="flex flex-wrap items-center gap-2 border-b border-rule px-3 py-2">
          <SearchBox value={logQuery} onChange={setLogQuery} className="w-full max-w-64" />
          <div className="flex-1" />
          <ListMeta
            shown={filteredLog.length}
            total={log.length}
            sort="Newest first"
            onExport={() =>
              downloadCsv(
                `${s.id}-log.csv`,
                ["Date", "Attempts", "Items", "Outcome"],
                filteredLog.map((r) => [r.date, String(r.attempts), String(r.items), r.outcome]),
              )
            }
          />
        </div>
        <table className={`${T_TABLE} table-fixed text-sm`}>
          <colgroup>
            <col className="w-36" />
            <col className="w-24" />
            <col className="w-28" />
            <col />
          </colgroup>
          <thead>
            <tr className={T_HEAD}>
              <th scope="col" className={T_TH}>Date</th>
              <th scope="col" className={`${T_TH} ${T_NUM}`}>Attempts</th>
              <th scope="col" className={`${T_TH} ${T_NUM}`}>New items</th>
              <th scope="col" className={T_TH}>Outcome</th>
            </tr>
          </thead>
          <tbody>
            {filteredLog.length === 0 && (
              <EmptyRow colSpan={4}>
                <span className="font-medium text-ink">0 entries</span> matched
              </EmptyRow>
            )}
            {filteredLog.map((r) => (
              <tr key={r.date} className={T_ROW}>
                <td className={`${T_TD} whitespace-nowrap font-mono text-xs`}>{gstDate(`${r.date}T12:00:00Z`)}</td>
                <td className={`${T_TD} ${T_NUM}`}>{r.attempts}</td>
                <td className={`${T_TD} ${T_NUM} font-medium`}>{r.items}</td>
                <td className={`${T_TD} truncate ${r.failed ? "font-medium text-status-warn-ink" : ""}`} title={r.outcome}>
                  {r.outcome}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </Page>
  );
}

function FactRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 border-b border-rule pb-2 last:border-b-0 last:pb-0">
      <dt className="w-24 shrink-0 pt-0.5 text-xs font-medium text-ink-3">
        {label}
      </dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  );
}
