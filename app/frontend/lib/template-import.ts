// Reading a custom template the analyst supplies.
//
// The console reads three formats and it is the same three it writes, so a
// template exported from here comes back in unchanged. What it extracts is a
// list of headings with the guidance under each: a template is a structure, not
// content.
//
// Nothing is guessed silently. Where a file yields no headings the import says
// so, because a file the console could not read is not a template.
//
// A template that reads but looks nothing like the standard format is a
// different matter and is not an error: CPX writes for clients who ask for
// their own structure. The console reports how the two compare and the analyst
// decides.

import type { TemplateSection } from "./report-templates";
import { readTextEntry } from "./unzip";

export interface ImportedTemplate {
  name: string;
  sections: TemplateSection[];
  // Stated to the analyst, never swallowed.
  warnings: string[];
}

// Declared beside the templates so the upload control can state what it
// accepts without loading this parser and the ZIP reader behind it.
export { ACCEPTED } from "./report-templates";

// --- markdown ----------------------------------------------------------------

function fromMarkdown(text: string, name: string): ImportedTemplate {
  const sections: TemplateSection[] = [];
  const warnings: string[] = [];
  let current: TemplateSection | null = null;
  const body: string[] = [];

  const flush = () => {
    if (!current) return;
    current.guidance = body.join("\n").replace(/^>\s?/gm, "").trim();
    sections.push(current);
    body.length = 0;
  };

  for (const line of text.split(/\r?\n/)) {
    // A level-two heading is a section. A level-one heading is the document
    // title, which our own template export writes.
    const h2 = /^##\s+(.*\S)\s*$/.exec(line);
    if (h2) {
      flush();
      current = { heading: h2[1].trim(), guidance: "" };
      continue;
    }
    if (/^#\s+/.test(line)) continue;
    if (current) body.push(line);
  }
  flush();

  if (sections.length === 0) {
    warnings.push(
      "No level-two headings were found. A Markdown template marks each section with ## followed by the heading.",
    );
  }
  return { name, sections, warnings };
}

// --- json --------------------------------------------------------------------

function fromJson(text: string, name: string): ImportedTemplate {
  const warnings: string[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { name, sections: [], warnings: ["The file is not valid JSON."] };
  }

  const raw = parsed as { name?: unknown; sections?: unknown };
  const list = Array.isArray(raw?.sections) ? raw.sections : null;
  if (!list) {
    return {
      name,
      sections: [],
      warnings: [
        'No "sections" array was found. A JSON template is an object with a sections array of { heading, guidance }.',
      ],
    };
  }

  const sections: TemplateSection[] = [];
  for (const item of list) {
    const s = item as { heading?: unknown; guidance?: unknown };
    if (typeof s?.heading !== "string" || s.heading.trim() === "") continue;
    sections.push({
      heading: s.heading.trim(),
      guidance: typeof s.guidance === "string" ? s.guidance : "",
    });
  }
  if (sections.length !== list.length) {
    warnings.push(
      `${list.length - sections.length} of ${list.length} entries had no heading and were skipped.`,
    );
  }
  return {
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : name,
    sections,
    warnings,
  };
}

// --- docx --------------------------------------------------------------------

interface DocxParagraph {
  text: string;
  heading: boolean;
}

function paragraphsFromDocumentXml(xml: string): DocxParagraph[] {
  const out: DocxParagraph[] = [];
  const paragraphs = xml.match(/<w:p[\s>][\s\S]*?<\/w:p>/g) ?? [];
  for (const p of paragraphs) {
    const text = (p.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) ?? [])
      .map((t) => t.replace(/<[^>]+>/g, ""))
      .join("")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&")
      .trim();
    if (!text) continue;
    // Two ways a paragraph declares itself a heading: Word's own Heading style,
    // or a wholly bold paragraph, which is what our DOCX template export writes.
    const styled = /<w:pStyle[^>]*w:val="(Heading[1-4]|Title)"/.test(p);
    const bold = /<w:b\s*\/>|<w:b\s+[^>]*\/>/.test(p);
    out.push({ text, heading: styled || bold });
  }
  return out;
}

async function fromDocx(file: File, name: string): Promise<ImportedTemplate> {
  const warnings: string[] = [];
  let xml: string | null;
  try {
    xml = await readTextEntry(await file.arrayBuffer(), "word/document.xml");
  } catch (e) {
    return { name, sections: [], warnings: [(e as Error).message] };
  }
  if (!xml) {
    return {
      name,
      sections: [],
      warnings: ["No word/document.xml inside the file. It is not a DOCX."],
    };
  }

  const paragraphs = paragraphsFromDocumentXml(xml);
  const sections: TemplateSection[] = [];
  let current: TemplateSection | null = null;
  const body: string[] = [];
  const flush = () => {
    if (!current) return;
    current.guidance = body.join("\n").trim();
    sections.push(current);
    body.length = 0;
  };

  // The first heading is the document title where nothing precedes it.
  let seenHeading = false;
  for (const p of paragraphs) {
    if (p.heading) {
      if (!seenHeading && sections.length === 0 && body.length === 0) {
        seenHeading = true;
        continue;
      }
      flush();
      current = { heading: p.text, guidance: "" };
      continue;
    }
    if (current) body.push(p.text);
  }
  flush();

  if (sections.length === 0) {
    warnings.push(
      "No headings were found. Mark each section with a Word heading style, or make the heading paragraph bold.",
    );
  }
  return { name, sections, warnings };
}

// --- entry point -------------------------------------------------------------

async function read(file: File): Promise<ImportedTemplate> {
  const name = file.name;
  const lower = name.toLowerCase();
  if (lower.endsWith(".docx")) return fromDocx(file, name);
  if (lower.endsWith(".json")) return fromJson(await file.text(), name);
  if (lower.endsWith(".md") || lower.endsWith(".markdown"))
    return fromMarkdown(await file.text(), name);
  return {
    name,
    sections: [],
    warnings: [`${name} is not a supported template. Use DOCX, Markdown or JSON.`],
  };
}

export async function importTemplate(file: File): Promise<ImportedTemplate> {
  const result = await read(file);
  return {
    ...result,
    sections: result.sections.map((s) => ({
      ...s,
      // Headings are stored without their source numbering. Every surface that
      // lists sections adds its own, and the two together read as "1  1. Title".
      heading: stripNumbering(s.heading),
      // Guidance is stored without its bracketed placeholder scaffolding.
      guidance: cleanGuidance(s.guidance),
    })),
  };
}

/**
 * A template's own numbering, stripped for display.
 *
 * The console numbers the sections it shows, so a heading that arrives as
 * "1. Executive Summary" would render as "1  1. Executive Summary". The number
 * belongs to the document it came from, not to the section, so it goes.
 *
 * Only a leading ordinal is removed, and only where it is unambiguous:
 *
 *   1. / 1) / 1: / 1     a one or two digit ordinal
 *   1.1 / 1.1.1          a dotted ordinal, any depth
 *   A. / a) / A:         a single letter, but only with a stop after it
 *
 * A bare number is capped at two digits so "2026 Threat Outlook" keeps its year,
 * and a bare letter is never stripped so "A Guide to Exposure" keeps its A.
 */
export function stripNumbering(heading: string): string {
  return heading
    .replace(/^\s*(?:section|part|chapter)\s+/i, "")
    .replace(/^\s*(?:\d+(?:\.\d+)+[.):]?|\d{1,2}[.):]?|[A-Za-z][.):])\s+/, "")
    .replace(/\s*:\s*$/, "")
    .trim();
}

/**
 * Guidance text, without the scaffolding a template author wrapped it in.
 *
 * Template documents commonly mark a fillable spot with a bracketed cue:
 *
 *   [PLACEHOLDER: Provide a concise summary of the intelligence finding.]
 *
 * The instruction inside is the useful part. The bracket and the word are
 * addressed to whoever is filling the template in, and repeating them on a
 * screen that is already labelled as a template adds nothing.
 */
export function cleanGuidance(text: string): string {
  return text
    .split("\n")
    .map((line) =>
      line
        // A whole line that is one bracketed cue.
        .replace(/^\s*[[(]\s*placeholder\s*[:\-–—]?\s*([\s\S]*?)\s*[\])]\s*$/i, "$1")
        // A cue sitting inside a longer line.
        .replace(/[[(]\s*placeholder\s*[:\-–—]?\s*([^\])]*?)\s*[\])]/gi, "$1")
        // The bare word, where the brackets were dropped by an earlier step.
        .replace(/^\s*placeholder\s*[:\-–—]\s*/i, ""),
    )
    .join("\n")
    .trim();
}
