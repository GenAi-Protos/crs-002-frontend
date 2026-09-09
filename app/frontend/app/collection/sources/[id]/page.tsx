"use client";

// One source, managed. The three timestamps stand apart because they are
// not interchangeable: lastNewItemAt is the field that catches the failure
// the other two hide.

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useConsoleUser } from "@/lib/role-context";
import { canSee } from "@/lib/access";
import { getPirs, getSource, patchSource, isUnreachable } from "@/lib/api";
import { SOURCES } from "@/lib/fixtures";
import type { Pir, Rhythm, Source } from "@/lib/types";
import { pollLog } from "@/lib/source-log";
import { agoFromNow, gstDate, gstDateTime } from "@/lib/format";
import { captureModeLabel } from "@/lib/derive";
import { downloadCsv, InertUrl, ListMeta, SearchBox, StatusPill, type StatusTone, buttonClass, OfflineNote } from "@/components/ui";
import { DailyBars } from "@/components/chart/DailyBars";
import { IconEgress } from "@/components/icons";
import { T_HEAD, T_NUM, T_ROW, T_TABLE, T_TD, T_TH } from "@/components/table";

const STATE_META: Record<Source["state"], { tone: StatusTone; label: string }> = {
  healthy: { tone: "good", label: "Healthy" },
  "silent-expected": { tone: "idle", label: "Silent, expected" },
  "silent-unexplained": { tone: "warn", label: "Silent, unexplained" },
  failing: { tone: "critical", label: "Failing" },
  "blocked-needs-credential": { tone: "warn", label: "Blocked, needs credential" },
  "not-collected": { tone: "idle", label: "Not collected" },
};

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
  useEffect(() => {
    getSource(user.id, id)
      .then((s) => {
        setApiBase(s);
        setOffline(false);
      })
      .catch((e) => setOffline(isUnreachable(e)));
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

  if (!canSee(user.role, "collection")) {
    return (
      <Center>
        <p className="text-base">Not permitted at this access level.</p>
        <Link href="/" className="text-sm text-link underline underline-offset-2">
          Dashboard
        </Link>
      </Center>
    );
  }

  if (!s) {
    return (
      <Center>
        <p className="text-base">No source with this reference.</p>
        <Link
          href="/collection?tab=sources"
          className="text-sm text-link underline underline-offset-2"
        >
          Sources
        </Link>
      </Center>
    );
  }

  const update = (fn: (x: Source) => Source) => setDraft(fn(s));
  const st = STATE_META[s.state];
  const filteredLog = log.filter((r) => {
    if (logQuery === "") return true;
    const q = logQuery.toLowerCase();
    return (
      r.outcome.toLowerCase().includes(q) ||
      r.date.includes(q) ||
      gstDate(`${r.date}T12:00:00Z`).toLowerCase().includes(q)
    );
  });

  return (
    <div className="mx-auto max-w-[1400px] px-8 py-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/collection?tab=sources"
          className="text-xs text-cpx-grey underline underline-offset-2"
        >
          Sources
        </Link>
        <span className="text-black/30">/</span>
        <h1 className="text-xl font-medium tracking-tightish">{s.name}</h1>
        <StatusPill {...st} />
        {offline && <OfflineNote />}
        <div className="flex-1" />
        {saveError && (
          <span className="text-xs text-status-warn-ink">Not saved: {saveError}</span>
        )}
        {dirty && (
          <>
            <button
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                setSaveError(null);
                try {
                  // Only these three are settings. Class, capture mode and
                  // residency are derived server-side and must not be sent.
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
              }}
              className={buttonClass("primary")}
            >
              {saving ? "Saving" : "Save"}
            </button>
            <button
              onClick={() => setDraft(savedSnap)}
              className={buttonClass()}
            >
              Discard
            </button>
          </>
        )}
        <button
          onClick={() => update((x) => ({ ...x, enabled: !x.enabled }))}
          className={buttonClass(s.enabled ? "secondary" : "primary")}
        >
          {s.enabled ? "Disable" : "Enable"}
        </button>
        {(s.state === "blocked-needs-credential" || s.state === "failing") && (
          <Link
            href="/collection?tab=requests"
            className={buttonClass()}
          >
            Request queue
          </Link>
        )}
      </div>
      <p className="mt-1">
        <InertUrl url={s.url} />
      </p>

      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="border border-black/10 bg-white p-4 xl:col-span-4">
          <span className="text-xs text-cpx-grey">Facts</span>
          <dl className="mt-3 space-y-2.5 text-sm">
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
              <select
                value={s.expectedRhythm}
                onChange={(e) =>
                  update((x) => ({ ...x, expectedRhythm: e.target.value as Rhythm }))
                }
                aria-label="Expected rhythm"
                className="h-7 border border-black/10 bg-white px-1 text-xs focus:outline-none"
              >
                {RHYTHMS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </FactRow>
            <FactRow label="PIRs served">
              <span className="flex flex-wrap gap-1">
                {pirs.map((p) => {
                  const on = s.pirRefs.includes(p.ref);
                  return (
                    <button
                      key={p.ref}
                      title={p.question}
                      onClick={() =>
                        update((x) => ({
                          ...x,
                          pirRefs: on
                            ? x.pirRefs.filter((r) => r !== p.ref)
                            : [...x.pirRefs, p.ref],
                        }))
                      }
                      className={`px-1.5 py-0.5 text-2xs ${
                        on
                          ? "bg-cpx-purple font-medium text-white"
                          : "border border-black/15 text-cpx-grey"
                      }`}
                    >
                      {p.ref.replace("PIR", "")}
                    </button>
                  );
                })}
              </span>
            </FactRow>
          </dl>
        </div>

        <div className="border border-black/10 bg-white p-4 xl:col-span-8">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stamp label="Last attempt" value={agoFromNow(s.lastAttempt)} sub={gstDateTime(s.lastAttempt)} />
            <Stamp label="Last success" value={agoFromNow(s.lastSuccess)} sub={gstDateTime(s.lastSuccess)} />
            <Stamp
              label="Last new item"
              value={agoFromNow(s.lastNewItemAt)}
              sub={gstDateTime(s.lastNewItemAt)}
              accent={s.state === "silent-unexplained"}
            />
          </div>
          <div className="mt-4 flex items-baseline gap-5 text-sm">
            <span>
              <span className="font-medium">{s.itemsLast30d}</span>{" "}
              <span className="text-cpx-grey">items, 30 days</span>
            </span>
            <span>
              <span className="font-medium">{s.consecutiveFailures}</span>{" "}
              <span className="text-cpx-grey">consecutive failures</span>
            </span>
          </div>
          <div className="mt-3">
            <DailyBars days={s.dailyItems} />
          </div>
        </div>
      </div>

      <div className="mt-4 border border-black/10 bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-cpx-grey">Poll log</span>
          <SearchBox value={logQuery} onChange={setLogQuery} className="w-64" />
          <div className="flex-1" />
          <ListMeta
            shown={filteredLog.length}
            total={log.length}
            sort="Newest first"
            onExport={() =>
              downloadCsv(
                `${s.id}-log.csv`,
                ["Date", "Attempts", "Items", "Outcome"],
                filteredLog.map((r) => [
                  r.date,
                  String(r.attempts),
                  String(r.items),
                  r.outcome,
                ]),
              )
            }
          />
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className={`${T_TABLE} min-w-[34rem] text-sm`}>
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
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center">
                    <span className="font-medium">0 entries</span> matched
                  </td>
                </tr>
              )}
              {filteredLog.map((r) => (
                <tr key={r.date} className={T_ROW}>
                  <td className={`${T_TD} whitespace-nowrap font-mono text-xs`}>
                    {gstDate(`${r.date}T12:00:00Z`)}
                  </td>
                  <td className={`${T_TD} ${T_NUM}`}>{r.attempts}</td>
                  <td className={`${T_TD} ${T_NUM} font-medium`}>{r.items}</td>
                  <td
                    className={`${T_TD} ${
                      r.failed ? "font-medium text-status-warn-ink" : ""
                    }`}
                  >
                    {r.outcome}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
      {children}
    </div>
  );
}

function FactRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <dt className="w-24 shrink-0 pt-0.5 text-xs text-cpx-grey">
        {label}
      </dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  );
}

function Stamp({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div className={`border p-3 ${accent ? "border-status-warn-ink/30 bg-status-warn-fill" : "border-black/10"}`}>
      <span className={`text-2xs ${accent ? "text-status-warn-ink" : "text-cpx-grey"}`}>
        {label}
      </span>
      <span className={`mt-1 block text-lg font-display font-medium leading-none tracking-tightish ${accent ? "text-status-warn-ink" : ""}`}>
        {value}
      </span>
      <span className={`mt-1 block text-2xs ${accent ? "text-status-warn-ink/80" : "text-cpx-grey"}`}>
        {sub}
      </span>
    </div>
  );
}
