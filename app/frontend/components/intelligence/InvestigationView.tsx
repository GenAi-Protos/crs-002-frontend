"use client";

// Investigation. The chain around one observable, in the order an analyst
// actually walks it:
//
//   Observable > infrastructure > malware > actor > campaign > TTPs > detection
//
// Lookup answers what this is. This answers what it is part of, and it is a
// separate view because it is a separate question with a different cost.
//
// Two things this refuses to fake. A technique renders only when its id
// resolves against the held ATT&CK table, and an id that does not resolve is
// marked rather than given an invented name. And every stage renders its count
// including zero, because a break in the chain is a finding: it says where our
// coverage stops.

import type { LookupRecord, ObservableKind } from "@/lib/types";
import { KIND_LABEL, VERDICT_LABEL } from "@/lib/lookup";
import { TACTICS, resolveTechnique } from "@/lib/mitre";
import { IndicatorChip, StatusPill, TlpBadge, type StatusTone } from "@/components/ui";
import { IconArrowRight } from "@/components/icons";
import {
  MonoValue,
  T_FLUSH,
  T_HEAD,
  T_ROW,
  T_TABLE,
  T_TD,
  T_TH,
} from "@/components/table";
import Link from "next/link";

const VERDICT_TONE: Record<string, StatusTone> = {
  malicious: "critical",
  suspicious: "warn",
  benign: "good",
  unknown: "idle",
};

const DETECTION_LABEL = {
  yara: "YARA",
  sigma: "Sigma",
  hunting: "Hunting query",
} as const;

export function InvestigationView({
  record,
  onBack,
}: {
  record: LookupRecord;
  onBack: () => void;
}) {
  const g = record.investigation;

  const stages = [
    { key: "observable", label: "Observable", count: 1 },
    { key: "infrastructure", label: "Infrastructure", count: g.infrastructure.length },
    { key: "malware", label: "Malware", count: g.malware.length },
    { key: "actors", label: "Threat actor", count: g.actors.length },
    { key: "campaigns", label: "Campaign", count: g.campaigns.length },
    { key: "techniques", label: "Techniques", count: g.techniques.length },
    { key: "detections", label: "Detection content", count: g.detections.length },
  ];

  const broken = stages.find((s) => s.count === 0);

  return (
    <div className="py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <button
            onClick={onBack}
            className="text-xs text-mute hover:text-ink"
          >
            Back to lookup
          </button>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tightish">Investigation</h2>
            <IndicatorChip value={record.observable} />
            <span className="bg-inset px-1.5 text-2xs">
              {KIND_LABEL[record.kind]}
            </span>
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-2">
          <TlpBadge tlp={record.tlp} />
          <StatusPill
            tone={VERDICT_TONE[record.verdict]}
            label={VERDICT_LABEL[record.verdict]}
          />
        </span>
      </div>

      {/* The chain, with its counts. Reading it left to right is the point. */}
      <div className="mt-4 flex flex-wrap items-center gap-x-1 gap-y-2 border border-rule bg-surface px-3 py-2.5">
        {stages.map((s, i) => (
          <span key={s.key} className="flex items-center gap-1">
            <a
              href={`#stage-${s.key}`}
              className={`flex items-baseline gap-1.5 px-1.5 py-0.5 text-xs hover:bg-inset ${
                s.count === 0 ? "text-mute" : ""
              }`}
            >
              {s.label}
              <span
                className={`px-1 text-2xs ${
                  s.count === 0 ? "bg-status-warn-fill text-status-warn-ink" : "bg-inset"
                }`}
              >
                {s.count}
              </span>
            </a>
            {i < stages.length - 1 && (
              <IconArrowRight className="shrink-0 text-faint" />
            )}
          </span>
        ))}
      </div>

      {broken && (
        <p className="mt-2 text-2xs text-status-warn-ink">
          The chain stops at {broken.label.toLowerCase()}: nothing is held. That is
          a gap in our coverage, not a statement that none exists.
        </p>
      )}

      <div className="mt-4 space-y-3">
        <Stage
          id="stage-observable"
          index={1}
          title="Observable"
          count={1}
          note={record.verdictReason}
        >
          <div className="flex flex-wrap items-center gap-2">
            <IndicatorChip value={record.observable} />
            <span className="text-xs text-mute">
              risk {record.riskScore} of 100 · {record.recordCount} held records
            </span>
          </div>
        </Stage>

        <Stage
          id="stage-infrastructure"
          index={2}
          title="Related addresses and domains"
          count={g.infrastructure.length}
          note="Infrastructure seen alongside this observable."
        >
          <ul className="space-y-2.5">
            {g.infrastructure.map((i) => (
              <li key={i.value} className="flex flex-wrap items-baseline gap-2">
                <IndicatorChip value={i.value} />
                <span className="bg-inset px-1.5 text-2xs">
                  {KIND_LABEL[i.kind as ObservableKind]}
                </span>
                <span className="min-w-0 flex-1 text-xs text-mute">
                  {i.note}
                </span>
              </li>
            ))}
          </ul>
        </Stage>

        <Stage
          id="stage-malware"
          index={3}
          title="Malware"
          count={g.malware.length}
          note="Families the infrastructure delivered or served."
        >
          <ul className="space-y-2.5">
            {g.malware.map((m) => (
              <li key={m.name}>
                <span className="flex flex-wrap items-baseline gap-2">
                  <span className="text-sm font-medium">{m.name}</span>
                  <span className="bg-inset px-1.5 text-2xs">
                    {m.family}
                  </span>
                </span>
                <span className="mt-0.5 block text-xs text-mute">
                  {m.note}
                </span>
              </li>
            ))}
          </ul>
        </Stage>

        <Stage
          id="stage-actors"
          index={4}
          title="Threat actor"
          count={g.actors.length}
          note="Attribution carries its own confidence and is never asserted from infrastructure alone."
        >
          <ul className="space-y-2.5">
            {g.actors.map((a) => (
              <li key={a.name}>
                <span className="flex flex-wrap items-baseline gap-2">
                  <span className="text-sm font-medium">{a.name}</span>
                  {a.aliases.map((alias) => (
                    <span
                      key={alias}
                      className="bg-inset px-1.5 text-2xs"
                    >
                      {alias}
                    </span>
                  ))}
                </span>
                <span className="mt-0.5 block text-xs text-mute">
                  {a.note}
                </span>
              </li>
            ))}
          </ul>
        </Stage>

        <Stage
          id="stage-campaigns"
          index={5}
          title="Campaign"
          count={g.campaigns.length}
          note="What CPX has already issued on this activity."
        >
          <ul className="space-y-2.5">
            {g.campaigns.map((c) => (
              <li key={c.ref}>
                <span className="flex flex-wrap items-baseline gap-2">
                  <span className="text-sm font-medium">{c.name}</span>
                  <Link
                    href={`/reports/${c.ref}`}
                    className="font-mono text-2xs text-link underline underline-offset-2"
                  >
                    {c.ref}
                  </Link>
                </span>
                <span className="mt-0.5 block text-xs text-mute">
                  {c.note}
                </span>
              </li>
            ))}
          </ul>
        </Stage>

        <Stage
          id="stage-techniques"
          index={6}
          title="Techniques"
          count={g.techniques.length}
          note="Enter the id, the name derives. An id that does not resolve is marked, never named."
        >
          <div className="overflow-x-auto">
            <table className={`${T_TABLE} min-w-[34rem] text-xs`}>
              <colgroup>
                <col className="w-56" />
                <col className="w-56" />
                <col />
              </colgroup>
              <thead>
                <tr className={T_HEAD}>
                  <th scope="col" className={`${T_TH} ${T_FLUSH}`}>Technique</th>
                  <th scope="col" className={`${T_TH} ${T_FLUSH}`}>Tactic</th>
                  <th scope="col" className={`${T_TH} ${T_FLUSH}`}>Observed</th>
                </tr>
              </thead>
              <tbody>
                {g.techniques.map((t) => {
                  const resolved = resolveTechnique(t.id);
                  return (
                    <tr key={t.id} className={T_ROW}>
                      <td className={`${T_TD} ${T_FLUSH}`}>
                        <MonoValue value={t.id} copy what="technique id" />
                        <span className="mt-0.5 block font-medium">
                          {resolved ? (
                            resolved.name
                          ) : (
                            <span className="text-status-warn-ink">
                              Does not resolve
                            </span>
                          )}
                        </span>
                      </td>
                      <td className={`${T_TD} ${T_FLUSH} text-mute`}>
                        {resolved
                          ? resolved.tactics.map((id) => TACTICS[id] ?? id).join(", ")
                          : "-"}
                      </td>
                      <td className={`${T_TD} ${T_FLUSH}`}>{t.observed}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* The heat map is a text table. Generated imagery is out of scope. */}
        </Stage>

        <Stage
          id="stage-detections"
          index={7}
          title="Detection and hunting content"
          count={g.detections.length}
          note="What already covers this activity, and what it does not cover."
        >
          <ul className="space-y-2.5">
            {g.detections.map((d) => (
              <li key={d.ref}>
                <span className="flex flex-wrap items-baseline gap-2">
                  <span className="bg-inset px-1.5 text-2xs">
                    {DETECTION_LABEL[d.kind]}
                  </span>
                  <span className="text-sm font-medium">{d.name}</span>
                  <span className="font-mono text-2xs text-mute">{d.ref}</span>
                </span>
                <span className="mt-0.5 block text-xs text-mute">
                  {d.note}
                </span>
              </li>
            ))}
          </ul>
        </Stage>
      </div>

      <p className="mt-4 text-2xs text-mute">
        Every relationship above comes from a held record. Nothing here is
        inferred from the observable alone.
      </p>
    </div>
  );
}

function Stage({
  id,
  index,
  title,
  count,
  note,
  children,
}: {
  id: string;
  index: number;
  title: string;
  count: number;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-4 border border-rule bg-surface">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-rule px-4 py-2.5">
        <h3 className="flex items-baseline gap-2 text-sm font-medium tracking-tightish">
          <span className="text-mute">{index}</span>
          {title}
          <span
            className={`px-1 text-2xs ${
              count === 0 ? "bg-status-warn-fill text-status-warn-ink" : "bg-inset"
            }`}
          >
            {count}
          </span>
        </h3>
        <span className="text-2xs text-mute">{note}</span>
      </div>
      <div className="px-4 py-3">
        {count === 0 ? (
          <p className="text-xs">
            <span className="font-medium">0 held</span>. The chain stops here.
          </p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
