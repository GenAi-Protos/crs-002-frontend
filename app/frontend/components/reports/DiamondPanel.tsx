"use client";

// The Diamond Model analysis on a Threat Actor Profile (FR-ADV-07).
//
// The model is four vertices AND the edges between them. Four filled boxes with
// no relationships is not an analysis, so the diagram draws a pair solid once a
// relationship has been written for it and leaves it faint until then: the gap
// in the work is visible on the face of the document rather than buried.
//
// The diagram is a layout, not a picture. It is drawn from the same structured
// field the export writes as a table, so nothing here is generated imagery and
// nothing renders that the DOCX and CSV paths cannot carry (FR-ADV-04's rule
// against generated images, and FR-OUT-05's).
//
// One component serves the editor and the preview. A read-only preview that
// re-implemented the diagram would be free to drift from the thing being
// approved, which is the one thing a preview must never do.

import { useState } from "react";
import type { Advisory, DiamondEdge, DiamondVertex } from "@/lib/types";
import { emptyDiamond } from "@/lib/report-templates";
import { defang } from "@/lib/defang";
import { buttonClass } from "@/components/ui";

const VERTICES: { key: DiamondVertex; label: string; hint: string }[] = [
  {
    key: "adversary",
    label: "Adversary",
    hint: "The actor operating, and who it is assessed to be.",
  },
  {
    key: "capability",
    label: "Capability",
    hint: "The malware, tooling and techniques it uses.",
  },
  {
    key: "infrastructure",
    label: "Infrastructure",
    hint: "The infrastructure the capability is delivered from.",
  },
  {
    key: "victim",
    label: "Victim",
    hint: "The sectors, regions and organisations on the receiving end.",
  },
];

const LABEL: Record<DiamondVertex, string> = {
  adversary: "Adversary",
  capability: "Capability",
  infrastructure: "Infrastructure",
  victim: "Victim",
};

// Every pair, in a fixed order, so the relationship list and the diagram agree.
const PAIRS: [DiamondVertex, DiamondVertex][] = [
  ["adversary", "capability"],
  ["adversary", "infrastructure"],
  ["adversary", "victim"],
  ["capability", "infrastructure"],
  ["capability", "victim"],
  ["infrastructure", "victim"],
];

const pairKey = (a: DiamondVertex, b: DiamondVertex) => [a, b].sort().join("|");

/** Infrastructure is the one vertex that routinely holds indicators, so it is
 *  defanged at render like every other rendering site (FR-SAF-03). */
const renderValue = (key: DiamondVertex, value: string) =>
  key === "infrastructure" ? defang(value) : value;

export function DiamondPanel({
  advisory: a,
  editable,
  update,
}: {
  advisory: Advisory;
  editable: boolean;
  update?: (fn: (d: Advisory) => Advisory) => void;
}) {
  const diamond = a.diamond ?? emptyDiamond();
  const written = VERTICES.filter((v) => diamond[v.key].trim() !== "").length;
  const linked = new Set(diamond.edges.map((e) => pairKey(e.source, e.target)));

  const setVertex = (key: DiamondVertex, value: string) =>
    update?.((d) => ({
      ...d,
      diamond: { ...(d.diamond ?? emptyDiamond()), [key]: value },
    }));

  return (
    <div className="mt-3">
      <Diagram diamond={diamond} linked={linked} editable={editable} onEdit={setVertex} />

      <Relationships
        edges={diamond.edges}
        linked={linked}
        editable={editable}
        onAdd={(edge) =>
          update?.((d) => {
            const current = d.diamond ?? emptyDiamond();
            // One relationship per pair. Rewriting a pair replaces it rather
            // than stacking a second, contradictory reading of the same link.
            const kept = current.edges.filter(
              (e) => pairKey(e.source, e.target) !== pairKey(edge.source, edge.target),
            );
            return { ...d, diamond: { ...current, edges: [...kept, edge] } };
          })
        }
        onRemove={(edge) =>
          update?.((d) => {
            const current = d.diamond ?? emptyDiamond();
            return {
              ...d,
              diamond: {
                ...current,
                edges: current.edges.filter(
                  (e) =>
                    pairKey(e.source, e.target) !== pairKey(edge.source, edge.target),
                ),
              },
            };
          })
        }
      />

      {/* Counts render including zero. A profile that has filled no vertices
          and drawn no links says exactly that. */}
      <p className="mt-2 text-2xs text-cpx-grey-500">
        <span className="font-medium text-cpx-black">{written} of 4</span> vertices
        written,{" "}
        <span className="font-medium text-cpx-black">{diamond.edges.length} of 6</span>{" "}
        relationships stated.
      </p>
    </div>
  );
}

// --- the diagram -------------------------------------------------------------

/** Vertex centres as percentages, so the connector layer maps exactly onto the
 *  grid at any width without measuring anything. */
const AT: Record<DiamondVertex, { x: number; y: number }> = {
  adversary: { x: 50, y: 16 },
  capability: { x: 17, y: 50 },
  infrastructure: { x: 83, y: 50 },
  victim: { x: 50, y: 84 },
};

// Grid placement, diamond order: adversary top, capability left,
// infrastructure right, victim bottom. Written out in full rather than composed
// at runtime: Tailwind scans source text, so an interpolated class name is a
// class that never reaches the stylesheet.
const CELL: Record<DiamondVertex, string> = {
  adversary: "sm:col-start-2 sm:row-start-1",
  capability: "sm:col-start-1 sm:row-start-2",
  infrastructure: "sm:col-start-3 sm:row-start-2",
  victim: "sm:col-start-2 sm:row-start-3",
};

function Diagram({
  diamond,
  linked,
  editable,
  onEdit,
}: {
  diamond: NonNullable<Advisory["diamond"]>;
  linked: Set<string>;
  editable: boolean;
  onEdit: (key: DiamondVertex, value: string) => void;
}) {
  return (
    <div className="relative">
      {/* Connectors sit behind the cards. Hidden below sm, where the grid
          collapses to a single column and a diamond would be a lie. */}
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 hidden h-full w-full sm:block"
      >
        {PAIRS.map(([from, to]) => {
          const on = linked.has(pairKey(from, to));
          return (
            <line
              key={`${from}-${to}`}
              x1={AT[from].x}
              y1={AT[from].y}
              x2={AT[to].x}
              y2={AT[to].y}
              vectorEffect="non-scaling-stroke"
              strokeWidth={on ? 1.5 : 1}
              strokeDasharray={on ? undefined : "3 3"}
              className={on ? "stroke-cpx-purple" : "stroke-cpx-grey-200"}
            />
          );
        })}
      </svg>

      <div className="relative grid grid-cols-1 gap-2 sm:grid-cols-3 sm:grid-rows-3 sm:gap-3">
        {VERTICES.map((v) => (
          <div
            key={v.key}
            className={`border border-cpx-grey-100 bg-white p-2.5 ${CELL[v.key]}`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-2xs font-medium uppercase tracking-wide text-cpx-purple">
                {v.label}
              </span>
              {diamond[v.key].trim() === "" && (
                <span className="shrink-0 text-2xs text-cpx-grey-500">
                  unwritten
                </span>
              )}
            </div>
            {editable ? (
              <textarea
                defaultValue={diamond[v.key]}
                onBlur={(e) => onEdit(v.key, e.target.value)}
                placeholder={v.hint}
                rows={3}
                className="mt-1.5 w-full resize-y border border-cpx-grey-100 bg-white p-1.5 text-xs leading-relaxed focus:border-cpx-green focus:outline-none"
              />
            ) : (
              <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed">
                {diamond[v.key].trim() === "" ? (
                  <span className="text-cpx-grey-500">Not stated.</span>
                ) : (
                  renderValue(v.key, diamond[v.key])
                )}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// --- the relationships -------------------------------------------------------

function Relationships({
  edges,
  linked,
  editable,
  onAdd,
  onRemove,
}: {
  edges: DiamondEdge[];
  linked: Set<string>;
  editable: boolean;
  onAdd: (edge: DiamondEdge) => void;
  onRemove: (edge: DiamondEdge) => void;
}) {
  const [pair, setPair] = useState(0);
  const [label, setLabel] = useState("");

  // Ordered by the fixed pair list rather than insertion, so the table reads
  // the same way twice and matches the diagram.
  const ordered = PAIRS.map(([from, to]) =>
    edges.find((e) => pairKey(e.source, e.target) === pairKey(from, to)),
  ).filter((e): e is DiamondEdge => Boolean(e));

  return (
    <div className="mt-3">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-cpx-grey-100 text-left">
            <th className="py-1.5 pr-3 font-medium">Relationship</th>
            <th className="py-1.5 font-medium">How they are linked</th>
            {editable && <th className="w-8 py-1.5" />}
          </tr>
        </thead>
        <tbody>
          {ordered.map((e) => (
            <tr key={pairKey(e.source, e.target)} className="border-b border-cpx-grey-100">
              <td className="whitespace-nowrap py-1.5 pr-3">
                {LABEL[e.source]} - {LABEL[e.target]}
              </td>
              <td className="py-1.5">{e.label}</td>
              {editable && (
                <td className="py-1.5 text-right">
                  <button
                    onClick={() => onRemove(e)}
                    aria-label={`Remove ${LABEL[e.source]} to ${LABEL[e.target]}`}
                    className="px-1 text-xs text-cpx-grey-500 hover:text-cpx-red"
                  >
                    Remove
                  </button>
                </td>
              )}
            </tr>
          ))}
          {ordered.length === 0 && (
            <tr>
              <td colSpan={editable ? 3 : 2} className="py-2">
                <span className="font-medium">0 relationships</span> stated.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {editable && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            value={pair}
            onChange={(e) => setPair(Number(e.target.value))}
            aria-label="Vertices to link"
            className="h-8 border border-cpx-grey-100 bg-white px-1.5 text-xs focus:border-cpx-green focus:outline-none"
          >
            {PAIRS.map(([from, to], i) => (
              <option key={pairKey(from, to)} value={i}>
                {LABEL[from]} - {LABEL[to]}
                {linked.has(pairKey(from, to)) ? " (stated)" : ""}
              </option>
            ))}
          </select>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="How they are linked"
            className="h-8 min-w-0 flex-1 border border-cpx-grey-100 px-2 text-xs focus:border-cpx-green focus:outline-none"
          />
          <button
            disabled={label.trim() === ""}
            onClick={() => {
              const [source, target] = PAIRS[pair];
              onAdd({ source, target, label: label.trim() });
              setLabel("");
            }}
            className={buttonClass("secondary", "sm")}
          >
            {linked.has(pairKey(PAIRS[pair][0], PAIRS[pair][1])) ? "Replace" : "Add"}
          </button>
        </div>
      )}
    </div>
  );
}
