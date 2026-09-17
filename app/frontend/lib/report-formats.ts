// The report formats and the render-time facts about them: which formats a
// report can leave in, and the structured tables behind the CSV and XLSX
// offers. Pure, and free of the DOCX and ZIP writers, so the list rows and the
// report toolbar can name the formats without carrying the writers.
// lib/report-export.ts holds the writers and re-exports everything here.

import type { Advisory, DiamondVertex } from "./types";
import { defang } from "./defang";
import { resolveTechnique, TACTICS } from "./mitre";

export type ReportFormat = "pdf" | "docx" | "md" | "json" | "csv" | "xlsx";
export type TemplateFormat = "docx" | "pdf" | "md" | "json";

export const FORMAT_LABEL: Record<ReportFormat, string> = {
  pdf: "PDF",
  docx: "DOCX",
  md: "Markdown",
  json: "JSON",
  csv: "CSV",
  xlsx: "XLSX",
};

// --- what leaves -------------------------------------------------------------

function indicatorLines(a: Advisory): string[] {
  const section = a.sections.find((s) => s.heading === "Indicators");
  if (!section || section.body.includes("withheld at this access level")) return [];
  return section.body.split("\n").map((v) => v.trim()).filter(Boolean);
}

function safeBody(a: Advisory, heading: string, body: string): string {
  void a;
  if (heading !== "Indicators") return body;
  return body
    .split("\n")
    .filter(Boolean)
    .map((v) => defang(v.trim()))
    .join("\n");
}

/** The export payload. Unsafe citation URLs are dropped, not blanked. */
export function exportPayload(a: Advisory) {
  return {
    ...a,
    sections: a.sections.map((s) => ({
      ...s,
      body: safeBody(a, s.heading, s.body),
      citations: s.citations.map((c) => {
        const { url, ...rest } = c;
        return c.urlSafe && url ? { ...rest, url } : rest;
      }),
    })),
  };
}

const DIAMOND_LABEL: Record<DiamondVertex, string> = {
  adversary: "Adversary",
  capability: "Capability",
  infrastructure: "Infrastructure",
  victim: "Victim",
};

// --- structured tables -------------------------------------------------------

interface Table {
  name: string;
  headers: string[];
  rows: string[][];
}

export function structuredTables(a: Advisory): Table[] {
  const tables: Table[] = [];

  const indicators = indicatorLines(a);
  if (indicators.length > 0) {
    tables.push({
      name: "Indicators",
      headers: ["Indicator"],
      // Defanged on the way out, like every other rendering site.
      rows: indicators.map((v) => [defang(v)]),
    });
  }

  if (a.techniques.length > 0) {
    tables.push({
      name: "Techniques",
      headers: ["Technique", "Name", "Tactic", "Resolved", "Observed activity"],
      rows: a.techniques.map((t) => {
        const resolved = resolveTechnique(t.techniqueId);
        return [
          t.techniqueId,
          resolved?.name ?? t.techniqueName,
          resolved
            ? resolved.tactics.map((id) => TACTICS[id] ?? id).join(", ")
            : TACTICS[t.tacticId] ?? t.tacticId,
          t.resolved ? "yes" : "no",
          t.observedActivity,
        ];
      }),
    });
  }

  // A Threat Actor Profile's Diamond Model. Two tables rather than one: the
  // vertices and the edges answer different questions, and flattening them
  // would lose which pairs were left unstated.
  if (a.diamond) {
    const d = a.diamond;
    const vertices: [string, string][] = [
      ["Adversary", d.adversary],
      ["Capability", d.capability],
      // The one vertex that routinely holds indicators, so it leaves defanged.
      ["Infrastructure", defang(d.infrastructure)],
      ["Victim", d.victim],
    ];
    tables.push({
      name: "Diamond Model",
      headers: ["Vertex", "Analysis"],
      // An unwritten vertex exports as "Not stated" rather than as a blank
      // cell: the reader can tell the difference between nothing held and a
      // formatting slip.
      rows: vertices.map(([k, v]) => [k, v.trim() === "" ? "Not stated" : v]),
    });

    if (d.edges.length > 0) {
      tables.push({
        name: "Diamond Model relationships",
        headers: ["From", "To", "How they are linked"],
        rows: d.edges.map((e) => [
          DIAMOND_LABEL[e.source],
          DIAMOND_LABEL[e.target],
          e.label,
        ]),
      });
    }
  }

  if (a.cvss.length > 0) {
    tables.push({
      name: "CVSS",
      headers: ["CVE", "Score", "Vector", "Source", "Authority", "Assessed"],
      rows: a.cvss.map((c) => [
        c.cveId,
        String(c.value),
        c.vector ?? "",
        c.source,
        c.authorityClass,
        c.assessedAt,
      ]),
    });
  }

  return tables;
}

export function hasStructuredData(a: Advisory): boolean {
  return structuredTables(a).length > 0;
}

export function formatsFor(a: Advisory): ReportFormat[] {
  const base: ReportFormat[] = ["pdf", "docx", "md", "json"];
  return hasStructuredData(a) ? [...base, "csv", "xlsx"] : base;
}
