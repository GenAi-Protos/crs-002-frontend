"use client";

// One turn: the question row and the answer card beneath it.
// Two text treatments carry all the semantics: blue underline is a navigable
// entity, grey monospace chip is a defanged inert observable.

import { useState, type ReactNode } from "react";
import Link from "next/link";
import type { Answer, Turn } from "@/lib/types";
import { defang } from "@/lib/defang";
import { recordCount } from "@/lib/format";
import { NestorMarkReverse } from "@/components/shell/NestorMark";
import {
  IconChevronDown,
  IconCopy,
  IconEgress,
  IconExport,
} from "@/components/icons";
import { IndicatorChip, TlpBadge } from "@/components/ui";
import {
  T_FLUSH,
  T_HEAD,
  T_ROW,
  T_TABLE,
  T_TD,
  T_TH,
} from "@/components/table";

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
        className="text-link underline underline-offset-2 hover:text-cpx-purple"
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

export function AnswerSkeleton() {
  return (
    <div className="border border-black/10 bg-white p-5">
      <div className="mb-3 h-4 w-2/3 animate-pulse bg-black/10" />
      <div className="mb-2 h-3 w-full animate-pulse bg-black/5" />
      <div className="mb-2 h-3 w-11/12 animate-pulse bg-black/5" />
      <div className="mb-2 h-3 w-4/5 animate-pulse bg-black/5" />
      <div className="mt-4 h-3 w-40 animate-pulse bg-black/5" />
    </div>
  );
}

export function TurnView({
  turn,
  onEntity,
}: {
  turn: Turn;
  onEntity: (id: string, entities: Answer["entities"]) => void;
}) {
  const a = turn.answer;
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center bg-black/10 text-2xs font-medium">
          Q
        </span>
        <p className="pt-0.5 text-base font-medium">{turn.question}</p>
      </div>
      {turn.status === "streaming" || !a ? (
        <AnswerSkeleton />
      ) : (
        <AnswerBody answer={a} onEntity={(id) => onEntity(id, a.entities)} />
      )}
    </div>
  );
}

function AnswerBody({
  answer: a,
  onEntity,
}: {
  answer: Answer;
  onEntity: (id: string) => void;
}) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  return (
    <div className="border border-black/10 bg-white">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center bg-cpx-purple">
              <NestorMarkReverse size={16} />
            </span>
            {a.title && (
              <h2 className="pt-0.5 text-md font-medium tracking-tightish">
                {a.title}
              </h2>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              title="Copy"
              onClick={() => {
                navigator.clipboard.writeText(answerPlainText(a));
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              }}
              className="flex h-7 w-7 items-center justify-center text-black/40 hover:bg-black/5 hover:text-cpx-black"
            >
              <IconCopy />
            </button>
            <button
              title="Export JSON"
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
              className="flex h-7 w-7 items-center justify-center text-black/40 hover:bg-black/5 hover:text-cpx-black"
            >
              <IconExport />
            </button>
            {copied && (
              <span className="text-2xs text-cpx-grey">Copied</span>
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

          {a.sourcesUnavailable.length > 0 && (
            <p className="text-sm">
              Produced with{" "}
              <span className="font-medium">
                {a.sourcesUnavailable.length} of {a.sourcesTotal ?? 13}
              </span>{" "}
              sources unavailable.
            </p>
          )}

          <div className="flex items-center gap-2 pt-1">
            {a.classificationSettled ? (
              <TlpBadge tlp={a.tlp} />
            ) : (
              <span className="inline-flex h-5 items-center bg-black/5 px-1.5 text-2xs text-cpx-grey">
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

      <button
        onClick={() => setSourcesOpen(!sourcesOpen)}
        className="flex w-full items-center justify-between border-t border-black/10 px-5 py-2 text-xs text-cpx-grey hover:bg-black/[0.02]"
      >
        <span className="flex items-center gap-2">
          Sources
          <span className="bg-black/5 px-1 text-2xs">{a.citations.length}</span>
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
        <div className="border-t border-black/5 px-5 py-3">
          <ul className="space-y-1.5">
            {a.citations.map((c) => (
              <li key={c.id} className="flex items-baseline gap-2 text-xs">
                <span className="font-mono text-black/40">[{c.ref}]</span>
                <span className="">{c.label}</span>
                <span className="font-medium">{recordCount(c.recordCount)}</span>
                {c.url && <span className="font-mono text-2xs text-black/40 break-all">{defang(c.url)}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
