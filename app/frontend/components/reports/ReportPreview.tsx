"use client";

// Preview: the artefact as the client receives it, before anyone exports it.
//
// It is the read-only rendering deliberately, not the editor with the controls
// hidden. What the analyst is checking is whether the document reads correctly
// once the affordances are gone, and a preview that still carries a textarea
// answers a different question.
//
// It is also the PDF path. The browser writes the file from this markup, so
// what is previewed and what is exported cannot drift apart.

import { useEffect } from "react";
import type { Advisory } from "@/lib/types";
import { templateFor } from "@/lib/report-templates";
import { isPlaceholder } from "@/lib/report-templates";
import { structuredTables } from "@/lib/report-export";
import { resolveTechnique, TACTICS } from "@/lib/mitre";
import { gstDateTime, recordCount } from "@/lib/format";
import { defang } from "@/lib/defang";
import { IndicatorChip, TlpBadge } from "@/components/ui";
import { DiamondPanel } from "./DiamondPanel";
import { IconClose } from "@/components/icons";

export function ReportPreview({
  advisory: a,
  onClose,
  onPrint,
}: {
  advisory: Advisory;
  onClose: () => void;
  onPrint?: () => void;
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  const template = templateFor(a.type);
  const unwritten = a.sections.filter((s) => isPlaceholder(s, template)).length;
  const tables = structuredTables(a);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/30 p-4">
      <div className="mx-auto w-full max-w-[860px] bg-white">
        <div className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-black/10 bg-white px-6 py-3">
          <span className="text-[13px] font-medium tracking-tightish">Preview</span>
          <span className="bg-black/5 px-1.5 text-[11px] font-light">
            {template?.name ?? a.type}
          </span>
          {a.template?.kind === "custom" && (
            <span className="bg-black/5 px-1.5 text-[11px] font-light text-cpx-grey">
              Custom template
            </span>
          )}
          <span className="text-[12px] font-light text-cpx-grey">
            As the client receives it
          </span>
          <div className="flex-1" />
          {onPrint && (
            <button
              onClick={onPrint}
              className="h-7 border border-black/15 px-2.5 text-[12px] font-light hover:bg-black/5"
            >
              Print or save as PDF
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="Close preview"
            className="flex h-7 w-7 items-center justify-center hover:bg-black/5"
          >
            <IconClose />
          </button>
        </div>

        {unwritten > 0 && (
          <p className="no-print border-b border-black/10 bg-status-warn-fill px-6 py-2 text-[12px] font-light text-status-warn-ink">
            {unwritten} of {a.sections.length}{" "}
            {unwritten === 1 ? "section still holds" : "sections still hold"} only
            the template guidance. It renders below as it would be sent.
          </p>
        )}

        <article className="print-root px-6 py-8">
          <header className="border-b border-black/10 pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[12px]">{a.ref}</span>
              <TlpBadge tlp={a.tlp} />
              <span className="text-[11.5px] font-light text-cpx-grey">
                v{a.version} ·{" "}
              {a.template?.kind === "custom"
                ? a.template.name
                : (template?.name ?? a.type)}
              </span>
            </div>
            <h1 className="mt-2 text-[24px] font-medium leading-snug tracking-tightish">
              {a.title}
            </h1>
            <p className="mt-2 text-[11.5px] font-light text-cpx-grey">
              {a.owner ?? "Unassigned"} ·{" "}
              {a.publishedAt
                ? `Published ${gstDateTime(a.publishedAt)}`
                : `Created ${gstDateTime(a.createdAt)}`}
            </p>
          </header>

          <div className="mt-6 space-y-7">
            {a.sections.map((s) => (
              <section key={s.id}>
                <h2 className="border-b border-black/10 pb-1 text-[15px] font-medium tracking-tightish">
                  {s.heading}
                </h2>
                {s.heading === "Diamond Model Analysis" ? (
                  <>
                    <p className="mt-2 whitespace-pre-line text-[13.5px] font-light leading-relaxed">
                      {s.body}
                    </p>
                    {/* The same panel the editor renders, read-only. A preview
                        that re-implemented the diagram could drift from the
                        thing being approved. */}
                    <DiamondPanel advisory={a} editable={false} />
                  </>
                ) : s.heading === "Indicators" &&
                  !s.body.includes("withheld at this access level") ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {s.body
                      .split("\n")
                      .filter(Boolean)
                      .map((v, i) => (
                        <IndicatorChip key={`${i}-${v}`} value={v.trim()} />
                      ))}
                  </div>
                ) : (
                  <p
                    className={`mt-2 whitespace-pre-line text-[13.5px] leading-relaxed ${
                      isPlaceholder(s, template)
                        ? "font-light italic text-cpx-grey"
                        : "font-light"
                    }`}
                  >
                    {s.body}
                  </p>
                )}
                {s.citations.length > 0 && (
                  <p className="mt-1.5 text-[11.5px] font-light text-cpx-grey">
                    {s.citations
                      .map(
                        (c) =>
                          `[${c.ref}] ${c.label}, ${recordCount(c.recordCount)}${
                            c.urlSafe && c.url ? ` ${defang(c.url)}` : ""
                          }`,
                      )
                      .join(" · ")}
                  </p>
                )}
              </section>
            ))}
          </div>

          {a.techniques.length > 0 && (
            <section className="mt-8">
              <h2 className="border-b border-black/10 pb-1 text-[15px] font-medium tracking-tightish">
                Techniques
              </h2>
              <table className="mt-2 w-full border-collapse text-[12.5px]">
                <thead>
                  <tr className="border-b border-black/10 text-left font-light text-cpx-grey">
                    <th className="py-1.5 pr-4 font-light">Technique</th>
                    <th className="py-1.5 pr-4 font-light">Tactic</th>
                    <th className="py-1.5 font-light">Observed</th>
                  </tr>
                </thead>
                <tbody>
                  {a.techniques.map((t) => {
                    const resolved = resolveTechnique(t.techniqueId);
                    return (
                      <tr
                        key={t.techniqueId}
                        className="border-b border-black/5 align-top"
                      >
                        <td className="py-1.5 pr-4">
                          <span className="font-mono text-[11.5px]">
                            {t.techniqueId}
                          </span>{" "}
                          {resolved?.name ?? (
                            <span className="text-status-warn-ink">
                              does not resolve
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 pr-4 font-light">
                          {TACTICS[t.tacticId] ?? t.tacticId}
                        </td>
                        <td className="py-1.5 font-light">{t.observedActivity}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          )}

          {a.cvss.length > 0 && (
            <section className="mt-8">
              <h2 className="border-b border-black/10 pb-1 text-[15px] font-medium tracking-tightish">
                CVSS
              </h2>
              <table className="mt-2 w-full border-collapse text-[12.5px]">
                <thead>
                  <tr className="border-b border-black/10 text-left font-light text-cpx-grey">
                    <th className="py-1.5 pr-4 font-light">CVE</th>
                    <th className="py-1.5 pr-4 font-light">Score</th>
                    <th className="py-1.5 font-light">Authority</th>
                  </tr>
                </thead>
                <tbody>
                  {a.cvss.map((c, i) => (
                    <tr key={`${c.cveId}-${i}`} className="border-b border-black/5">
                      <td className="py-1.5 pr-4 font-mono text-[11.5px]">
                        {c.cveId}
                      </td>
                      <td className="py-1.5 pr-4 font-medium">{c.value}</td>
                      <td className="py-1.5 font-light">
                        {c.source} · {c.authorityClass.toUpperCase()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <footer className="mt-10 border-t border-black/10 pt-3 text-[11px] font-light text-cpx-grey">
            {a.ref} · v{a.version} · TLP:{a.tlp} · CPX Threat Intelligence Center
            {tables.length > 0 && (
              <> · {tables.length} structured {tables.length === 1 ? "table" : "tables"}</>
            )}
          </footer>
        </article>
      </div>
    </div>
  );
}
