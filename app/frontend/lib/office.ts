// Minimal Office Open XML writers: a real .docx and a real .xlsx, built from
// the ZIP writer rather than a dependency.
//
// Only the parts a reader actually requires are emitted. Word and Excel both
// open these; neither carries styling beyond heading weight, which is correct
// here because CPX owns the document template and we are not reproducing it.

import { xmlEscape, zip } from "./zip";

export type DocBlock =
  | { kind: "title"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "para"; text: string }
  | { kind: "mono"; text: string };

const DOC_CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;

const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;

function paragraph(block: DocBlock): string {
  const runProps =
    block.kind === "title"
      ? '<w:rPr><w:b/><w:sz w:val="36"/></w:rPr>'
      : block.kind === "heading"
        ? '<w:rPr><w:b/><w:sz w:val="26"/></w:rPr>'
        : block.kind === "mono"
          ? '<w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="18"/></w:rPr>'
          : "";
  // A body carrying newlines becomes one paragraph with breaks, not one
  // paragraph per line: the section stays a section in Word.
  const runs = xmlEscape(block.text)
    .split("\n")
    .map((line, i) =>
      `${i > 0 ? "<w:r><w:br/></w:r>" : ""}<w:r>${runProps}<w:t xml:space="preserve">${line}</w:t></w:r>`,
    )
    .join("");
  return `<w:p><w:pPr><w:spacing w:after="140"/></w:pPr>${runs}</w:p>`;
}

export function buildDocx(blocks: DocBlock[]): Blob {
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${blocks
    .map(paragraph)
    .join("")}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`;

  return new Blob(
    [
      zip([
        { name: "[Content_Types].xml", data: DOC_CONTENT_TYPES },
        { name: "_rels/.rels", data: DOC_RELS },
        { name: "word/document.xml", data: document },
      ]),
    ],
    {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
  );
}

// --- xlsx --------------------------------------------------------------------

export interface Sheet {
  name: string;
  rows: string[][];
}

const XL_CONTENT_TYPES = (count: number) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${Array.from(
  { length: count },
  (_, i) =>
    `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
).join("")}</Types>`;

const XL_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

function columnName(index: number): string {
  let n = index + 1;
  let name = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function sheetXml(rows: string[][]): string {
  const body = rows
    .map(
      (row, r) =>
        `<row r="${r + 1}">${row
          .map(
            (cell, c) =>
              // Everything is written as an inline string. A CVE id or a version
              // number must never be reinterpreted as a number or a date.
              `<c r="${columnName(c)}${r + 1}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(
                cell ?? "",
              )}</t></is></c>`,
          )
          .join("")}</row>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}

export function buildXlsx(sheets: Sheet[]): Blob {
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets
    .map(
      (s, i) =>
        `<sheet name="${xmlEscape(s.name).slice(0, 31)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
    )
    .join("")}</sheets></workbook>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
    .map(
      (_, i) =>
        `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
    )
    .join("")}</Relationships>`;

  return new Blob(
    [
      zip([
        { name: "[Content_Types].xml", data: XL_CONTENT_TYPES(sheets.length) },
        { name: "_rels/.rels", data: XL_RELS },
        { name: "xl/workbook.xml", data: workbook },
        { name: "xl/_rels/workbook.xml.rels", data: workbookRels },
        ...sheets.map((s, i) => ({
          name: `xl/worksheets/sheet${i + 1}.xml`,
          data: sheetXml(s.rows),
        })),
      ]),
    ],
    { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  );
}

export function download(blob: Blob, filename: string) {
  const el = document.createElement("a");
  el.href = URL.createObjectURL(blob);
  el.download = filename;
  el.click();
  URL.revokeObjectURL(el.href);
}
