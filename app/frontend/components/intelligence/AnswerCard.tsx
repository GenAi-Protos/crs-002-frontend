"use client";

// One turn: the question row and the answer card beneath it.
// Two text treatments carry all the semantics: blue underline is a navigable
// entity, grey monospace chip is a defanged inert observable.
//
// Every state a turn can be in renders: streaming, complete, stopped, failed
// and superseded. A turn that failed used to fall through to the loading
// skeleton and stay there; it now says so in one sentence with the fix.
//
// The run behind an answer is openable from the one collapsed row under it
// (CLAUDE.md hard rule 4, AC-13). Everything in that row is a field the answer
// already carries: citations, the searches that returned nothing, the sources
// that were unavailable, whether the query left the region, and the marking.
// Nothing is inferred from timing and nothing is invented.

import { useState, type ReactNode } from "react";
import Link from "next/link";
import type { Answer, Turn } from "@/lib/types";
import { defang } from "@/lib/defang";
import { recordCount } from "@/lib/format";
import { NestorMarkReverse } from "@/components/shell/NestorMark";
import {
  IconCheck,
  IconChevronDown,
  IconCopy,
  IconEgress,
  IconExport,
} from "@/components/icons";
import { Button, IndicatorChip, TlpBadge } from "@/components/ui";
import {
  T_FLUSH,
  T_HEAD,
  T_ROW,
  T_TABLE,
  T_TD,
  T_TH,
} from "@/components/table";

/**
 * What the analyst asked for with the question. Absent when it is not known,
 * which is every stored or fixture conversation, so the run block states a
 * workflow only when the request is on record and never guesses one.
 */
export interface TurnRequest {
  /** The workflow chosen by name, or null when the system selected it. */
  workflow: string | null;
  clientId?: string | null;
}

function linkEntities(
  text: string,
  entities: Answer["entities"],
  onEntity: (id: string) => void,
): ReactNode[] {
  if (!entities.length) return [text];
  const names = entities
    .map((e) => e.name)
    .sort((a, b) => b.length - a.length)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(${names.join("|")})`, "g");
  return text.split(re).map((part, i) => {
    const ent = entities.find((e) => e.name === part);
    if (!ent) return part;
    return (
      <button
        key={`${ent.id}-${i}`}
        onClick={() => onEntity(ent.id)}
        className="text-link underline underline-offset-2 hover:text-cpx-blue-800"
      >
        {part}
      </button>
    );
  });
}

function answerPlainText(a: Answer): string {
  const lines: string[] = [];
  if (a.title) lines.push(a.title);
  for (const b of a.blocks) {
    if (b.kind === "prose") lines.push(b.text);
    if (b.kind === "list") lines.push(...b.items.map((i) => `- ${i}`));
    if (b.kind === "table")
      lines.push(b.headers.join(" | "), ...b.rows.map((r) => r.join(" | ")));
    if (b.kind === "indicators") lines.push(...b.values.map((v) => defang(v)));
  }
  return lines.join("\n");
}

// Export never carries an unsafe URL unredacted, and indicators leave defanged.
function answerExportJson(a: Answer): string {
  const safe = {
    ...a,
    blocks: a.blocks.map((b) =>
      b.kind === "indicators" ? { ...b, values: b.values.map(defang) } : b,
    ),
    citations: a.citations.map((c) => {
      const { url, ...rest } = c;
      return c.urlSafe && url ? { ...rest, url } : rest;
    }),
  };
  return JSON.stringify(safe, null, 2);
}

// Loading at final geometry and still: hard rule 4 bans the pulse, the same
// as SkeletonRows in components/ui.tsx.
export function AnswerSkeleton() {
  return (
    <div aria-hidden className="space-y-2">
      <div className="h-4 w-2/3 bg-cpx-grey-100" />
      <div className="h-3 w-full bg-cpx-grey-50" />
      <div className="h-3 w-11/12 bg-cpx-grey-50" />
      <div className="h-3 w-4/5 bg-cpx-grey-50" />
      <div className="mt-4 h-3 w-40 bg-cpx-grey-50" />
    </div>
  );
}

export function TurnView({
  turn,
  onEntity,
  request,
  onStop,
  onRetry,
}: {
  turn: Turn;
  onEntity: (id: string, entities: Answer["entities"]) => void;
  request?: TurnRequest;
  /** Present while the answer is in flight. */
  onStop?: () => void;
  /** Present on a failed or stopped turn. */
  onRetry?: () => void;
}) {
  const a = turn.answer;
  const superseded = turn.status === "superseded";
  return (
    <div className={`space-y-3 ${superseded ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center bg-cpx-grey-100 text-2xs font-medium">
          Q
        </span>
        <p className="pt-0.5 text-base font-medium">{turn.question}</p>
      </div>
      {turn.status === "streaming" ? (
        <PendingCard onStop={onStop} />
      ) : turn.status === "failed" ? (
        <Outcome text="The backend did not answer. Ask again." onRetry={onRetry} />
      ) : turn.status === "stopped" ? (
        <Outcome text="Stopped before an answer arrived." onRetry={onRetry} />
      ) : !a ? (
        <Outcome text="No answer was recorded for this turn." onRetry={onRetry} />
      ) : (
        <AnswerBody
          answer={a}
          status={turn.status}
          request={request}
          onEntity={(id) => onEntity(id, a.entities)}
        />
      )}
    </div>
  );
}

// The answer is being composed. The one live state is said in a word and a
// still marker, and the analyst can stop it: `stopped` is a state the turn
// already has. No step-by-step progress is drawn, because none is reported.
function PendingCard({ onStop }: { onStop?: () => void }) {
  return (
    <div className="border border-cpx-grey-100 bg-white p-5" aria-busy="true">
      <div className="flex items-center justify-between gap-3">
        <span
          role="status"
          className="inline-flex h-5 items-center gap-1.5 rounded-sm border border-cpx-bright-200 bg-cpx-bright-50 px-1.5 text-2xs font-medium text-cpx-bright-700"
        >
          <span aria-hidden className="h-2 w-2 rounded-full bg-cpx-bright-100 ring-1 ring-cpx-bright" />
          Running
        </span>
        {onStop && (
          <Button size="sm" onClick={onStop}>
            Stop
          </Button>
        )}
      </div>
      <div className="mt-4">
        <AnswerSkeleton />
      </div>
    </div>
  );
}

// One sentence naming the thing and the fix, in the answer's frame, so the
// scrollback stays an honest record of what happened.
function Outcome({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <div role="status" className="reveal border border-cpx-grey-100 bg-white p-5">
      <p className="text-sm">{text}</p>
      {onRetry && (
        <Button size="sm" className="mt-3" onClick={onRetry}>
          Ask again
        </Button>
      )}
    </div>
  );
}

function AnswerBody({
  answer: a,
  status,
  request,
  onEntity,
}: {
  answer: Answer;
  status: Turn["status"];
  request?: TurnRequest;
  onEntity: (id: string) => void;
}) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const records = a.citations.reduce((n, c) => n + c.recordCount, 0);
  const superseded = status === "superseded";

  return (
    <div className="reveal-up border border-cpx-grey-100 bg-white">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center bg-cpx-purple">
              <NestorMarkReverse size={16} />
            </span>
            {a.title && (
              <h2 className="pt-0.5 text-md font-semibold tracking-tightish">
                {a.title}
              </h2>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              title="Copy"
              aria-label="Copy answer"
              onClick={() => {
                navigator.clipboard.writeText(answerPlainText(a));
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              }}
              className="flex h-7 w-7 items-center justify-center text-cpx-grey-400 transition-colors duration-150 hover:bg-cpx-grey-50 hover:text-cpx-black"
            >
              <IconCopy />
            </button>
            <button
              title="Export JSON"
              aria-label="Export answer as JSON"
              onClick={() => {
                const blob = new Blob([answerExportJson(a)], {
                  type: "application/json",
                });
                const el = document.createElement("a");
                el.href = URL.createObjectURL(blob);
                el.download = "answer.json";
                el.click();
                URL.revokeObjectURL(el.href);
              }}
              className="flex h-7 w-7 items-center justify-center text-cpx-grey-400 transition-colors duration-150 hover:bg-cpx-grey-50 hover:text-cpx-black"
            >
              <IconExport />
            </button>
            {copied && (
              <span role="status" className="reveal text-2xs text-cpx-grey-500">
                Copied
              </span>
            )}
          </div>
        </div>

        <div className={`space-y-3 ${a.title ? "mt-4" : "mt-0 pl-9 -translate-y-1"}`}>
          {a.blocks.map((b, i) => {
            if (b.kind === "prose")
              return (
                <p key={i} className="text-sm leading-relaxed">
                  {linkEntities(b.text, a.entities, onEntity)}
                </p>
              );
            if (b.kind === "list")
              return (
                <ul key={i} className="list-disc space-y-1 pl-5 text-sm">
                  {b.items.map((item, j) => (
                    <li key={j}>{linkEntities(item, a.entities, onEntity)}</li>
                  ))}
                </ul>
              );
            if (b.kind === "table")
              return (
                <div key={i} className="overflow-x-auto">
                  <table className={`${T_TABLE} text-sm`}>
                    <thead>
                      <tr className={T_HEAD}>
                        {b.headers.map((h) => (
                          <th key={h} scope="col" className={`${T_TH} ${T_FLUSH}`}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {b.rows.map((r, ri) => (
                        <tr key={ri} className={T_ROW}>
                          {r.map((cell, ci) => (
                            <td
                              key={ci}
                              className={`${T_TD} ${T_FLUSH}`}
                            >
                              {linkEntities(cell, a.entities, onEntity)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            return (
              <div key={i} className="flex flex-wrap gap-1.5">
                {b.values.map((v, j) => (
                  <IndicatorChip key={`${j}-${v}`} value={v} />
                ))}
              </div>
            );
          })}

          {a.negativeResults.map((n) => (
            <p key={n.query} className="text-sm">
              {n.query}:{" "}
              <span className="font-medium">{recordCount(n.recordCount)}</span>
            </p>
          ))}

          {/* The denominator is stated only when the answer carries one. A
              number the backend did not send is not a number (hard rule 8). */}
          {a.sourcesUnavailable.length > 0 && (
            <p className="text-sm">
              Produced with{" "}
              <span className="font-medium">
                {a.sourcesUnavailable.length}
                {a.sourcesTotal ? ` of ${a.sourcesTotal}` : ""}
              </span>{" "}
              {a.sourcesUnavailable.length === 1 && !a.sourcesTotal ? "source" : "sources"} unavailable.
            </p>
          )}

          <div className="flex items-center gap-2 pt-1">
            {a.classificationSettled ? (
              <TlpBadge tlp={a.tlp} />
            ) : (
              <span className="inline-flex h-5 items-center bg-cpx-grey-50 px-1.5 text-2xs text-cpx-grey-500">
                Classification pending
              </span>
            )}
            {a.producedArtefact && (
              <Link
                href={`/reports/${encodeURIComponent(a.producedArtefact.ref)}`}
                className="text-xs text-link underline underline-offset-2"
              >
                Open in Reports
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* The one collapsed row: the sources, and the run that produced them. */}
      <button
        onClick={() => setSourcesOpen(!sourcesOpen)}
        aria-expanded={sourcesOpen}
        className="flex w-full items-center justify-between border-t border-cpx-grey-100 px-5 py-2 text-xs text-cpx-grey-500 transition-colors duration-150 hover:bg-cpx-grey-50"
      >
        <span className="flex flex-wrap items-center gap-2">
          Sources
          <span className="bg-cpx-grey-50 px-1 text-2xs">{a.citations.length}</span>
          <span className="text-cpx-grey-400">·</span>
          {superseded ? (
            <span>Superseded</span>
          ) : (
            <span className="inline-flex items-center gap-1 text-green-contrast">
              <IconCheck />
              Run complete
            </span>
          )}
          {a.egress && (
            <span className="inline-flex items-center gap-1 text-status-warn-ink">
              <IconEgress />
              Left region
            </span>
          )}
        </span>
        <IconChevronDown className={sourcesOpen ? "rotate-180" : ""} />
      </button>
      {sourcesOpen && (
        <div className="reveal border-t border-cpx-grey-100 px-5 py-3">
          <dl className="grid grid-cols-[7rem_1fr] gap-x-4 gap-y-1 text-xs">
            {request && (
              <>
                <dt className="text-cpx-grey-500">Workflow</dt>
                <dd>{request.workflow ?? "Auto-selected"}</dd>
              </>
            )}
            <dt className="text-cpx-grey-500">Evidence</dt>
            <dd>
              <span className="font-medium">{a.citations.length}</span>{" "}
              {a.citations.length === 1 ? "citation" : "citations"} ·{" "}
              <span className="font-medium">{recordCount(records)}</span>
            </dd>
            <dt className="text-cpx-grey-500">Empty searches</dt>
            <dd>
              <span className="font-medium">{a.negativeResults.length}</span> returned 0
              records
            </dd>
            <dt className="text-cpx-grey-500">Coverage</dt>
            <dd>
              <span className="font-medium">
                {a.sourcesUnavailable.length}
                {a.sourcesTotal ? ` of ${a.sourcesTotal}` : ""}
              </span>{" "}
              {a.sourcesUnavailable.length === 1 && !a.sourcesTotal ? "source" : "sources"} unavailable
              {a.sourcesUnavailable.length > 0 && <>: {a.sourcesUnavailable.join(", ")}</>}
            </dd>
            <dt className="text-cpx-grey-500">Region</dt>
            <dd>{a.egress ? "Left region" : "In region"}</dd>
            <dt className="text-cpx-grey-500">Classification</dt>
            <dd>{a.classificationSettled ? `TLP:${a.tlp}` : "Pending"}</dd>
            {a.producedArtefact && (
              <>
                <dt className="text-cpx-grey-500">Output</dt>
                <dd>
                  <Link
                    href={`/reports/${encodeURIComponent(a.producedArtefact.ref)}`}
                    className="text-link underline underline-offset-2"
                  >
                    {a.producedArtefact.ref}
                  </Link>
                </dd>
              </>
            )}
          </dl>
          <ul className="mt-3 space-y-1.5 border-t border-cpx-grey-100 pt-3">
            {a.citations.map((c) => (
              <li key={c.id} className="flex items-baseline gap-2 text-xs">
                <span className="font-mono text-cpx-grey-400">[{c.ref}]</span>
                <span className="">{c.label}</span>
                <span className="font-medium">{recordCount(c.recordCount)}</span>
                {c.url && <span className="font-mono text-2xs text-cpx-grey-400 break-all">{defang(c.url)}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
