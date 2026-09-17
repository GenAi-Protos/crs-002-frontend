// Exporting a report, and exporting the empty template it was written into.
//
// One rule governs every format here: what leaves is the role-assembled
// payload. Indicators leave defanged (FR-SAF-03) and a citation URL leaves only
// when it is marked safe (FR-SAF-01, FR-SAF-02). A format that cannot carry
// that rule is not offered.
//
// CSV and XLSX are offered only where there is a structured table to carry:
// indicators, techniques or CVSS rows. An empty spreadsheet is not an export.

import type { Advisory } from "./types";
import { buildDocx, buildXlsx, download, type DocBlock, type Sheet } from "./office";
import { TEMPLATES, type ReportTemplate, type ReportType } from "./report-templates";
import { gstDateTime } from "./format";

// The formats, the payload and the structured tables live in lib/report-formats
// (no writers there); re-exported so existing imports keep working.
import {
  exportPayload,
  structuredTables,
  type ReportFormat,
  type TemplateFormat,
} from "./report-formats";
export {
  FORMAT_LABEL,
  exportPayload,
  formatsFor,
  hasStructuredData,
  structuredTables,
  type ReportFormat,
  type TemplateFormat,
} from "./report-formats";

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
