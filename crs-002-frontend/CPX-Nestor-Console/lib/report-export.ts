// Exporting a report, and exporting the empty template it was written into.
//
// One rule governs every format here: what leaves is the role-assembled
// payload. Indicators leave defanged (FR-SAF-03) and a citation URL leaves only
// when it is marked safe (FR-SAF-01, FR-SAF-02). A format that cannot carry
// that rule is not offered.
//
// CSV and XLSX are offered only where there is a structured table to carry:
// indicators, techniques or CVSS rows. An empty spreadsheet is not an export.

import type { Advisory, DiamondVertex } from "./types";
import { buildDocx, buildXlsx, download, type DocBlock, type Sheet } from "./office";
import { defang } from "./defang";
import { TEMPLATES, type ReportTemplate, type ReportType } from "./report-templates";
import { resolveTechnique, TACTICS } from "./mitre";
import { gstDateTime } from "./format";

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

// --- serialisers -------------------------------------------------------------

function metaRows(a: Advisory): [string, string][] {
  return [
    ["Reference", a.ref],
    ["Type", a.type],
    ["Title", a.title],
    ["Version", `v${a.version}`],
    ["TLP", `TLP:${a.tlp}`],
    ["Status", a.status],
    ["Owner", a.owner ?? "-"],
    ["Created", gstDateTime(a.createdAt)],
    ...(a.publishedAt
      ? ([["Published", gstDateTime(a.publishedAt)]] as [string, string][])
      : []),
  ];
}

export function toMarkdown(a: Advisory): string {
  const p = exportPayload(a);
  const lines: string[] = [`# ${p.title}`, ""];
  for (const [k, v] of metaRows(a)) lines.push(`- **${k}:** ${v}`);
  lines.push("");

  for (const s of p.sections) {
    lines.push(`## ${s.heading}`, "");
    lines.push(s.body, "");
    if (s.citations.length > 0) {
      lines.push(
        s.citations
          .map((c) => `[${c.ref}] ${c.label}, ${c.recordCount} records`)
          .join("  \n"),
        "",
      );
    }
  }

  for (const t of structuredTables(a)) {
    lines.push(`## ${t.name}`, "");
    lines.push(`| ${t.headers.join(" | ")} |`);
    lines.push(`| ${t.headers.map(() => "---").join(" | ")} |`);
    for (const row of t.rows) lines.push(`| ${row.map((c) => c.replace(/\|/g, "\\|")).join(" | ")} |`);
    lines.push("");
  }

  return lines.join("\n");
}

export function toDocBlocks(a: Advisory): DocBlock[] {
  const p = exportPayload(a);
  const blocks: DocBlock[] = [{ kind: "title", text: p.title }];
  blocks.push({
    kind: "mono",
    text: metaRows(a)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n"),
  });
  for (const s of p.sections) {
    blocks.push({ kind: "heading", text: s.heading });
    blocks.push({ kind: "para", text: s.body });
    if (s.citations.length > 0) {
      blocks.push({
        kind: "mono",
        text: s.citations
          .map((c) => `[${c.ref}] ${c.label}, ${c.recordCount} records`)
          .join("\n"),
      });
    }
  }
  for (const t of structuredTables(a)) {
    blocks.push({ kind: "heading", text: t.name });
    blocks.push({
      kind: "mono",
      text: [t.headers, ...t.rows].map((r) => r.join("\t")).join("\n"),
    });
  }
  return blocks;
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(a: Advisory): string {
  // One flat file with a Table column, because CSV holds one table and this
  // report may carry three. XLSX is the format that keeps them apart.
  const lines = ["Table,Field,Value"];
  for (const t of structuredTables(a)) {
    lines.push([t.name, "", t.headers.join(" | ")].map(csvCell).join(","));
    for (const row of t.rows) {
      lines.push([t.name, row[0] ?? "", row.slice(1).join(" | ")].map(csvCell).join(","));
    }
  }
  return lines.join("\n");
}

export function toSheets(a: Advisory): Sheet[] {
  return [
    { name: "Report", rows: [["Field", "Value"], ...metaRows(a).map(([k, v]) => [k, v])] },
    ...structuredTables(a).map((t) => ({
      name: t.name,
      rows: [t.headers, ...t.rows],
    })),
  ];
}

// --- doing it ----------------------------------------------------------------

/**
 * `onPrint` is how PDF happens: the preview opens and the browser writes the
 * file. There is no PDF engine here, and pretending otherwise would put a
 * second renderer between the analyst and what the client receives.
 */
export function exportReport(
  a: Advisory,
  format: ReportFormat,
  onPrint: () => void,
): void {
  const name = a.ref;
  switch (format) {
    case "pdf":
      onPrint();
      return;
    case "docx":
      download(buildDocx(toDocBlocks(a)), `${name}.docx`);
      return;
    case "md":
      download(new Blob([toMarkdown(a)], { type: "text/markdown" }), `${name}.md`);
      return;
    case "json":
      download(
        new Blob([JSON.stringify(exportPayload(a), null, 2)], {
          type: "application/json",
        }),
        `${name}.json`,
      );
      return;
    case "csv":
      download(new Blob([toCsv(a)], { type: "text/csv" }), `${name}.csv`);
      return;
    case "xlsx":
      download(buildXlsx(toSheets(a)), `${name}.xlsx`);
      return;
  }
}

// --- templates ---------------------------------------------------------------

export function templateMarkdown(t: ReportTemplate): string {
  const lines = [`# ${t.name} template`, "", `Report type: ${t.type}`, `Basis: ${t.basis}`, ""];
  if (t.workOrder) {
    lines.push(
      "This format is a work order, not a document. It carries a requester, a question, a client, a due date and its steps.",
      "",
    );
    return lines.join("\n");
  }
  for (const s of t.sections) {
    lines.push(`## ${s.heading}`, "", `> ${s.guidance}`, "");
  }
  return lines.join("\n");
}

export function templateDocBlocks(t: ReportTemplate): DocBlock[] {
  const blocks: DocBlock[] = [
    { kind: "title", text: `${t.name} template` },
    { kind: "mono", text: `Report type: ${t.type}\nBasis: ${t.basis}` },
  ];
  if (t.workOrder) {
    blocks.push({
      kind: "para",
      text: "This format is a work order, not a document. It carries a requester, a question, a client, a due date and its steps.",
    });
    return blocks;
  }
  for (const s of t.sections) {
    blocks.push({ kind: "heading", text: s.heading });
    blocks.push({ kind: "para", text: s.guidance });
  }
  return blocks;
}

export function exportTemplate(
  type: ReportType,
  format: TemplateFormat,
  onPrint: () => void,
): void {
  const t = TEMPLATES[type];
  const name = `${type}-template`;
  switch (format) {
    case "pdf":
      onPrint();
      return;
    case "docx":
      download(buildDocx(templateDocBlocks(t)), `${name}.docx`);
      return;
    case "md":
      download(new Blob([templateMarkdown(t)], { type: "text/markdown" }), `${name}.md`);
      return;
    case "json":
      download(
        new Blob([JSON.stringify(t, null, 2)], { type: "application/json" }),
        `${name}.json`,
      );
      return;
  }
}
